const testSchema = require('./lib/test-schema');

const run = async () => {
  await testSchema.dropSchema();
  await testSchema.createSchema();
  await testSchema.importCsv('./csv/NALD_ABS_LICENCES.csv');
  await testSchema.importCsv('./csv/NALD_ABS_LIC_VERSIONS.csv');
  console.log('Created test schema');
  process.exit(0);
};

run();
