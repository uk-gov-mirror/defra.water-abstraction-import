'use strict';

const constants = require('./lib/constants');

const postImportBillRuns = async request => {
  for (let regionCode = 1; regionCode <= 8; regionCode++) {
    await request.messageQueue.publish(constants.IMPORT_BILL_RUNS, { regionCode });
  }

  return {
    error: null
  };
};

exports.postImportBillRuns = postImportBillRuns;
