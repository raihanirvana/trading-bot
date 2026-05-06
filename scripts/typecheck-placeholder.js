function main() {
  console.log('Typecheck skipped: plain JavaScript project has no TypeScript config yet.');
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};
