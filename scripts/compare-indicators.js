const fs = require('node:fs');

const {
  compareIndicatorSnapshot,
  getLastValues
} = require('../src/indicators/compare');

function main() {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.log(JSON.stringify({
      ok: false,
      error: 'Usage: npm run compare:indicators -- <input.json>'
    }));
    process.exitCode = 1;
    return;
  }

  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const actual = input.actualRows ? getLastValues(input.actualRows, input.fields) : input.actual;
  const expected = input.expectedRows ? getLastValues(input.expectedRows, input.fields) : input.expected;
  const result = compareIndicatorSnapshot(actual, expected, {
    fields: input.fields,
    tolerance: input.tolerance
  });

  console.log(JSON.stringify({
    ok: result.pass,
    actual,
    expected,
    result
  }, null, 2));

  if (!result.pass) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};
