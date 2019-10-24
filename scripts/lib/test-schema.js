require('dotenv').config();
const path = require('path');
const firstLine = require('firstline');
const { pool } = require('../../src/lib/connectors/db');

const SCHEMA_NAME = 'water_import_test';

const exitWithError = error => {
  console.error(error);
  process.exit(1);
};

const dropSchema = async () => {
  const { error } = await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA_NAME} CASCADE;`);
  if (error) {
    exitWithError(error);
  }
};

const createSchema = async () => {
  const { error } = await pool.query(`CREATE SCHEMA IF NOT EXISTS water_import_test;`);
  if (error) {
    exitWithError(error);
  }
};

/**
 * Gets the CSV column headings from the specified .csv file
 * @param {String} csvFile
 * @return {Promise<Array>} resolves with an array of CSV column names
 */
const getCSVFields = async filePath => {
  const fields = await firstLine(filePath);
  return fields.split(',');
};

const mapField = field => `"${field}" character varying`;

/**
 * Imports dummy NALD data to a temporary test schema
 * @param {String} csvFile
 * @return {Promise}
 */
const importCsv = async csvFile => {
  const filePath = path.join(__dirname, '../', csvFile);
  const tableName = path.basename(csvFile, '.csv');
  const fields = await getCSVFields(filePath);

  // Create table
  const createQuery = `CREATE TABLE ${SCHEMA_NAME}."${tableName}" (
    ${fields.map(mapField).join(',')}
  );`;
  await pool.query(createQuery);

  // Import data from CSV
  const importQuery = `copy ${SCHEMA_NAME}."${tableName}" FROM '${filePath}' HEADER DELIMITER ',' CSV;`;
  return pool.query(importQuery);
};

exports.dropSchema = dropSchema;
exports.createSchema = createSchema;
exports.importCsv = importCsv;
