const cron = require('node-cron');
const jobs = require('./jobs');

const chargingImport = require('./lib/import');
const { createRegister } = require('../../lib/plugin');
const config = require('../../../config');

const registerSubscribers = async server => {
  // Import charging data
  await server.messageQueue.subscribe(jobs.IMPORT_CHARGING_DATA, chargingImport.importChargingData);

  cron.schedule(config.import.charging.schedule, async () => {
    await server.messageQueue.publish(jobs.importChargingData());
  });
};

exports.plugin = {
  name: 'importChargingData',
  dependencies: ['pgBoss'],
  register: server => createRegister(server, registerSubscribers)
};
