const DEFAULT_INDICATOR_TOLERANCE = 0.000001;

function isComparableNumber(value) {
  return Number.isFinite(value);
}

function compareNumber({ actual, expected, tolerance = DEFAULT_INDICATOR_TOLERANCE }) {
  if (!isComparableNumber(actual) || !isComparableNumber(expected)) {
    return {
      pass: actual === expected,
      actual,
      expected,
      diff: null,
      tolerance
    };
  }

  const diff = Math.abs(actual - expected);

  return {
    pass: diff <= tolerance,
    actual,
    expected,
    diff,
    tolerance
  };
}

function compareIndicatorSnapshot(actual, expected, options = {}) {
  const tolerance = options.tolerance ?? DEFAULT_INDICATOR_TOLERANCE;
  const fields = options.fields || Object.keys(expected);
  const comparisons = {};

  for (const field of fields) {
    comparisons[field] = compareNumber({
      actual: actual[field],
      expected: expected[field],
      tolerance
    });
  }

  return {
    pass: Object.values(comparisons).every((comparison) => comparison.pass),
    comparisons
  };
}

function getLastValues(rows, fields) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {};
  }

  const last = rows[rows.length - 1];

  if (!fields) {
    return { ...last };
  }

  return Object.fromEntries(fields.map((field) => [field, last[field]]));
}

module.exports = {
  DEFAULT_INDICATOR_TOLERANCE,
  compareIndicatorSnapshot,
  compareNumber,
  getLastValues
};
