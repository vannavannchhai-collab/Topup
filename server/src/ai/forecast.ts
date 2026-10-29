/**
 * Demand forecasting engine.
 *
 * Pipeline:
 *   1. Candidate transforms (identity, log1p) — retail demand is multiplicative,
 *      so a log transform often halves the error on revenue series.
 *   2. For each transform, backtest on a true hold-out tail two predictors:
 *        · additive Holt-Winters (level + trend + weekly seasonality)
 *        · seasonal-naive with drift ("same weekday last week" × momentum)
 *      and blend them by inverse WAPE.
 *   3. Keep the (transform, blend) pair with the lowest out-of-sample MAPE,
 *      refit on the full series and emit a point forecast with an ~80% band.
 *
 * Everything is scored in original units with WAPE (weighted absolute percentage
 * error = Σ|error| / Σ|actual|), which — unlike MAPE — is not dominated by
 * near-zero days and is the standard metric for demand forecasting.
 */

export interface ForecastPoint {
  date: string;
  value: number;
  lower?: number;
  upper?: number;
  kind: 'actual' | 'forecast';
}

export interface ForecastResult {
  history: ForecastPoint[];
  forecast: ForecastPoint[];
  errorPct: number;
  baselineErrorPct: number;
  errorMetric: 'WAPE';
  ensembleWeight: number;
  seasonality: number;
  trendPerDay: number;
  confidence: 'high' | 'medium' | 'low';
  model: string;
  transform: 'identity' | 'log1p';
}

interface Smoothed {
  level: number;
  trend: number;
  seasonal: number[];
  fitted: number[];
}

interface Transform {
  name: 'identity' | 'log1p';
  apply: (value: number) => number;
  invert: (value: number) => number;
}

const TRANSFORMS: Transform[] = [
  { name: 'identity', apply: (value) => value, invert: (value) => value },
  { name: 'log1p', apply: (value) => Math.log1p(Math.max(0, value)), invert: (value) => Math.expm1(value) },
];

export function holtWinters(
  series: number[],
  seasonLength: number,
  alpha = 0.32,
  beta = 0.08,
  gamma = 0.28,
): Smoothed | null {
  if (series.length < seasonLength * 2 || seasonLength < 2) return null;

  // Initialise seasonal indices from per-season averages.
  const seasonal: number[] = [];
  for (let i = 0; i < seasonLength; i += 1) {
    const values: number[] = [];
    for (let t = i; t < series.length; t += seasonLength) values.push(series[t]);
    seasonal.push(values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1));
  }
  const seasonMean = seasonal.reduce((a, b) => a + b, 0) / seasonal.length || 1;
  const centred = seasonal.map((value) => value - seasonMean);

  let level = series[0];
  let trend =
    (series[Math.min(seasonLength, series.length - 1)] - series[0]) / Math.min(seasonLength, series.length - 1);
  const fitted: number[] = [];
  let recentErrors: number[] = [];

  for (let t = 0; t < series.length; t += 1) {
    const seasonalIndex = centred[t % seasonLength];
    const prediction = level + trend + seasonalIndex;
    fitted.push(prediction);
    const error = series[t] - prediction;
    recentErrors.push(error);
    if (recentErrors.length > 7) recentErrors = recentErrors.slice(-7);
    level = prediction + alpha * error;
    trend = trend + alpha * beta * error;
    centred[t % seasonLength] = seasonalIndex + gamma * error * (1 - alpha);
  }

  // Fold half of the trailing bias into the level so short horizons don't lag.
  const bias = recentErrors.reduce((a, b) => a + b, 0) / Math.max(recentErrors.length, 1);
  level += bias * 0.5;

  return { level, trend, seasonal: centred, fitted };
}

export function project(model: Smoothed, startIndex: number, steps: number, seasonLength: number): number[] {
  const out: number[] = [];
  for (let step = 1; step <= steps; step += 1) {
    out.push(model.level + model.trend * step + (model.seasonal[(startIndex + step - 1) % seasonLength] ?? 0));
  }
  return out;
}

/** Seasonal-naive with drift: repeat last season's value, scaled by recent momentum. */
export function seasonalNaive(series: number[], seasonLength: number, steps: number): number[] {
  const recent = series.slice(-seasonLength);
  const previous = series.slice(-seasonLength * 2, -seasonLength);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / Math.max(recent.length, 1);
  const previousAvg = previous.reduce((a, b) => a + b, 0) / Math.max(previous.length, 1);
  const drift = previousAvg > 0 ? Math.min(1.6, Math.max(0.7, recentAvg / previousAvg)) : 1;

  const out: number[] = [];
  for (let step = 1; step <= steps; step += 1) {
    const index = series.length - seasonLength + ((step - 1) % seasonLength);
    const base = series[index] ?? recentAvg;
    out.push(Math.max(0, base * Math.pow(drift, Math.min(2, step / seasonLength))));
  }
  return out;
}

/** Weighted absolute percentage error — volume-weighted, robust to zero days. */
function wape(actual: number[], predicted: number[]): number {
  let error = 0;
  let scale = 0;
  for (let i = 0; i < Math.min(actual.length, predicted.length); i += 1) {
    const p = Number.isFinite(predicted[i]) ? predicted[i] : 0;
    error += Math.abs(actual[i] - p);
    scale += Math.abs(actual[i]);
  }
  return scale > 0 ? (error / scale) * 100 : 100;
}

interface BacktestResult {
  transform: Transform;
  hwError: number;
  naiveError: number;
  weight: number;
  ensembleError: number;
}

function backtest(values: number[], seasonLength: number, holdout: number, transform: Transform): BacktestResult {
  const transformed = values.map(transform.apply);
  const train = transformed.slice(0, transformed.length - holdout);
  const test = transformed.slice(transformed.length - holdout);

  let hwError = 100;
  let naiveError = 100;
  const actual = test.map(transform.invert);

  if (train.length >= seasonLength * 2) {
    const model = holtWinters(train, seasonLength);
    if (model) {
      const predicted = project(model, train.length, holdout, seasonLength).map(transform.invert);
      hwError = wape(actual, predicted);
    }
    naiveError = wape(actual, seasonalNaive(train, seasonLength, holdout).map(transform.invert));
  }

  const safe = (value: number) => Math.max(2, Math.min(90, value));
  const invHw = 1 / safe(hwError);
  const invNaive = 1 / safe(naiveError);
  const weight = invHw / (invHw + invNaive);

  return {
    transform,
    hwError,
    naiveError,
    weight,
    ensembleError: weight * hwError + (1 - weight) * naiveError,
  };
}

export function buildForecast(daily: { date: string; value: number }[], horizon = 7): ForecastResult {
  const values = daily.map((point) => point.value);
  const seasonLength = values.length >= 21 ? 7 : values.length >= 9 ? 3 : 2;
  const holdout = Math.max(2, Math.min(7, Math.floor(values.length * 0.2)));

  // ── 1. Pick the best transform × blend by true hold-out error ────────────
  const candidates = TRANSFORMS.map((transform) => backtest(values, seasonLength, holdout, transform));
  const best = candidates.reduce((winner, candidate) =>
    candidate.ensembleError < winner.ensembleError ? candidate : winner,
  );
  const transform = best.transform;
  const weight = best.weight;

  // ── 2. Refit on the full series in the winning space ────────────────────
  const transformed = values.map(transform.apply);
  const model = holtWinters(transformed, seasonLength);
  const hwForecast = model ? project(model, transformed.length, horizon, seasonLength) : [];
  const naiveForecast = seasonalNaive(transformed, seasonLength, horizon);

  const residualStd = model
    ? Math.sqrt(
        transformed.reduce((sum, value, index) => sum + (value - (model.fitted[index] ?? value)) ** 2, 0) /
          Math.max(transformed.length, 1),
      )
    : Math.max(...transformed, 1) * 0.3;

  const lastDate = daily.at(-1) ? new Date(daily.at(-1)!.date) : new Date();
  const forecast: ForecastPoint[] = [];
  for (let step = 1; step <= horizon; step += 1) {
    const blended =
      weight * (hwForecast[step - 1] ?? naiveForecast[step - 1] ?? 0) + (1 - weight) * (naiveForecast[step - 1] ?? 0);
    const widen = residualStd * Math.sqrt(step) * 1.28;
    const date = new Date(lastDate);
    date.setDate(date.getDate() + step);
    forecast.push({
      date: date.toISOString().slice(0, 10),
      value: Math.max(0, Math.round(transform.invert(blended))),
      lower: Math.max(0, Math.round(transform.invert(blended - widen))),
      upper: Math.round(transform.invert(blended + widen)),
      kind: 'forecast',
    });
  }

  // Report the trend in original units (per day, evaluated at today's level).
  const trendPerDay = model
    ? transform.invert(model.level + model.trend) - transform.invert(model.level)
    : 0;

  const ensembleError = Number(best.ensembleError.toFixed(1));
  const confidence: ForecastResult['confidence'] =
    ensembleError <= 15 ? 'high' : ensembleError <= 30 ? 'medium' : 'low';

  const blend =
    weight >= 0.95
      ? 'Holt-Winters'
      : weight <= 0.05
        ? 'seasonal-naive'
        : `Holt-Winters ${(weight * 100).toFixed(0)}% + seasonal-naive ${(100 - weight * 100).toFixed(0)}%`;
  const modelName = `${transform.name === 'log1p' ? 'Log-linear ' : ''}${blend} (m=${seasonLength})`;

  return {
    history: daily.map((point) => ({ ...point, kind: 'actual' as const })),
    forecast,
    errorPct: ensembleError,
    baselineErrorPct: Number(Math.max(best.hwError, best.naiveError).toFixed(1)),
    errorMetric: 'WAPE',
    ensembleWeight: Number(weight.toFixed(3)),
    seasonality: seasonLength,
    trendPerDay: Number(trendPerDay.toFixed(2)),
    confidence,
    model: modelName,
    transform: transform.name,
  };
}

/**
 * Revenue forecasting by decomposition: revenue ≈ orders × average order value.
 *
 * Orders carry the volatile weekly pattern; AOV drifts slowly, so forecasting
 * both separately and multiplying is far more stable than fitting raw revenue
 * (whose spikes are single large bill payments). The composite error combines
 * both component errors (independent-error approximation).
 */
export function buildRevenueForecast(
  revenueDaily: { date: string; value: number }[],
  orderDaily: { date: string; value: number }[],
  horizon = 7,
): ForecastResult & { components: { orders: ForecastResult; aov: ForecastResult } } {
  const orderForecast = buildForecast(orderDaily, horizon);

  // Average order value per day, smoothed with a 14-day trailing window.
  const aovSeries = revenueDaily.map((point, index) => ({
    date: point.date,
    value: Number((point.value / Math.max(1, orderDaily[index]?.value ?? 1)).toFixed(3)),
  }));
  const aovSmoothed = aovSeries.map((point, index) => {
    const window = aovSeries.slice(Math.max(0, index - 13), index + 1);
    const mean = window.reduce((sum, entry) => sum + entry.value, 0) / window.length;
    return { date: point.date, value: Number(mean.toFixed(3)) };
  });
  const aovForecast = buildForecast(aovSmoothed, horizon);

  const forecast: ForecastPoint[] = orderForecast.forecast.map((point, index) => {
    const aov = aovForecast.forecast[index];
    const value = point.value * (aov?.value ?? 0);
    return {
      date: point.date,
      value: Math.round(value),
      lower: Math.round((point.lower ?? point.value) * (aov?.lower ?? aov?.value ?? 0)),
      upper: Math.round((point.upper ?? point.value) * (aov?.upper ?? aov?.value ?? 0)),
      kind: 'forecast' as const,
    };
  });

  const errorPct = Number(Math.sqrt(orderForecast.errorPct ** 2 + aovForecast.errorPct ** 2).toFixed(1));
  const baselineErrorPct = Number(
    Math.sqrt(orderForecast.baselineErrorPct ** 2 + aovForecast.baselineErrorPct ** 2).toFixed(1),
  );
  const confidence: ForecastResult['confidence'] = errorPct <= 15 ? 'high' : errorPct <= 30 ? 'medium' : 'low';

  return {
    history: revenueDaily.map((point) => ({ ...point, kind: 'actual' as const })),
    forecast,
    errorPct,
    baselineErrorPct,
    errorMetric: 'WAPE',
    ensembleWeight: orderForecast.ensembleWeight,
    seasonality: orderForecast.seasonality,
    trendPerDay: Number((orderForecast.trendPerDay * (aovForecast.forecast[0]?.value ?? 0)).toFixed(2)),
    confidence,
    model: `Composite revenue = orders × AOV · ${orderForecast.model} × smoothed AOV`,
    transform: orderForecast.transform,
    components: { orders: orderForecast, aov: aovForecast },
  };
}

/** Fill missing calendar days with zeros so seasonality stays aligned. */
export function densifyDaily(
  rows: { date: string; value: number }[],
  days: number,
): { date: string; value: number }[] {
  const byDate = new Map(rows.map((row) => [row.date, row.value]));
  const out: { date: string; value: number }[] = [];
  const today = new Date();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    out.push({ date: key, value: byDate.get(key) ?? 0 });
  }
  return out;
}
