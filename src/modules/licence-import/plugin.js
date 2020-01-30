const cron = require('node-cron');
const jobs = require('./jobs');
const handlers = require('./handlers');
const { logger } = require('../../logger');

const isImportTarget = () =>
  ['local', 'dev', 'development', 'test', 'preprod'].includes(process.env.NODE_ENV);

const getOptions = () => ({
  teamSize: 1000,
  teamConcurrency: 5
});

const registerSubscribers = async server => {
  // The first step is to import a list of all companies into the water_import.company_import table
  await server.messageQueue.subscribe(jobs.IMPORT_COMPANIES_JOB, handlers.importCompanies);

  // When the water_import.company_import table is ready, jobs are scheduled to import each company
  await server.messageQueue.onComplete(jobs.IMPORT_COMPANIES_JOB,
    job => handlers.onCompleteImportCompanies(server.messageQueue, job)
  );

  // Import licenced when all companies are imported
  await server.messageQueue.onComplete(jobs.IMPORT_COMPANY_JOB,
    job => handlers.onCompleteImportCompany(server.messageQueue, job)
  );

  await server.messageQueue.subscribe(jobs.IMPORT_COMPANY_JOB, getOptions(), handlers.importCompany);
  await server.messageQueue.subscribe(jobs.IMPORT_LICENCES_JOB, handlers.importLicences);
  await server.messageQueue.subscribe(jobs.IMPORT_LICENCE_JOB, getOptions(), handlers.importLicence);

  // Set up cron job to import companies daily at 4am
  cron.schedule('0 0 4 1/1 * * *', async () => {
    await server.messageQueue.publish(jobs.importCompanies());
  });
};

const register = server => {
  if (!isImportTarget()) {
    logger.info(`Aborting import, environment is: ${process.env.NODE_ENV}`);
    return;
  }
  return registerSubscribers(server);
};

exports.plugin = {
  name: 'importSchedule',
  register
};