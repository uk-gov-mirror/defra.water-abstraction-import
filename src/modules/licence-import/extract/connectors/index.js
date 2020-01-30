const { pool } = require('../../../../lib/connectors/db');
const queries = require('./queries');

const findOne = async (query, params) => {
  const { rows: [row] } = await pool.query(query, params);
  return row;
};

const findMany = async (query, params) => {
  const { rows } = await pool.query(query, params);
  return rows;
};

const getLicence = licenceNumber =>
  findOne(queries.getLicence, [licenceNumber]);

const getLicenceVersions = (regionCode, licenceId) =>
  findMany(queries.getLicenceVersions, [regionCode, licenceId]);

const getAllParties = () => findMany(queries.getAllParties);

const getAllAddresses = () => findMany(queries.getAllAddresses);

const getChargeVersions = (regionCode, licenceId) =>
  findMany(queries.getChargeVersions, [regionCode, licenceId]);

const getTwoPartTariffAgreements = (regionCode, licenceId) =>
  findMany(queries.getTwoPartTariffAgreements, [regionCode, licenceId]);

const getSection130Agreements = (regionCode, licenceId) =>
  findMany(queries.getSection130Agreements, [regionCode, licenceId]);

const getInvoiceAccounts = (regionCode, partyId) =>
  findMany(queries.getInvoiceAccounts, [regionCode, partyId]);

const getPartyLicenceVersions = (regionCode, partyId) =>
  findMany(queries.getPartyLicenceVersions, [regionCode, partyId]);

const getParties = (regionCode, partyIds = []) =>
  findMany(queries.getParties, [regionCode, partyIds.join(',')]);

const getAddresses = (regionCode, addressIds = []) =>
  findMany(queries.getAddresses, [regionCode, addressIds.join(',')]);

const getAllLicenceNumbers = () =>
  findMany(queries.getAllLicenceNumbers);

const getParty = (regionCode, partyId) =>
  findOne(queries.getParty, [regionCode, partyId]);

exports.getLicence = getLicence;
exports.getLicenceVersions = getLicenceVersions;
exports.getChargeVersions = getChargeVersions;
exports.getAllAddresses = getAllAddresses;
exports.getAllParties = getAllParties;
exports.getTwoPartTariffAgreements = getTwoPartTariffAgreements;
exports.getSection130Agreements = getSection130Agreements;
exports.getInvoiceAccounts = getInvoiceAccounts;
exports.getPartyLicenceVersions = getPartyLicenceVersions;
exports.getParties = getParties;
exports.getAddresses = getAddresses;
exports.getAllLicenceNumbers = getAllLicenceNumbers;
exports.getParty = getParty;