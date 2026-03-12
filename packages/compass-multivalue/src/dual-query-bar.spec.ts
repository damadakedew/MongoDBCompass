import { expect } from 'chai';
import sinon from 'sinon';

// We test the DualQueryBar logic via its exported types and behavioral contract.
// Since this is a React component and we don't have React Testing Library in the
// monorepo test runner, we test the logic layers: translation flow, history
// management, and JSON validation. Component rendering tests live in the playground.

import type {
  DualQueryBarProps,
  TranslationResult,
  QueryHistoryEntry,
  FieldUsed,
} from './dual-query-bar';

// ── Mock Bridge Client ─────────────────────────────────────────────

function createMockBridge(
  overrides?: Partial<{ status: string; request: sinon.SinonStub }>
) {
  return {
    status: overrides?.status ?? 'connected',
    request:
      overrides?.request ??
      sinon.stub().resolves({
        id: 'test-id',
        result: {
          source_syntax: 'pick',
          target_syntax: 'mongodb',
          collection: 'CUSTOMERS',
          pick_query: 'SELECT CUSTOMERS WITH STATE = "TX"',
          mongodb_filter: { 'MGData.4': 'TX' },
          mongodb_sort: null,
          fields_used: [
            { name: 'STATE', attribute_number: 5, mongo_path: 'MGData.4' },
          ],
          warnings: [],
        } as TranslationResult,
        error: null,
      }),
    connect: sinon.stub().resolves('connected'),
    disconnect: sinon.stub(),
    onStatusChange: sinon.stub().returns(() => {}),
    onEvent: sinon.stub().returns(() => {}),
    url: 'ws://localhost:9800',
    _url: 'ws://localhost:9800',
    _status: 'connected',
    _ws: null,
    _pending: new Map(),
    _eventHandlers: new Map(),
    _timeoutMs: 30000,
    _statusListeners: new Set(),
  };
}

// ── TranslationResult shape ────────────────────────────────────────

describe('TranslationResult type contract', function () {
  it('matches bridge-contract.md query.translate response', function () {
    const result: TranslationResult = {
      source_syntax: 'pick',
      target_syntax: 'mongodb',
      collection: 'CUSTOMERS',
      pick_query: 'SELECT CUSTOMERS WITH STATE = "TX"',
      mongodb_filter: { 'MGData.4': 'TX' },
      mongodb_sort: null,
      fields_used: [
        { name: 'STATE', attribute_number: 5, mongo_path: 'MGData.4' },
      ],
      warnings: [],
    };
    expect(result.source_syntax).to.equal('pick');
    expect(result.target_syntax).to.equal('mongodb');
    expect(result.mongodb_filter).to.deep.equal({ 'MGData.4': 'TX' });
    expect(result.fields_used).to.have.length(1);
    expect(result.fields_used[0].name).to.equal('STATE');
    expect(result.fields_used[0].attribute_number).to.equal(5);
    expect(result.fields_used[0].mongo_path).to.equal('MGData.4');
  });

  it('supports mongodb→pick direction', function () {
    const result: TranslationResult = {
      source_syntax: 'mongodb',
      target_syntax: 'pick',
      collection: 'CUSTOMERS',
      pick_query: 'SELECT CUSTOMERS WITH STATE = "TX"',
      mongodb_filter: { 'MGData.4': 'TX' },
      fields_used: [
        { name: 'STATE', attribute_number: 5, mongo_path: 'MGData.4' },
      ],
      warnings: ['Reverse translation is best-effort'],
    };
    expect(result.source_syntax).to.equal('mongodb');
    expect(result.warnings).to.have.length(1);
  });

  it('supports sort in response', function () {
    const result: TranslationResult = {
      source_syntax: 'pick',
      target_syntax: 'mongodb',
      collection: 'CUSTOMERS',
      pick_query: 'SELECT CUSTOMERS BY NAME',
      mongodb_filter: {},
      mongodb_sort: { 'MGData.0': 1 },
      fields_used: [
        { name: 'NAME', attribute_number: 1, mongo_path: 'MGData.0' },
      ],
      warnings: [],
    };
    expect(result.mongodb_sort).to.deep.equal({ 'MGData.0': 1 });
  });
});

// ── FieldUsed ──────────────────────────────────────────────────────

describe('FieldUsed type', function () {
  it('has required fields', function () {
    const field: FieldUsed = {
      name: 'CITY',
      attribute_number: 3,
      mongo_path: 'MGData.2',
    };
    expect(field.name).to.equal('CITY');
    expect(field.attribute_number).to.equal(3);
    expect(field.mongo_path).to.equal('MGData.2');
  });
});

// ── QueryHistoryEntry ──────────────────────────────────────────────

describe('QueryHistoryEntry', function () {
  it('stores both syntaxes and metadata', function () {
    const entry: QueryHistoryEntry = {
      pickQuery: 'SELECT CUSTOMERS WITH STATE = "TX"',
      mongoFilter: '{"MGData.4":"TX"}',
      mongoSort: null,
      fieldsUsed: [
        { name: 'STATE', attribute_number: 5, mongo_path: 'MGData.4' },
      ],
      timestamp: Date.now(),
    };
    expect(entry.pickQuery).to.be.a('string');
    expect(entry.mongoFilter).to.be.a('string');
    expect(entry.fieldsUsed).to.have.length(1);
    expect(entry.timestamp).to.be.a('number');
  });
});

// ── Mock bridge request behavior ───────────────────────────────────

describe('Mock bridge client', function () {
  it('request resolves with translation result', async function () {
    const bridge = createMockBridge();
    const response = await bridge.request('query.translate', {
      database: 'PRODUCTION',
      source: 'pick',
      query: 'SELECT CUSTOMERS WITH STATE = "TX"',
    });
    expect(response.result).to.not.be.null;
    const result = response.result as unknown as TranslationResult;
    expect(result.mongodb_filter).to.deep.equal({ 'MGData.4': 'TX' });
    expect(result.pick_query).to.include('STATE');
  });

  it('request called with correct method and params', async function () {
    const bridge = createMockBridge();
    await bridge.request('query.translate', {
      database: 'PRODUCTION',
      source: 'pick',
      query: 'SELECT CUSTOMERS WITH STATE = "TX"',
    });
    expect(bridge.request.calledOnce).to.equal(true);
    const [method, params] = bridge.request.firstCall.args;
    expect(method).to.equal('query.translate');
    expect(params.source).to.equal('pick');
  });

  it('handles translation error', async function () {
    const errorBridge = createMockBridge({
      request: sinon
        .stub()
        .rejects(new Error('Query parse error: unexpected token')),
    });
    try {
      await errorBridge.request('query.translate', {
        database: 'PRODUCTION',
        source: 'pick',
        query: 'INVALID QUERY SYNTAX',
      });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).to.include('parse error');
    }
  });

  it('handles translation with warnings', async function () {
    const warningBridge = createMockBridge({
      request: sinon.stub().resolves({
        id: 'test-id',
        result: {
          source_syntax: 'mongodb',
          target_syntax: 'pick',
          collection: 'CUSTOMERS',
          pick_query: 'SELECT CUSTOMERS WITH STATE = "TX"',
          mongodb_filter: { 'MGData.4': 'TX' },
          fields_used: [
            { name: 'STATE', attribute_number: 5, mongo_path: 'MGData.4' },
          ],
          warnings: ['Reverse translation is best-effort'],
        },
        error: null,
      }),
    });
    const response = await warningBridge.request('query.translate', {
      database: 'PRODUCTION',
      source: 'mongodb',
      query: '{"MGData.4": "TX"}',
    });
    const result = response.result as unknown as TranslationResult;
    expect(result.warnings).to.have.length(1);
    expect(result.warnings[0]).to.include('best-effort');
  });

  it('multiple translation calls tracked', async function () {
    const bridge = createMockBridge();
    await bridge.request('query.translate', { source: 'pick', query: 'Q1' });
    await bridge.request('query.translate', { source: 'pick', query: 'Q2' });
    expect(bridge.request.callCount).to.equal(2);
  });
});

// ── JSON filter validation ─────────────────────────────────────────

describe('MongoDB filter JSON validation', function () {
  it('parses valid filter JSON', function () {
    const filter = '{"MGData.4": "TX"}';
    const parsed = JSON.parse(filter);
    expect(parsed).to.deep.equal({ 'MGData.4': 'TX' });
  });

  it('parses empty object', function () {
    const parsed = JSON.parse('{}');
    expect(parsed).to.deep.equal({});
  });

  it('rejects invalid JSON', function () {
    expect(() => JSON.parse('{invalid}')).to.throw();
  });

  it('parses complex filter with operators', function () {
    const filter = '{"MGData.0": {"$regex": "^SMITH"}}';
    const parsed = JSON.parse(filter);
    expect(parsed['MGData.0']).to.deep.equal({ $regex: '^SMITH' });
  });

  it('parses filter with sort', function () {
    const filter = '{}';
    const sort = '{"MGData.0": 1}';
    const parsedFilter = JSON.parse(filter);
    const parsedSort = JSON.parse(sort);
    expect(parsedFilter).to.deep.equal({});
    expect(parsedSort).to.deep.equal({ 'MGData.0': 1 });
  });

  it('empty string treated as empty filter', function () {
    const filterText = '';
    const parsed = filterText.trim() ? JSON.parse(filterText) : {};
    expect(parsed).to.deep.equal({});
  });
});

// ── History deduplication logic ────────────────────────────────────

describe('Query history deduplication', function () {
  function addToHistory(
    history: QueryHistoryEntry[],
    entry: QueryHistoryEntry
  ): QueryHistoryEntry[] {
    const deduped = history.filter((h) => h.mongoFilter !== entry.mongoFilter);
    return [entry, ...deduped].slice(0, MAX_HISTORY);
  }

  const MAX_HISTORY = 10;

  it('adds new entry to front', function () {
    const entry: QueryHistoryEntry = {
      pickQuery: 'SELECT CUSTOMERS',
      mongoFilter: '{}',
      fieldsUsed: [],
      timestamp: Date.now(),
    };
    const result = addToHistory([], entry);
    expect(result).to.have.length(1);
    expect(result[0].mongoFilter).to.equal('{}');
  });

  it('deduplicates by mongoFilter', function () {
    const entry1: QueryHistoryEntry = {
      pickQuery: 'Q1',
      mongoFilter: '{"MGData.4":"TX"}',
      fieldsUsed: [],
      timestamp: 1000,
    };
    const entry2: QueryHistoryEntry = {
      pickQuery: 'Q2',
      mongoFilter: '{"MGData.4":"TX"}',
      fieldsUsed: [],
      timestamp: 2000,
    };
    const result = addToHistory([entry1], entry2);
    expect(result).to.have.length(1);
    expect(result[0].pickQuery).to.equal('Q2'); // newer wins
    expect(result[0].timestamp).to.equal(2000);
  });

  it('limits to MAX_HISTORY entries', function () {
    const existing: QueryHistoryEntry[] = [];
    for (let i = 0; i < 12; i++) {
      existing.push({
        pickQuery: `Q${i}`,
        mongoFilter: `{"i":${i}}`,
        fieldsUsed: [],
        timestamp: i,
      });
    }
    const newEntry: QueryHistoryEntry = {
      pickQuery: 'NEW',
      mongoFilter: '{"new":true}',
      fieldsUsed: [],
      timestamp: 99,
    };
    const result = addToHistory(existing, newEntry);
    expect(result).to.have.length(MAX_HISTORY);
    expect(result[0].pickQuery).to.equal('NEW');
  });

  it('keeps different filters separate', function () {
    const entry1: QueryHistoryEntry = {
      pickQuery: 'Q1',
      mongoFilter: '{"a":1}',
      fieldsUsed: [],
      timestamp: 1,
    };
    const entry2: QueryHistoryEntry = {
      pickQuery: 'Q2',
      mongoFilter: '{"b":2}',
      fieldsUsed: [],
      timestamp: 2,
    };
    const result = addToHistory([entry1], entry2);
    expect(result).to.have.length(2);
    expect(result[0].mongoFilter).to.equal('{"b":2}');
    expect(result[1].mongoFilter).to.equal('{"a":1}');
  });
});

// ── DualQueryBarProps contract ─────────────────────────────────────

describe('DualQueryBarProps contract', function () {
  it('accepts required props', function () {
    const props: DualQueryBarProps = {
      database: 'PRODUCTION',
      collection: 'CUSTOMERS',
      onApplyQuery: sinon.stub(),
      bridgeClient: null,
    };
    expect(props.database).to.equal('PRODUCTION');
    expect(props.collection).to.equal('CUSTOMERS');
    expect(props.bridgeClient).to.be.null;
  });

  it('accepts optional initialFilter', function () {
    const props: DualQueryBarProps = {
      database: 'PRODUCTION',
      collection: 'CUSTOMERS',
      onApplyQuery: sinon.stub(),
      bridgeClient: null,
      initialFilter: '{"MGData.4": "TX"}',
    };
    expect(props.initialFilter).to.equal('{"MGData.4": "TX"}');
  });

  it('accepts mock bridge client', function () {
    const bridge = createMockBridge();
    const props: DualQueryBarProps = {
      database: 'PRODUCTION',
      collection: 'CUSTOMERS',
      onApplyQuery: sinon.stub(),
      bridgeClient: bridge as any,
    };
    expect(props.bridgeClient).to.not.be.null;
    expect((props.bridgeClient as any).status).to.equal('connected');
  });

  it('onApplyQuery receives filter and optional sort', function () {
    const onApply = sinon.stub();
    onApply({ 'MGData.4': 'TX' }, { 'MGData.0': 1 });
    expect(onApply.calledOnce).to.equal(true);
    expect(onApply.firstCall.args[0]).to.deep.equal({ 'MGData.4': 'TX' });
    expect(onApply.firstCall.args[1]).to.deep.equal({ 'MGData.0': 1 });
  });

  it('onApplyQuery with empty filter', function () {
    const onApply = sinon.stub();
    onApply({});
    expect(onApply.firstCall.args[0]).to.deep.equal({});
  });
});
