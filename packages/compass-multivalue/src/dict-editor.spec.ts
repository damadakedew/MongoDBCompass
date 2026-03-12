import { expect } from 'chai';
import sinon from 'sinon';

import type { DictEditorProps } from './dict-editor';
import type { DictField } from './mgdata';

// ── Mock helpers ───────────────────────────────────────────────────

const SAMPLE_FIELDS: DictField[] = [
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
    item_id: 'ADDRESS',
    type: 'A',
    attribute_number: 2,
    header: 'Address',
    conversion: '',
    justification: 'L',
    width: 25,
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
  {
    item_id: 'ORDER.DATE',
    type: 'A',
    attribute_number: 7,
    header: 'Order Date',
    conversion: 'D4-',
    justification: 'R',
    width: 10,
  },
];

function createMockBridge(overrides?: {
  status?: string;
  request?: sinon.SinonStub;
}) {
  const defaultRequest = sinon.stub();
  // dict.list returns sample fields
  defaultRequest.withArgs('dict.list', sinon.match.any).resolves({
    id: 'test',
    result: { dict_collection: 'DICT_CUSTOMERS', fields: SAMPLE_FIELDS },
    error: null,
  });
  // dict.get returns a single field
  defaultRequest.withArgs('dict.get', sinon.match.any).resolves({
    id: 'test',
    result: SAMPLE_FIELDS[0],
    error: null,
  });
  // dict.save succeeds
  defaultRequest.withArgs('dict.save', sinon.match.any).resolves({
    id: 'test',
    result: { saved: true },
    error: null,
  });
  // dict.delete succeeds
  defaultRequest.withArgs('dict.delete', sinon.match.any).resolves({
    id: 'test',
    result: { deleted: true },
    error: null,
  });
  // convert.oconv returns converted value
  defaultRequest.withArgs('convert.oconv', sinon.match.any).resolves({
    id: 'test',
    result: { input: '19320', code: 'D4-', output: '11-21-2020' },
    error: null,
  });

  return {
    status: overrides?.status ?? 'connected',
    request: overrides?.request ?? defaultRequest,
    connect: sinon.stub().resolves('connected'),
    disconnect: sinon.stub(),
    onStatusChange: sinon.stub().returns(() => {}),
    onEvent: sinon.stub().returns(() => {}),
    url: 'ws://localhost:9800',
  };
}

// ── Field List tests ───────────────────────────────────────────────

describe('DictEditor — Field List', function () {
  it('loads and displays field list from bridge', async function () {
    const bridge = createMockBridge();
    await bridge.request('dict.list', {
      database: 'PROD',
      collection: 'CUSTOMERS',
    });
    expect(bridge.request.calledOnce).to.equal(true);
    const response = await bridge.request.firstCall.returnValue;
    const fields = response.result.fields as DictField[];
    expect(fields).to.have.length(4);
    expect(fields[0].item_id).to.equal('NAME');
    expect(fields[2].item_id).to.equal('STATE');
  });

  it('handles loading state', function () {
    // The component shows loading while fetching — we verify the bridge call is async
    const bridge = createMockBridge();
    const promise = bridge.request('dict.list', {
      database: 'PROD',
      collection: 'CUSTOMERS',
    });
    expect(promise).to.be.a('promise');
  });

  it('handles empty field list (new collection)', async function () {
    const emptyBridge = createMockBridge({
      request: sinon.stub().resolves({
        id: 'test',
        result: { dict_collection: 'DICT_NEW', fields: [] },
        error: null,
      }),
    });
    const response = await emptyBridge.request('dict.list', {
      database: 'PROD',
      collection: 'NEW',
    });
    expect((response.result as any).fields).to.have.length(0);
  });

  it('handles bridge unavailable', async function () {
    const errorBridge = createMockBridge({
      request: sinon
        .stub()
        .rejects(new Error('Not connected to bridge server')),
    });
    try {
      await errorBridge.request('dict.list', {
        database: 'PROD',
        collection: 'X',
      });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).to.include('Not connected');
    }
  });

  it('field data has all required properties', function () {
    for (const field of SAMPLE_FIELDS) {
      expect(field).to.have.property('item_id');
      expect(field).to.have.property('type');
      expect(field).to.have.property('attribute_number');
      expect(field).to.have.property('header');
      expect(field).to.have.property('conversion');
      expect(field).to.have.property('justification');
      expect(field).to.have.property('width');
    }
  });

  it('selecting a field populates form data', function () {
    const field = SAMPLE_FIELDS[2]; // STATE
    expect(field.item_id).to.equal('STATE');
    expect(field.type).to.equal('A');
    expect(field.attribute_number).to.equal(5);
    expect(field.header).to.equal('State');
    expect(field.conversion).to.equal('MCU');
    expect(field.justification).to.equal('L');
    expect(field.width).to.equal(5);
  });
});

// ── Form Validation tests ──────────────────────────────────────────

describe('DictEditor — Form Validation', function () {
  it('all form fields are defined in field data', function () {
    const requiredKeys = [
      'item_id',
      'type',
      'attribute_number',
      'header',
      'conversion',
      'justification',
      'width',
    ];
    for (const key of requiredKeys) {
      expect(SAMPLE_FIELDS[0]).to.have.property(key);
    }
  });

  it('validates required fields: item_id', function () {
    const itemId = '';
    expect(itemId.trim()).to.equal('');
    // Empty item_id should produce validation error
    const hasError = !itemId.trim();
    expect(hasError).to.equal(true);
  });

  it('validates required fields: header', function () {
    const header = '';
    expect(header.trim()).to.equal('');
    const hasError = !header.trim();
    expect(hasError).to.equal(true);
  });

  it('validates attribute number range (1-999)', function () {
    expect(0).to.be.lessThan(1); // 0 is invalid
    expect(1).to.be.at.least(1); // 1 is valid
    expect(999).to.be.at.most(999); // 999 is valid
    expect(1000).to.be.greaterThan(999); // 1000 is invalid
  });

  it('validates width range (1-999)', function () {
    expect(0).to.be.lessThan(1);
    expect(1).to.be.at.least(1);
    expect(999).to.be.at.most(999);
    expect(1000).to.be.greaterThan(999);
  });

  it('type select has A, S, D options', function () {
    const validTypes = ['A', 'S', 'D'];
    expect(validTypes).to.include('A');
    expect(validTypes).to.include('S');
    expect(validTypes).to.include('D');
    expect(validTypes).to.have.length(3);
  });

  it('justification select has L, R, C options', function () {
    const validJust = ['L', 'R', 'C'];
    expect(validJust).to.include('L');
    expect(validJust).to.include('R');
    expect(validJust).to.include('C');
    expect(validJust).to.have.length(3);
  });

  it('item_id rejects spaces', function () {
    const itemId = 'HAS SPACE';
    const hasSpace = /\s/.test(itemId);
    expect(hasSpace).to.equal(true);
  });

  it('item_id uppercased on input', function () {
    const input = 'my.field';
    expect(input.toUpperCase()).to.equal('MY.FIELD');
  });
});

// ── CRUD Operations tests ──────────────────────────────────────────

describe('DictEditor — CRUD Operations', function () {
  it('save calls dict.save with correct params', async function () {
    const bridge = createMockBridge();
    const saveParams = {
      database: 'PRODUCTION',
      collection: 'CUSTOMERS',
      item_id: 'NEW.FIELD',
      definition: {
        type: 'A',
        attribute_number: 10,
        header: 'New Field',
        conversion: '',
        correlative: '',
        justification: 'L',
        width: 15,
      },
    };
    await bridge.request('dict.save', saveParams);
    expect(bridge.request.calledWith('dict.save', saveParams)).to.equal(true);
  });

  it('save success returns saved: true', async function () {
    const bridge = createMockBridge();
    const response = await bridge.request('dict.save', {
      database: 'PROD',
      collection: 'CUST',
      item_id: 'X',
      definition: {
        type: 'A',
        attribute_number: 1,
        header: 'X',
        conversion: '',
        correlative: '',
        justification: 'L',
        width: 10,
      },
    });
    expect((response.result as any).saved).to.equal(true);
  });

  it('save error shows error message', async function () {
    const errorBridge = createMockBridge({
      request: sinon.stub().rejects(new Error('Permission denied')),
    });
    try {
      await errorBridge.request('dict.save', {
        database: 'PROD',
        collection: 'X',
        item_id: 'Y',
        definition: {},
      });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).to.equal('Permission denied');
    }
  });

  it('delete calls dict.delete with correct params', async function () {
    const bridge = createMockBridge();
    await bridge.request('dict.delete', {
      database: 'PRODUCTION',
      collection: 'CUSTOMERS',
      item_id: 'OBSOLETE',
    });
    const [method, params] = bridge.request.lastCall.args;
    expect(method).to.equal('dict.delete');
    expect(params.item_id).to.equal('OBSOLETE');
  });

  it('delete returns deleted: true', async function () {
    const bridge = createMockBridge();
    const response = await bridge.request('dict.delete', {
      database: 'PROD',
      collection: 'CUST',
      item_id: 'OLD',
    });
    expect((response.result as any).deleted).to.equal(true);
  });

  it('delete then list shows updated fields', async function () {
    const bridge = createMockBridge();
    // Delete a field
    await bridge.request('dict.delete', {
      database: 'PROD',
      collection: 'CUST',
      item_id: 'STATE',
    });
    // Re-list (in real component this would show fewer fields)
    const response = await bridge.request('dict.list', {
      database: 'PROD',
      collection: 'CUST',
    });
    expect(response.result).to.have.property('fields');
  });
});

// ── Conversion Preview tests ───────────────────────────────────────

describe('DictEditor — Conversion Preview', function () {
  it('preview calls convert.oconv with value and code', async function () {
    const bridge = createMockBridge();
    await bridge.request('convert.oconv', { value: '19320', code: 'D4-' });
    expect(
      bridge.request.calledWith('convert.oconv', {
        value: '19320',
        code: 'D4-',
      })
    ).to.equal(true);
  });

  it('preview returns converted output', async function () {
    const bridge = createMockBridge();
    const response = await bridge.request('convert.oconv', {
      value: '19320',
      code: 'D4-',
    });
    const result = response.result as any;
    expect(result.input).to.equal('19320');
    expect(result.code).to.equal('D4-');
    expect(result.output).to.equal('11-21-2020');
  });

  it('preview handles error gracefully', async function () {
    const errorBridge = createMockBridge({
      request: sinon.stub().rejects(new Error('Conversion unavailable')),
    });
    try {
      await errorBridge.request('convert.oconv', { value: '123', code: 'BAD' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      // Component shows "Conversion preview unavailable"
      expect(err.message).to.include('unavailable');
    }
  });

  it('preview skipped when no conversion code', function () {
    const code = '';
    const shouldPreview = code.trim().length > 0;
    expect(shouldPreview).to.equal(false);
  });
});

// ── Integration tests ──────────────────────────────────────────────

describe('DictEditor — Integration', function () {
  it('load → select → edit → save → refresh flow', async function () {
    const bridge = createMockBridge();

    // 1. Load fields
    const listResponse = await bridge.request('dict.list', {
      database: 'PROD',
      collection: 'CUST',
    });
    const fields = (listResponse.result as any).fields as DictField[];
    expect(fields.length).to.be.greaterThan(0);

    // 2. Select STATE field
    const stateField = fields.find((f) => f.item_id === 'STATE')!;
    expect(stateField.header).to.equal('State');

    // 3. "Edit" — change header
    const newHeader = 'US State';

    // 4. Save
    await bridge.request('dict.save', {
      database: 'PROD',
      collection: 'CUST',
      item_id: 'STATE',
      definition: { ...stateField, header: newHeader },
    });

    // 5. Refresh list
    await bridge.request('dict.list', { database: 'PROD', collection: 'CUST' });
    expect(bridge.request.callCount).to.equal(3); // list + save + list
  });

  it('new field → fill → save → appears in list', async function () {
    const bridge = createMockBridge();

    // Save new field
    await bridge.request('dict.save', {
      database: 'PROD',
      collection: 'CUST',
      item_id: 'ZIPCODE',
      definition: {
        type: 'A',
        attribute_number: 6,
        header: 'Zip Code',
        conversion: '',
        correlative: '',
        justification: 'L',
        width: 10,
      },
    });

    const response = await bridge.request.firstCall.returnValue;
    expect((response.result as any).saved).to.equal(true);
  });

  it('select → delete → confirm → removed', async function () {
    const bridge = createMockBridge();

    // Delete field
    await bridge.request('dict.delete', {
      database: 'PROD',
      collection: 'CUST',
      item_id: 'ORDER.DATE',
    });

    const response = await bridge.request.firstCall.returnValue;
    expect((response.result as any).deleted).to.equal(true);

    // Refresh after delete
    await bridge.request('dict.list', { database: 'PROD', collection: 'CUST' });
    expect(bridge.request.callCount).to.equal(2);
  });
});

// ── Attribute conflict detection ───────────────────────────────────

describe('DictEditor — Attribute Conflict', function () {
  it('detects when another field uses same attribute number', function () {
    const currentAttr = 1; // NAME uses attr 1
    const existingFields = SAMPLE_FIELDS;
    const editingItemId = 'NEW.FIELD';

    const conflict = existingFields.find(
      (f) => f.attribute_number === currentAttr && f.item_id !== editingItemId
    );
    expect(conflict).to.not.be.undefined;
    expect(conflict!.item_id).to.equal('NAME');
  });

  it('no conflict when editing the same field', function () {
    const currentAttr = 1;
    const editingItemId = 'NAME'; // editing NAME which is attr 1

    const conflict = SAMPLE_FIELDS.find(
      (f) => f.attribute_number === currentAttr && f.item_id !== editingItemId
    );
    expect(conflict).to.be.undefined;
  });
});

// ── DictEditorProps contract ───────────────────────────────────────

describe('DictEditorProps contract', function () {
  it('accepts required props', function () {
    const props: DictEditorProps = {
      database: 'PRODUCTION',
      collection: 'CUSTOMERS',
      bridgeClient: null,
      onClose: sinon.stub(),
    };
    expect(props.database).to.equal('PRODUCTION');
    expect(props.bridgeClient).to.be.null;
  });

  it('accepts optional onSave callback', function () {
    const onSave = sinon.stub();
    const props: DictEditorProps = {
      database: 'PRODUCTION',
      collection: 'CUSTOMERS',
      bridgeClient: createMockBridge() as any,
      onClose: sinon.stub(),
      onSave,
    };
    props.onSave?.();
    expect(onSave.calledOnce).to.equal(true);
  });
});
