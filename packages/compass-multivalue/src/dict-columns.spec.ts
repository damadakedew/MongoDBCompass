import { expect } from 'chai';
import {
  buildColumnConfig,
  buildFallbackColumns,
  buildMergedColumns,
  inferSortType,
} from './dict-columns';
import type { DictField } from './mgdata';

// ── Test Data ──────────────────────────────────────────────────────

const SAMPLE_DICT: DictField[] = [
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
    item_id: 'CITY.STATE.ZIP',
    type: 'A',
    attribute_number: 3,
    header: 'City/State/Zip',
    conversion: '',
    justification: 'L',
    width: 30,
  },
  {
    item_id: 'PHONE',
    type: 'A',
    attribute_number: 4,
    header: 'Phone',
    conversion: '',
    justification: 'L',
    width: 12,
  },
  {
    item_id: 'ORDER.DATE',
    type: 'A',
    attribute_number: 6,
    header: 'Order Date',
    conversion: 'D4-',
    justification: 'R',
    width: 10,
  },
];

const DICT_WITH_TYPES: DictField[] = [
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
    item_id: 'TOTAL',
    type: 'A',
    attribute_number: 2,
    header: 'Total',
    conversion: 'MD2',
    justification: 'R',
    width: 10,
  },
  {
    item_id: 'DATE',
    type: 'A',
    attribute_number: 3,
    header: 'Date',
    conversion: 'D2/',
    justification: 'R',
    width: 10,
  },
  {
    item_id: 'FULL.NAME',
    type: 'S',
    attribute_number: 1,
    header: 'Full Name',
    conversion: '',
    justification: 'L',
    width: 25,
  },
  {
    item_id: 'MY.DEFINE',
    type: 'D',
    attribute_number: 0,
    header: 'Computed',
    conversion: '',
    justification: 'L',
    width: 15,
  },
];

// ── inferSortType ──────────────────────────────────────────────────

describe('inferSortType', function () {
  it('returns string for empty conversion + left justified', function () {
    expect(inferSortType('', 'L')).to.equal('string');
  });

  it('returns number for empty conversion + right justified', function () {
    expect(inferSortType('', 'R')).to.equal('number');
  });

  it('returns date for D conversion', function () {
    expect(inferSortType('D', 'R')).to.equal('date');
    expect(inferSortType('D2', 'R')).to.equal('date');
    expect(inferSortType('D4-', 'R')).to.equal('date');
    expect(inferSortType('D2/', 'R')).to.equal('date');
    expect(inferSortType('DI', 'L')).to.equal('date');
  });

  it('returns number for MD/MR/ML conversions', function () {
    expect(inferSortType('MD2', 'R')).to.equal('number');
    expect(inferSortType('MR2', 'R')).to.equal('number');
    expect(inferSortType('ML2', 'L')).to.equal('number');
    expect(inferSortType('MD0', 'R')).to.equal('number');
  });

  it('returns number for MT (time) conversion', function () {
    expect(inferSortType('MT', 'R')).to.equal('number');
    expect(inferSortType('MTH', 'R')).to.equal('number');
  });

  it('returns number for MX (hex) conversion', function () {
    expect(inferSortType('MX', 'R')).to.equal('number');
  });

  it('returns string for MCU/MCL (case) conversions', function () {
    expect(inferSortType('MCU', 'L')).to.equal('string');
    expect(inferSortType('MCL', 'L')).to.equal('string');
  });

  it('is case-insensitive', function () {
    expect(inferSortType('d4-', 'R')).to.equal('date');
    expect(inferSortType('md2', 'R')).to.equal('number');
  });
});

// ── buildColumnConfig ──────────────────────────────────────────────

describe('buildColumnConfig', function () {
  it('returns empty array for null/empty input', function () {
    expect(buildColumnConfig([])).to.deep.equal([]);
    expect(buildColumnConfig(null as any)).to.deep.equal([]);
    expect(buildColumnConfig(undefined as any)).to.deep.equal([]);
  });

  it('maps DICT fields to column configs', function () {
    const cols = buildColumnConfig(SAMPLE_DICT);
    expect(cols).to.have.length(5);

    expect(cols[0].index).to.equal(0);
    expect(cols[0].header).to.equal('Name');
    expect(cols[0].dictItemId).to.equal('NAME');
    expect(cols[0].width).to.equal(20);
    expect(cols[0].justification).to.equal('L');
    expect(cols[0].fromDict).to.equal(true);
  });

  it('sorts by attribute number', function () {
    const reversed = [...SAMPLE_DICT].reverse();
    const cols = buildColumnConfig(reversed);
    expect(cols.map((c) => c.index)).to.deep.equal([0, 1, 2, 3, 5]);
  });

  it('converts 1-based attribute to 0-based index', function () {
    const cols = buildColumnConfig(SAMPLE_DICT);
    expect(cols[0].index).to.equal(0);
    expect(cols[4].index).to.equal(5);
  });

  it('infers sort type from conversion code', function () {
    const cols = buildColumnConfig(SAMPLE_DICT);
    const dateCol = cols.find((c) => c.dictItemId === 'ORDER.DATE')!;
    expect(dateCol.sortType).to.equal('date');
    expect(dateCol.conversion).to.equal('D4-');
  });

  it('filters out D-type (DEFINE) fields', function () {
    const cols = buildColumnConfig(DICT_WITH_TYPES);
    expect(cols.find((c) => c.dictItemId === 'MY.DEFINE')).to.equal(undefined);
  });

  it('includes S-type (synonym) fields', function () {
    const cols = buildColumnConfig(DICT_WITH_TYPES);
    expect(cols.find((c) => c.dictItemId === 'FULL.NAME')).to.not.equal(
      undefined
    );
  });

  it('falls back to item_id when header is empty', function () {
    const fields: DictField[] = [
      {
        item_id: 'NO.HEADER',
        type: 'A',
        attribute_number: 1,
        header: '',
        conversion: '',
        justification: 'L',
        width: 10,
      },
    ];
    const cols = buildColumnConfig(fields);
    expect(cols[0].header).to.equal('NO.HEADER');
  });

  it('uses default width for zero or negative width', function () {
    const fields: DictField[] = [
      {
        item_id: 'X',
        type: 'A',
        attribute_number: 1,
        header: 'X',
        conversion: '',
        justification: 'L',
        width: 0,
      },
      {
        item_id: 'Y',
        type: 'A',
        attribute_number: 2,
        header: 'Y',
        conversion: '',
        justification: 'L',
        width: -5,
      },
    ];
    const cols = buildColumnConfig(fields);
    expect(cols[0].width).to.equal(10);
    expect(cols[1].width).to.equal(10);
  });

  it('normalizes justification', function () {
    const fields: DictField[] = [
      {
        item_id: 'A',
        type: 'A',
        attribute_number: 1,
        header: 'A',
        conversion: '',
        justification: 'r',
        width: 10,
      },
      {
        item_id: 'B',
        type: 'A',
        attribute_number: 2,
        header: 'B',
        conversion: '',
        justification: 'C',
        width: 10,
      },
      {
        item_id: 'C',
        type: 'A',
        attribute_number: 3,
        header: 'C',
        conversion: '',
        justification: 'x',
        width: 10,
      },
    ];
    const cols = buildColumnConfig(fields);
    expect(cols[0].justification).to.equal('R');
    expect(cols[1].justification).to.equal('C');
    expect(cols[2].justification).to.equal('L');
  });
});

// ── buildFallbackColumns ───────────────────────────────────────────

describe('buildFallbackColumns', function () {
  it('generates numbered fallback columns', function () {
    const cols = buildFallbackColumns(3);
    expect(cols).to.have.length(3);
    expect(cols[0]).to.deep.equal({
      index: 0,
      header: 'Attr 1',
      width: 10,
      justification: 'L',
      conversion: '',
      dictItemId: null,
      sortType: 'string',
      fromDict: false,
    });
    expect(cols[1].header).to.equal('Attr 2');
    expect(cols[2].header).to.equal('Attr 3');
  });

  it('returns empty array for zero count', function () {
    expect(buildFallbackColumns(0)).to.deep.equal([]);
  });

  it('handles large count', function () {
    const cols = buildFallbackColumns(100);
    expect(cols).to.have.length(100);
    expect(cols[99].header).to.equal('Attr 100');
    expect(cols[99].index).to.equal(99);
  });
});

// ── buildMergedColumns ─────────────────────────────────────────────

describe('buildMergedColumns', function () {
  it('returns all fallback columns when no DICT', function () {
    const cols = buildMergedColumns(null, 5);
    expect(cols).to.have.length(5);
    expect(cols.every((c) => !c.fromDict)).to.equal(true);
  });

  it('returns all fallback columns for empty DICT', function () {
    const cols = buildMergedColumns([], 3);
    expect(cols).to.have.length(3);
    expect(cols[0].header).to.equal('Attr 1');
  });

  it('merges DICT columns with fallback for uncovered attributes', function () {
    const cols = buildMergedColumns(SAMPLE_DICT, 7);
    expect(cols).to.have.length(7);

    expect(cols[0].fromDict).to.equal(true);
    expect(cols[0].header).to.equal('Name');

    expect(cols[4].fromDict).to.equal(false);
    expect(cols[4].header).to.equal('Attr 5');

    expect(cols[5].fromDict).to.equal(true);
    expect(cols[5].header).to.equal('Order Date');

    expect(cols[6].fromDict).to.equal(false);
    expect(cols[6].header).to.equal('Attr 7');
  });

  it('sorts merged columns by index', function () {
    const cols = buildMergedColumns(SAMPLE_DICT, 7);
    const indices = cols.map((c) => c.index);
    expect(indices).to.deep.equal([0, 1, 2, 3, 4, 5, 6]);
  });

  it('does not create fallbacks when DICT covers all attributes', function () {
    const dict: DictField[] = [
      {
        item_id: 'A',
        type: 'A',
        attribute_number: 1,
        header: 'A',
        conversion: '',
        justification: 'L',
        width: 10,
      },
      {
        item_id: 'B',
        type: 'A',
        attribute_number: 2,
        header: 'B',
        conversion: '',
        justification: 'L',
        width: 10,
      },
    ];
    const cols = buildMergedColumns(dict, 2);
    expect(cols).to.have.length(2);
    expect(cols.every((c) => c.fromDict)).to.equal(true);
  });

  it('handles DICT with more attrs than document has', function () {
    const cols = buildMergedColumns(SAMPLE_DICT, 3);
    expect(cols.length).to.be.at.least(3);
    expect(cols.filter((c) => c.index < 3).every((c) => c.fromDict)).to.equal(
      true
    );
  });

  it('handles S-type synonyms pointing to same attribute', function () {
    const cols = buildMergedColumns(DICT_WITH_TYPES, 3);
    const atIndex0 = cols.filter((c) => c.index === 0);
    expect(atIndex0).to.have.length(2);
  });
});
