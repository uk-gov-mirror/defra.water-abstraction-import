'use strict';

const {
  experiment,
  test,
  beforeEach,
  afterEach
} = exports.lab = require('@hapi/lab').script();

const { expect } = require('@hapi/code');
const sandbox = require('sinon').createSandbox();

const { lines, returns, versions } = require('../../../src/lib/connectors/returns');
const controller = require('../../../src/modules/returns/controller');

experiment('modules/returns/controller', () => {
  beforeEach(async () => {
    sandbox.stub(returns, 'findMany').resolves({
      data: [
        {
          metadata: {
            nald: {
              regionCode: '1',
              formatId: 2
            }
          }
        }
      ]
    });

    sandbox.stub(versions, 'findMany').resolves({
      data: [
        { return_id: 'test-return-id', nil_return: false }
      ]
    });

    sandbox.stub(lines, 'findMany').resolves({ data: [] });
  });

  afterEach(async () => {
    sandbox.restore();
  });

  experiment('.getLinesForVersion', () => {
    let request;

    beforeEach(async () => {
      request = {
        params: {
          versionID: 'test-version-id'
        }
      };
    });

    test('throws a notFound if no version data returned', async () => {
      versions.findMany.resolves({ data: [] });
      const error = await expect(controller.getLinesForVersion(request)).to.reject();

      expect(error.isBoom).to.equal(true);
      expect(error.output.payload.statusCode).to.equal(404);
      expect(error.output.payload.message).to.equal('Data not found for test-version-id');
    });

    test('throws a notFound if no return data returned', async () => {
      returns.findMany.resolves({ data: [] });
      const error = await expect(controller.getLinesForVersion(request)).to.reject();

      expect(error.isBoom).to.equal(true);
      expect(error.output.payload.statusCode).to.equal(404);
      expect(error.output.payload.message).to.equal('Data not found for test-return-id');
    });

    test('returns the expected response when data is present', async () => {
      const response = await controller.getLinesForVersion(request);
      expect(response.error).to.equal(null);
      expect(response.data.nil_return).to.equal(false);
      expect(response.data.under_query).to.equal(false);
      expect(response.data.under_query_comment).to.equal('');
      expect(response.data.return.under_query_comment).to.equal('');
      expect(response.data.return.regionCode).to.equal('1');
      expect(response.data.return.formatId).to.equal(2);
      expect(response.data.lines).to.equal([]);
    });
  });
});
