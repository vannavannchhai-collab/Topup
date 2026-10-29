/**
 * Demand forecasting engine.
 *
 * Strategy: generate two complementary predictors —
 *   1. additive Holt-Winters (triple exponential smoothing) for level + trend + seasonality
 *   2. a Seasonal-Naive baseline ("same weekday last week, grown by recent drift")
 * then blend them by inverse hold-out error (MAPE) measured on a true
 * out-of-sample window. This is robust when the series is noisy (which retail
 * top-up demand always is) and self-documents which model won.
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
  mape: number;
  baselineMape: number;
  ensembleWeight: number;
  seasonality: number;
  trendPerDay: number;
  confidence: 'high' | 'medium' | 'low';
  model: string;
}

interface Smoothed {
  level: number;
  trend: number;
  seasonal: number[];
  fitted: number[];
}

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
  let trend = (series[Math.min(seasonLength, series.length - 1)] - series[0]) / Math.min(seasonLength, series.length - 1);
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

  // If the series ends with a systematic bias, fold half of it into the level
  // so short horizons do not inherit a lag.
  const bias = recentErrors.reduce((a, b) => a + b, 0) / Math.max(recentErrors.length, 1);
  level += bias * 0.5;

  return { level, trend, seasonal: centred, fitted };
}

export function project(model: Smoothed, startIndex: number, steps: number, seasonLength: number): number[] {
  const out: number[] = [];
  for (let step = 1; step <= steps; step += 1) {
    out.push(
      model.level + model.trend * step + (model.seasonal[(startIndex + step - 1) % seasonLength] ?? 0),
    );
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

function mape(actual: number[], predicted: number[]): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < Math.min(actual.length, predicted.length); i += 1) {
    const a = actual[i];
    const p = predicted[i];
    if (a > 0 && Number.isFinite(p)) {
      sum += Math.abs((a - p) / a);
      count += 1;
    }
  }
  return count ? (sum / count) * 100 : 100;
}

export function buildForecast(daily: { date: string; value: number }[], horizon = 7): ForecastResult {
  const values = daily.map((point) => point.value);
  const seasonLength = values.length >= 21 ? 7 : values.length >= 9 ? 3 : 2;

  // ── Backtest: train on everything but the tail, predict the tail ─────────
  const holdout = Math.max(2, Math.min(7, Math.floor(values.length * 0.2)));
  const train = values.slice(0, values.length - holdout);
  const test = values.slice(values.length - holdout);

  let hwMape = 100;
  let naiveMape = 100;

  if (train.length >= seasonLength * 2) {
    const model = holtWinters(train, seasonLength);
    if (model) hwMape = mape(test, project(model, train.length, holdout, seasonLength));
    naiveMape = mape(test, seasonalNaive(train, seasonLength, holdout));
  }

  const safe = (value: number) => Math.max(2, Math.min(90, value));
  const invHw = 1 / safe(hwMape);
  const invNaive = 1 / safe(naiveMape);
  const weight = Number((invHw / (invHw + invNaive)).toFixed(3));

  // Blended hold-out error for honest reporting.
  const ensembleMape = Number((weight * hwMape + (1 - weight) * naiveMape).toFixed(1));

  // ── Refit on the full series for the live forecast ──────────────────────
  const model = holtWinters(values, seasonLength);
  const hwForecast = model ? project(model, values.length, horizon, seasonLength) : [];
  const naiveForecast = seasonalNaive(values, seasonLength, horizon);

  const residualStd = model
    ? Math.sqrt(
        values.reduce((sum, value, index) => sum + (value - (model.fitted[index] ?? value)) ** 2, 0) /
          Math.max(values.length, 1),
      )
    : Math.max(...values, 1) * 0.3;

  const lastDate = daily.at(-1) ? new Date(daily.at(-1)!.date) : new Date();
  const forecast: ForecastPoint[] = [];
  for (let step = 1; step <= horizon; step += 1) {
    const blended =
      weight * (hwForecast[step - 1] ?? naiveForecast[step - 1] ?? 0) +
      (1 - weight) * (naiveForecast[step - 1] ?? 0);
    const widen = residualStd * Math.sqrt(step) * 1.28;
    const date = new Date(lastDate);
    date.setDate(date.getDate() + step);
    forecast.push({
      date: date.toISOString().slice(0, 10),
      value: Math.max(0, Math.round(blended)),
      lower: Math.max(0, Math.round(blended - widen)),
      upper: Math.round(blended + widen),
      kind: 'forecast',
    });
  }

  const trendPerDay = model?.trend ?? 0;
  const confidence: ForecastResult['confidence'] =
    ensembleMape <= 12 ? 'high' : ensembleMape <= 25 ? 'medium' : 'low';

  const modelName =
    weight >= 0.95
      ? `Holt-Winters (α=0.32, β=0.08, γ=0.28, m=${seasonLength})`
      : weight <= 0.05
        ? `Seasonal naive with drift (m=${seasonLength})`
        : `Ensemble · Holt-Winters ${(weight * 100).toFixed(0)}% + seasonal-naive ${(100 - weight * 100).toFixed(0)}%`;

  return {
    history: daily.map((point) => ({ ...point, kind: 'actual' as const })),
    forecast,
    mape: ensembleMape,
    baselineMape: Number(Math.max(hwMape, naiveMape).toFixed(1)),
    ensembleWeight: weight,
    seasonality: seasonLength,
    trendPerDay: Number(trendPerDay.toFixed(2)),
    confidence,
    model: modelName,
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
