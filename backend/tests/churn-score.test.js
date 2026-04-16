// backend/tests/churn-score.test.js
const { computeChurnScore, WEIGHT_MAP } = require('../src/services/churn-score-service');

describe('computeChurnScore', () => {
  test('returns 0 for empty inputs', () => {
    expect(computeChurnScore({}, {})).toBe(0);
  });

  test('returns 0 for loyal low-contact customer', () => {
    const signal = { contact_count: 0, escalation_count: 0, avg_sentiment_score: 1.0 };
    const core   = { trust_level: 'loyal_advocate', escalation_pattern: 'never_escalated' };
    expect(computeChurnScore(signal, core)).toBe(0);
  });

  test('returns high score for at-risk customer', () => {
    const signal = { contact_count: 12, escalation_count: 6, avg_sentiment_score: 0.1, last_contact_at: new Date() };
    const core   = { trust_level: 'at_risk', escalation_pattern: 'threatens_cancel' };
    expect(computeChurnScore(signal, core)).toBeGreaterThan(60);
  });

  test('clamps at 100', () => {
    const signal = { contact_count: 20, escalation_count: 10, avg_sentiment_score: 0, last_contact_at: new Date() };
    const core   = { trust_level: 'at_risk', escalation_pattern: 'threatens_cancel' };
    expect(computeChurnScore(signal, core)).toBe(100);
  });

  test('lower sentiment increases score', () => {
    const low  = computeChurnScore({ avg_sentiment_score: 0.1 }, {});
    const high = computeChurnScore({ avg_sentiment_score: 0.9 }, {});
    expect(low).toBeGreaterThan(high);
  });

  test('recent contact adds recency pts', () => {
    const withRecent    = computeChurnScore({ last_contact_at: new Date() }, {});
    const withoutRecent = computeChurnScore({}, {});
    expect(withRecent).toBeGreaterThan(withoutRecent);
  });

  test('WEIGHT_MAP is exported', () => {
    expect(WEIGHT_MAP).toBeDefined();
    expect(WEIGHT_MAP.escalation_tiers).toBeDefined();
  });
});
