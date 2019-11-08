const cron = require('node-cron');
const jobs = require('./jobs');
const handlers = require('./handlers');
const isImportTarget = ['local', 'dev', 'development', 'test', 'preprod'].includes(process.env.NODE_ENV);

const importOptions = {
  teamSize: 1000,
  teamConcurrency: 5
};

const register = async server => {
  if (!isImportTarget) {
    return;
  }

  const { messageQueue } = server;

  await messageQueue.subscribe(jobs.IMPORT_COMPANY_JOB, importOptions, handlers.importCompany);
  await messageQueue.subscribe(jobs.IMPORT_LICENCES_JOB, handlers.importLicences);
  await messageQueue.subscribe(jobs.IMPORT_LICENCE_JOB, importOptions, handlers.importLicence);

  // Set up cron job to import companies daily at 4am
  cron.schedule('0 0 4 1/1 * * *', async () => {
    await messageQueue.publish(...jobs.importLicences());
  });
};

exports.plugin = {
  name: 'importSchedule',
  register
};
