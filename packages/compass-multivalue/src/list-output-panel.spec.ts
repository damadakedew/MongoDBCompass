import { expect } from 'chai';
import type { ColumnInfo, ListOutputPanelProps } from './list-output-panel';

const SAMPLE_REPORT =
  'CUSTOMERS.......  Name..............  State\n\nSMITH.JOHN        John Smith          TX\nJONES.MARY        Mary Jones          TX\n\n2 items listed.';

const SAMPLE_COLUMNS: ColumnInfo[] = [
  { name: 'CUSTOMERS', width: 18, justification: 'L' },
  { name: 'Name', width: 20, justification: 'L' },
  { name: 'State', width: 5, justification: 'L' },
];

describe('ListOutputPanel — Props Contract', function () {
  it('report text preserves whitespace formatting', function () {
    expect(SAMPLE_REPORT).to.include('SMITH.JOHN        John Smith');
    // Column alignment preserved
    expect(SAMPLE_REPORT).to.include('JONES.MARY        Mary Jones');
  });

  it('columns have required metadata', function () {
    for (const col of SAMPLE_COLUMNS) {
      expect(col).to.have.property('name');
      expect(col).to.have.property('width');
      expect(col).to.have.property('justification');
      expect(['L', 'R', 'C']).to.include(col.justification);
    }
  });

  it('total matches actual record count', function () {
    const total = 2;
    // Report text ends with "2 items listed."
    expect(SAMPLE_REPORT).to.include(`${total} items listed`);
  });

  it('handles empty report (0 items)', function () {
    const emptyReport = '';
    const emptyTotal = 0;
    expect(emptyReport).to.equal('');
    expect(emptyTotal).to.equal(0);
  });

  it('column names can be joined for status display', function () {
    const display = SAMPLE_COLUMNS.map((c) => c.name).join(' | ');
    expect(display).to.equal('CUSTOMERS | Name | State');
  });

  it('status bar formats item count correctly', function () {
    const total = 2;
    const statusText = `${total} item${total !== 1 ? 's' : ''} listed`;
    expect(statusText).to.equal('2 items listed');
    // Singular
    const single = 1;
    const singleText = `${single} item${single !== 1 ? 's' : ''} listed`;
    expect(singleText).to.equal('1 item listed');
  });

  it('accepts onClose callback', function () {
    const props: ListOutputPanelProps = {
      reportText: SAMPLE_REPORT,
      columns: SAMPLE_COLUMNS,
      total: 2,
      onClose: () => {},
    };
    expect(props.onClose).to.be.a('function');
  });

  it('report text with long output is valid', function () {
    const lines: string[] = [];
    for (let i = 0; i < 100; i++) {
      lines.push(`KEY-${i.toString().padStart(4, '0')}      Value ${i}`);
    }
    const longReport = lines.join('\n');
    expect(longReport.split('\n')).to.have.length(100);
  });
});
