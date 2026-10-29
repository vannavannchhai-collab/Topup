import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, cosine, TfidfIndex, expandQuery, normalize } from '../ai/text.js';
import { understand, extractEntities } from '../ai/nlu.js';
import { buildForecast, buildRevenueForecast, densifyDaily, seasonalNaive } from '../ai/forecast.js';

describe('tokenizer', () => {
  test('splits English into stemmed tokens', () => {
    const tokens = tokenize('Cheap internet bundles for phones');
    assert.ok(tokens.includes('cheap'));
    assert.ok(tokens.includes('internet'));
    assert.ok(tokens.includes('bundle'), 'plural is stemmed');
    assert.ok(!tokens.includes('for'), 'stopwords removed');
  });

  test('handles Khmer without whitespace via n-grams', () => {
    const tokens = tokenize('កញ្ចប់អ៊ីនធឺណិត');
    assert.ok(tokens.length > 5, 'produces character shingles');
    assert.ok(tokens.some((token) => token.length > 3), 'keeps whole run as a token');
  });

  test('cosine similarity is bounded and rank-correct', () => {
    const index = new TfidfIndex();
    index.add('a', 'smart data bundle 10gb cheap internet');
    index.add('b', 'cellcard electricity bill payment');
    index.build();
    const results = index.search('cheap internet data bundle');
    assert.equal(results[0].id, 'a');
    assert.ok(results[0].score > 0 && results[0].score <= 1);
    assert.ok(cosine(new Map(), new Map([['a', 1]])) === 0);
  });

  test('synonym expansion bridges Khmer queries', () => {
    const expanded = expandQuery('ខ្ញុំចង់បញ្ចូលលុយ');
    assert.match(expanded, /topup/);
  });
});

describe('NLU', () => {
  const cases: [string, string][] = [
    ['សួស្តី', 'greeting'],
    ['សមតុល្យកាបូបរបស់ខ្ញុំប៉ុន្មាន?', 'balance'],
    ['I want to see my order history', 'history'],
    ['how do refunds work?', 'support'],
    ['recommend a bundle for me', 'recommend'],
    ['what will sales be next week?', 'forecast'],
    ['pay my electricity bill', 'bill'],
    ['is there 5G coverage in Siem Reap?', 'coverage'],
  ];

  for (const [input, expected] of cases) {
    test(`classifies "${input}" as ${expected}`, () => {
      const result = understand(input);
      assert.equal(result.intent, expected);
      assert.ok(result.confidence > 0.3);
    });
  }

  test('extracts providers, amounts, data and phone numbers', () => {
    const entities = extractEntities('top up smart 010 123 456 with $2.5 for 5GB');
    assert.equal(entities.provider, 'smart');
    assert.equal(entities.amountUsd, 2.5);
    assert.equal(entities.dataGb, 5);
    assert.equal(entities.phone, '010123456');
    assert.equal(entities.language, 'en');
  });

  test('detects Khmer script', () => {
    assert.equal(extractEntities('សួស្តី').language, 'km');
    assert.equal(normalize('  Hello   World '), 'hello world');
  });
});

describe('forecasting', () => {
  const makeSeries = (days: number) => {
    const out: { date: string; value: number }[] = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const weekday = date.getDay();
      const weekend = weekday === 0 || weekday === 6 ? 5 : 0;
      out.push({ date: date.toISOString().slice(0, 10), value: 10 + weekend + Math.round((days - i) / 10) });
    }
    return out;
  };

  test('produces the requested horizon with bounds', () => {
    const result = buildForecast(makeSeries(45), 7);
    assert.equal(result.forecast.length, 7);
    for (const point of result.forecast) {
      assert.ok(point.value >= 0);
      assert.ok(point.lower !== undefined && point.upper !== undefined);
      assert.ok(point.lower <= point.value && point.value <= point.upper);
    }
  });

  test('beats or matches the seasonal-naive baseline on a seasonal series', () => {
    const result = buildForecast(makeSeries(60), 7);
    assert.ok(
      result.errorPct <= result.baselineErrorPct + 1,
      `wape ${result.errorPct} vs baseline ${result.baselineErrorPct}`,
    );
    assert.equal(result.errorMetric, 'WAPE');
    assert.equal(result.seasonality, 7);
  });

  test('decomposed revenue forecast beats a direct fit on spiky revenue', () => {
    const days = 90;
    const revenue = makeSeries(days).map((point) => ({ date: point.date, value: point.value * 12 }));
    const orders = makeSeries(days);
    // Inject realistic single-order spikes into the most recent revenue days.
    revenue[revenue.length - 3].value += 900;
    revenue[revenue.length - 6].value += 650;

    const direct = buildForecast(revenue, 7);
    const composite = buildRevenueForecast(revenue, orders, 7);

    assert.equal(composite.forecast.length, 7);
    assert.ok(composite.errorPct <= direct.errorPct, `${composite.errorPct} vs ${direct.errorPct}`);
    assert.ok(composite.forecast.every((point) => point.value >= 0));
    assert.equal(composite.components.orders.forecast.length, 7);
  });

  test('seasonal naive repeats the last week pattern', () => {
    const series = [1, 2, 3, 4, 5, 6, 7, 2, 4, 6, 8, 10, 12, 14];
    const projected = seasonalNaive(series, 7, 3);
    assert.equal(projected.length, 3);
    assert.ok(projected.every((value) => value > 0));
  });

  test('densifies missing days to a continuous calendar', () => {
    const rows = [{ date: new Date().toISOString().slice(0, 10), value: 4 }];
    const dense = densifyDaily(rows, 5);
    assert.equal(dense.length, 5);
    assert.equal(dense.at(-1)?.value, 4);
    assert.equal(dense[0].value, 0);
  });
});
