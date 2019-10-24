const testSchema = require('./lib/test-schema');

const run = async () => {
  await testSchema.dropSchema();
  console.log('Dropped test schema');
  process.exit(0);
};

run();
