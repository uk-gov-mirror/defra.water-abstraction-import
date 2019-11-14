const { sortBy, get, identity, groupBy } = require('lodash');
const date = require('./date');
const roles = require('./roles');

/**
 * Gets the end date for a company address from licence version data
 * @param {Object} row - from NALD licence/licence version data
 * @param {String,Null} currentEnd - the current value of the end date in the accumulator
 */
const getEndDate = (row, currentEnd) => {
  // Get all end dates for this row
  const endDates = [row.EFF_END_DATE, row.EXPIRY_DATE, row.REV_DATE, row.LAPSED_DATE]
    .map(date.mapNaldDate)
    .filter(identity);

  const arr = [date.getMinDate(endDates), currentEnd];

  return arr.includes(null) ? null : date.getMaxDate(arr);
};

const getLicenceHolderAddresses = (licenceVersions, context) => {
  // Sort licence versions by start date
  const sorted = sortBy(licenceVersions, row => date.mapNaldDate(row.EFF_ST_DATE));

  // Get the widest date range for each address
  const mapped = sorted.reduce((acc, row) => {
    const currentStart = get(acc, `${row.ACON_AADD_ID}.startDate`);
    const currentEnd = get(acc, `${row.ACON_AADD_ID}.endDate`);

    acc[row.ACON_AADD_ID] = {
      role: roles.ROLE_LICENCE_HOLDER,
      startDate: date.getMinDate([date.mapNaldDate(row.EFF_ST_DATE), currentStart]),
      endDate: getEndDate(row, currentEnd),
      address: context.addresses[row.FGAC_REGION_CODE][row.ACON_AADD_ID]
    };

    return acc;
  }, {});

  return Object.values(mapped);
};

const getBillingAddresses = (chargeVersions, context) => {
  const grouped = groupBy(chargeVersions, row => row.ACON_AADD_ID);
  return Object.values(grouped).map(addressGroup => {
    const { FGAC_REGION_CODE: regionCode, ACON_AADD_ID: addressId } = addressGroup[0];
    const dates = addressGroup.map(row => date.mapTransferDate(row.IAS_XFER_DATE));
    return {
      role: roles.ROLE_BILLING,
      startDate: date.getMinDate(dates),
      endDate: null,
      address: context.addresses[regionCode][addressId]
    };
  });
};

/**
 * Gets the end date for a company address from licence version data
 * @param {Array<Object>} licenceVersions - from NALD licence/licence version data
 * @param {Object} context - contains company/contact/address data
 * @return {Array} an array of company addresses
 */
const mapCompanyAddresses = (licenceVersions, chargeVersions, context) => {
  return [
    ...getLicenceHolderAddresses(licenceVersions, context),
    ...getBillingAddresses(chargeVersions, context)
  ];
};

exports.mapCompanyAddresses = mapCompanyAddresses;
