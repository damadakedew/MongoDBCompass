import { expect } from 'chai';
import {
  parseMGData,
  formatValue,
  formatAttrNumber,
  isMGData,
  parseMultiValues,
  DEFAULT_CONFIG,
} from './mgdata';
import type { MVDisplayConfig } from './mgdata';

// ── formatAttrNumber ───────────────────────────────────────────────

describe('formatAttrNumber', function () {
  it('zero-pads single digit', function () {
    expect(formatAttrNumber(1, true)).to.equal('001');
  });

  it('zero-pads two digits', function () {
    expect(formatAttrNumber(12, true)).to.equal('012');
  });

  it('does not pad three digits', function () {
    expect(formatAttrNumber(100, true)).to.equal('100');
  });

  it('handles four digits', function () {
    expect(formatAttrNumber(1000, true)).to.equal('1000');
  });

  it('no padding when zeroPad=false', function () {
    expect(formatAttrNumber(1, false)).to.equal('1');
    expect(formatAttrNumber(12, false)).to.equal('12');
    expect(formatAttrNumber(100, false)).to.equal('100');
  });
});

// ── formatValue ────────────────────────────────────────────────────

describe('formatValue', function () {
  const cfg = DEFAULT_CONFIG;

  it('formats plain string as-is', function () {
    expect(formatValue('hello', cfg)).to.equal('hello');
  });

  it('formats empty string', function () {
    expect(formatValue('', cfg)).to.equal('');
  });

  it('formats null as empty string', function () {
    expect(formatValue(null, cfg)).to.equal('');
  });

  it('formats undefined as empty string', function () {
    expect(formatValue(undefined, cfg)).to.equal('');
  });

  it('formats number as string', function () {
    expect(formatValue(42, cfg)).to.equal('42');
  });

  it('joins multi-values with VM separator', function () {
    expect(formatValue(['a', 'b', 'c'], cfg)).to.equal('a]b]c');
  });

  it('joins sub-values with SVM separator within VM separator', function () {
    expect(formatValue([['x', 'y'], 'z'], cfg)).to.equal('x\\y]z');
  });

  it('handles all sub-values', function () {
    expect(
      formatValue(
        [
          ['A1', 'A2'],
          ['B1', 'B2'],
        ],
        cfg
      )
    ).to.equal('A1\\A2]B1\\B2');
  });

  it('uses custom separators', function () {
    const custom: MVDisplayConfig = {
      ...cfg,
      vmSeparator: '|',
      svmSeparator: '~',
    };
    expect(formatValue(['a', 'b'], custom)).to.equal('a|b');
    expect(formatValue([['x', 'y'], 'z'], custom)).to.equal('x~y|z');
  });

  it('handles single-element array', function () {
    expect(formatValue(['only'], cfg)).to.equal('only');
  });

  it('handles empty array', function () {
    expect(formatValue([], cfg)).to.equal('');
  });
});

// ── parseMultiValues ───────────────────────────────────────────────

describe('parseMultiValues', function () {
  it('wraps single string in array', function () {
    const vals = parseMultiValues('hello');
    expect(vals).to.have.length(1);
    expect(vals[0]).to.deep.equal({ value: 'hello', subvalues: null });
  });

  it('parses multi-values without sub-values', function () {
    const vals = parseMultiValues(['a', 'b', 'c']);
    expect(vals).to.have.length(3);
    expect(vals[1]).to.deep.equal({ value: 'b', subvalues: null });
  });

  it('parses sub-values', function () {
    const vals = parseMultiValues([['x', 'y'], 'z']);
    expect(vals).to.have.length(2);
    expect(vals[0]).to.deep.equal({
      value: 'x, y',
      subvalues: ['x', 'y'],
    });
    expect(vals[1]).to.deep.equal({ value: 'z', subvalues: null });
  });
});

// ── parseMGData ────────────────────────────────────────────────────

describe('parseMGData', function () {
  it('parses single-value attributes', function () {
    const result = parseMGData(['John Smith', '123 Main St']);
    expect(result).to.have.length(2);
    expect(result[0].number).to.equal(1);
    expect(result[0].raw).to.equal('John Smith');
    expect(result[0].multivalued).to.equal(false);
    expect(result[0].subvalued).to.equal(false);
    expect(result[0].display).to.equal('John Smith');
    expect(result[0].values).to.deep.equal([
      { value: 'John Smith', subvalues: null },
    ]);

    expect(result[1].number).to.equal(2);
    expect(result[1].display).to.equal('123 Main St');
  });

  it('parses multi-valued attributes', function () {
    const result = parseMGData([['Springfield', 'IL', '62701']]);
    expect(result).to.have.length(1);
    expect(result[0].number).to.equal(1);
    expect(result[0].multivalued).to.equal(true);
    expect(result[0].subvalued).to.equal(false);
    expect(result[0].display).to.equal('Springfield]IL]62701');
    expect(result[0].values).to.deep.equal([
      { value: 'Springfield', subvalues: null },
      { value: 'IL', subvalues: null },
      { value: '62701', subvalues: null },
    ]);
  });

  it('parses sub-valued attributes', function () {
    const result = parseMGData([
      [
        ['A1', 'A2'],
        ['B1', 'B2'],
      ],
    ]);
    expect(result).to.have.length(1);
    expect(result[0].multivalued).to.equal(true);
    expect(result[0].subvalued).to.equal(true);
    expect(result[0].display).to.equal('A1\\A2]B1\\B2');
    expect(result[0].values).to.deep.equal([
      { value: 'A1, A2', subvalues: ['A1', 'A2'] },
      { value: 'B1, B2', subvalues: ['B1', 'B2'] },
    ]);
  });

  it('parses mixed record (single, multi, sub)', function () {
    const mgdata = [
      'John Smith',
      ['Springfield', 'IL'],
      [['X1', 'X2'], 'Y'],
      '555-1234',
    ];
    const result = parseMGData(mgdata);
    expect(result).to.have.length(4);

    expect(result[0].multivalued).to.equal(false);
    expect(result[0].subvalued).to.equal(false);

    expect(result[1].multivalued).to.equal(true);
    expect(result[1].subvalued).to.equal(false);

    expect(result[2].multivalued).to.equal(true);
    expect(result[2].subvalued).to.equal(true);

    expect(result[3].multivalued).to.equal(false);
    expect(result[3].subvalued).to.equal(false);
  });

  it('handles empty attributes in the middle', function () {
    const result = parseMGData(['first', '', 'third']);
    expect(result).to.have.length(3);
    expect(result[1].number).to.equal(2);
    expect(result[1].raw).to.equal('');
    expect(result[1].display).to.equal('');
    expect(result[1].multivalued).to.equal(false);
    expect(result[1].values).to.deep.equal([{ value: '', subvalues: null }]);
  });

  it('handles empty MGData array', function () {
    expect(parseMGData([])).to.deep.equal([]);
  });

  it('handles single-element MGData', function () {
    const result = parseMGData(['only']);
    expect(result).to.have.length(1);
    expect(result[0].number).to.equal(1);
    expect(result[0].display).to.equal('only');
  });

  it('handles non-array input gracefully', function () {
    expect(parseMGData(null as any)).to.deep.equal([]);
    expect(parseMGData(undefined as any)).to.deep.equal([]);
    expect(parseMGData('string' as any)).to.deep.equal([]);
  });

  it('uses custom display config', function () {
    const result = parseMGData([['a', 'b']], { vmSeparator: '|' });
    expect(result[0].display).to.equal('a|b');
  });

  it('1-indexes attribute numbers correctly', function () {
    const mgdata = ['a', 'b', 'c', 'd', 'e'];
    const result = parseMGData(mgdata);
    expect(result.map((a) => a.number)).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it('handles very long arrays', function () {
    const mgdata = Array.from({ length: 200 }, (_, i) => `attr${i}`);
    const result = parseMGData(mgdata);
    expect(result).to.have.length(200);
    expect(result[199].number).to.equal(200);
    expect(result[199].display).to.equal('attr199');
  });

  it('parses the SMITH.JOHN test document', function () {
    const mgdata = [
      'John Smith',
      '123 Main St',
      ['Springfield', 'IL', '62701'],
      '555-1234',
      '',
      '19320',
      [
        ['A1', 'A2'],
        ['B1', 'B2'],
      ],
    ];
    const result = parseMGData(mgdata);
    expect(result).to.have.length(7);

    expect(result[0].display).to.equal('John Smith');
    expect(result[0].multivalued).to.equal(false);

    expect(result[2].display).to.equal('Springfield]IL]62701');
    expect(result[2].multivalued).to.equal(true);
    expect(result[2].subvalued).to.equal(false);

    expect(result[4].display).to.equal('');

    expect(result[6].display).to.equal('A1\\A2]B1\\B2');
    expect(result[6].multivalued).to.equal(true);
    expect(result[6].subvalued).to.equal(true);
  });
});

// ── isMGData (doc-level) ───────────────────────────────────────────

describe('isMGData', function () {
  it('returns true for valid single-value MGData document', function () {
    expect(isMGData({ _id: 'KEY', MGData: ['hello', 'world'] })).to.equal(true);
  });

  it('returns true for valid multi-value MGData document', function () {
    expect(isMGData({ _id: 'KEY', MGData: [['a', 'b'], 'c'] })).to.equal(true);
  });

  it('returns true for valid sub-value MGData document', function () {
    expect(isMGData({ _id: 'KEY', MGData: [[['x', 'y'], 'z']] })).to.equal(
      true
    );
  });

  it('returns true for mixed MGData document', function () {
    expect(
      isMGData({ _id: 'K', MGData: ['str', ['mv1', 'mv2'], [['sv1', 'sv2']]] })
    ).to.equal(true);
  });

  it('returns false for non-object', function () {
    expect(isMGData('string' as any)).to.equal(false);
    expect(isMGData(42 as any)).to.equal(false);
    expect(isMGData(null as any)).to.equal(false);
    expect(isMGData(undefined as any)).to.equal(false);
  });

  it('returns false for missing _id', function () {
    expect(isMGData({ MGData: ['a'] } as any)).to.equal(false);
  });

  it('returns false for missing MGData', function () {
    expect(isMGData({ _id: 'KEY', name: 'test' })).to.equal(false);
  });

  it('returns false for non-array MGData', function () {
    expect(isMGData({ _id: 'KEY', MGData: 'not-array' })).to.equal(false);
  });

  it('returns false for empty MGData array', function () {
    expect(isMGData({ _id: 'KEY', MGData: [] })).to.equal(false);
  });

  it('returns false for MGData containing plain objects', function () {
    expect(isMGData({ _id: 'KEY', MGData: [{ name: 'John' }] })).to.equal(
      false
    );
  });

  it('returns false for MGData with nested objects', function () {
    expect(isMGData({ _id: 'KEY', MGData: [['a', { bad: true }]] })).to.equal(
      false
    );
  });

  it('returns true for single-element MGData document', function () {
    expect(isMGData({ _id: 'KEY', MGData: ['only'] })).to.equal(true);
  });

  it('allows null/undefined elements (sparse attributes)', function () {
    expect(isMGData({ _id: 'KEY', MGData: ['a', null, 'c'] })).to.equal(true);
    expect(isMGData({ _id: 'KEY', MGData: ['a', undefined, 'c'] })).to.equal(
      true
    );
  });

  it('allows numbers in MGData (tolerant)', function () {
    expect(isMGData({ _id: 'KEY', MGData: [42, 'hello'] })).to.equal(true);
  });

  it('allows extra fields on document', function () {
    expect(isMGData({ _id: 'KEY', MGData: ['val'], extra: true })).to.equal(
      true
    );
  });
});
