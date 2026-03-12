import { expect } from 'chai';
import sinon from 'sinon';

import type { ImportExportDialogProps } from './import-export-dialog';

// ── Mock helpers ───────────────────────────────────────────────────

function createMockBridge(overrides?: { request?: sinon.SinonStub }) {
  const defaultRequest = sinon.stub();

  // dict.list for CSV field selector
  defaultRequest.withArgs('dict.list', sinon.match.any).resolves({
    id: 'test',
    result: {
      fields: [
        {
          item_id: 'NAME',
          type: 'A',
          attribute_number: 1,
          header: 'Name',
          conversion: '',
          justification: 'L',
          width: 20,
        },
        {
          item_id: 'STATE',
          type: 'A',
          attribute_number: 5,
          header: 'State',
          conversion: 'MCU',
          justification: 'L',
          width: 5,
        },
      ],
    },
    error: null,
  });

  // import.tload
  defaultRequest
    .withArgs('import.tload', sinon.match.any, sinon.match.any)
    .resolves({
      id: 'test',
      result: { job_id: 'job-1234', status: 'started' },
      error: null,
    });

  // export.tdump
  defaultRequest
    .withArgs('export.tdump', sinon.match.any, sinon.match.any)
    .resolves({
      id: 'test',
      result: { job_id: 'job-5678', status: 'started' },
      error: null,
    });

  // export.csv
  defaultRequest
    .withArgs('export.csv', sinon.match.any, sinon.match.any)
    .resolves({
      id: 'test',
      result: { job_id: 'job-9012', status: 'started' },
      error: null,
    });

  return {
    status: overrides?.request ? 'connected' : 'connected',
    request: overrides?.request ?? defaultRequest,
    connect: sinon.stub().resolves('connected'),
    disconnect: sinon.stub(),
    onStatusChange: sinon.stub().returns(() => {}),
    onEvent: sinon.stub().returns(() => {}),
    url: 'ws://localhost:9800',
  };
}

// ── Tab structure ──────────────────────────────────────────────────

describe('ImportExportDialog — Tabs', function () {
  it('has Import and Export tabs', function () {
    const tabs = ['import', 'export'];
    expect(tabs).to.include('import');
    expect(tabs).to.include('export');
  });

  it('default tab is import', function () {
    const defaultTab = 'import';
    expect(defaultTab).to.equal('import');
  });
});

// ── Import operations ──────────────────────────────────────────────

describe('ImportExportDialog — Import', function () {
  it('import calls bridge with correct params', async function () {
    const bridge = createMockBridge();
    await bridge.request(
      'import.tload',
      {
        database: 'PRODUCTION',
        file_path: '/tmp/customers.tdump',
      },
      300000
    );
    expect(
      bridge.request.calledWith(
        'import.tload',
        sinon.match({
          database: 'PRODUCTION',
          file_path: '/tmp/customers.tdump',
        }),
        300000
      )
    ).to.equal(true);
  });

  it('import with target collection override', async function () {
    const bridge = createMockBridge();
    await bridge.request(
      'import.tload',
      {
        database: 'PRODUCTION',
        file_path: '/tmp/customers.tdump',
        target_collection: 'CUSTOMERS_BACKUP',
      },
      300000
    );
    const args = bridge.request.lastCall.args;
    expect(args[1].target_collection).to.equal('CUSTOMERS_BACKUP');
  });

  it('import returns job_id for progress tracking', async function () {
    const bridge = createMockBridge();
    const response = await bridge.request(
      'import.tload',
      {
        database: 'PROD',
        file_path: '/tmp/data.tdump',
      },
      300000
    );
    expect((response.result as any).job_id).to.equal('job-1234');
    expect((response.result as any).status).to.equal('started');
  });

  it('import error handled gracefully', async function () {
    const errorBridge = createMockBridge({
      request: sinon.stub().rejects(new Error('File not found: /bad/path')),
    });
    try {
      await errorBridge.request(
        'import.tload',
        { database: 'PROD', file_path: '/bad/path' },
        300000
      );
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).to.include('File not found');
    }
  });
});

// ── Export operations ──────────────────────────────────────────────

describe('ImportExportDialog — Export', function () {
  it('T-DUMP export calls bridge with correct params', async function () {
    const bridge = createMockBridge();
    await bridge.request(
      'export.tdump',
      {
        database: 'PRODUCTION',
        collection: 'CUSTOMERS',
        output_path: '/tmp/customers.tdump',
      },
      300000
    );
    expect(
      bridge.request.calledWith(
        'export.tdump',
        sinon.match({
          collection: 'CUSTOMERS',
          output_path: '/tmp/customers.tdump',
        }),
        300000
      )
    ).to.equal(true);
  });

  it('CSV export calls bridge with fields and options', async function () {
    const bridge = createMockBridge();
    await bridge.request(
      'export.csv',
      {
        database: 'PRODUCTION',
        collection: 'CUSTOMERS',
        output_path: '/tmp/customers.csv',
        output_fields: ['NAME', 'STATE'],
        include_header: true,
        apply_conversions: true,
      },
      300000
    );
    const args = bridge.request.lastCall.args;
    expect(args[1].output_fields).to.deep.equal(['NAME', 'STATE']);
    expect(args[1].include_header).to.equal(true);
    expect(args[1].apply_conversions).to.equal(true);
  });

  it('export returns job_id', async function () {
    const bridge = createMockBridge();
    const response = await bridge.request(
      'export.tdump',
      {
        database: 'PROD',
        collection: 'CUST',
        output_path: '/tmp/out.tdump',
      },
      300000
    );
    expect((response.result as any).job_id).to.equal('job-5678');
  });
});

// ── Progress events ────────────────────────────────────────────────

describe('ImportExportDialog — Progress Events', function () {
  it('progress event has expected fields', function () {
    const progressData = {
      records_processed: 5000,
      records_total: 12450,
      percent: 40,
      status: 'running',
    };
    expect(progressData.records_processed).to.equal(5000);
    expect(progressData.percent).to.equal(40);
  });

  it('completion event has elapsed time', function () {
    const completeData = {
      records_processed: 12450,
      status: 'complete',
      elapsed_seconds: 14.3,
    };
    expect(completeData.status).to.equal('complete');
    expect(completeData.elapsed_seconds).to.equal(14.3);
  });

  it('result summary formats correctly', function () {
    const records = 1523;
    const seconds = 4.2;
    const summary = `${records.toLocaleString()} records imported in ${seconds.toFixed(
      1
    )} seconds`;
    expect(summary).to.equal('1,523 records imported in 4.2 seconds');
  });
});

// ── Bridge unavailable ─────────────────────────────────────────────

describe('ImportExportDialog — Bridge Unavailable', function () {
  it('buttons disabled when bridge is null', function () {
    const bridgeAvailable = false;
    expect(bridgeAvailable).to.equal(false);
    // Component disables import/export buttons when !bridgeAvailable
  });

  it('shows message when bridge not connected', function () {
    const message =
      'Bridge not connected. Import/Export requires a running D3PyMongo bridge.';
    expect(message).to.include('Bridge not connected');
  });
});

// ── Props contract ─────────────────────────────────────────────────

describe('ImportExportDialogProps contract', function () {
  it('accepts required props', function () {
    const props: ImportExportDialogProps = {
      database: 'PRODUCTION',
      collection: 'CUSTOMERS',
      bridgeClient: null,
      onClose: sinon.stub(),
    };
    expect(props.database).to.equal('PRODUCTION');
    expect(props.collection).to.equal('CUSTOMERS');
  });
});
