const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const INCLUDED_DIRS = ['src', 'tests', 'scripts'];

function collectJsFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

function main() {
  const files = INCLUDED_DIRS
    .map((dirName) => path.join(ROOT, dirName))
    .filter((dirPath) => fs.existsSync(dirPath))
    .flatMap(collectJsFiles);

  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], {
      encoding: 'utf8'
    });

    if (result.status !== 0) {
      process.stderr.write(result.stderr || result.stdout);
      process.exitCode = result.status || 1;
      return;
    }
  }

  console.log(`Syntax check passed for ${files.length} JavaScript files.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  collectJsFiles
};
