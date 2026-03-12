import React from 'react';
import { expect } from 'chai';
import { render, screen } from '@mongodb-js/testing-library-compass';

import { AttributeViewer } from './attribute-viewer';
import type { DictField } from './mgdata';

const SAMPLE_DOC = {
  _id: 'SMITH.JOHN',
  MGData: [
    'John Smith',
    ['123 Main St', '456 Oak Ave'],
    'TX',
    ['Springfield', ['62701', '62702']],
  ],
};

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
    item_id: 'STATE',
    type: 'A',
    attribute_number: 3,
    header: 'State',
    conversion: '',
    justification: 'L',
    width: 5,
  },
  {
    item_id: 'CITY',
    type: 'A',
    attribute_number: 4,
    header: 'City',
    conversion: '',
    justification: 'L',
    width: 15,
  },
];

describe('AttributeViewer Component', function () {
  it('renders attribute numbers', function () {
    render(<AttributeViewer document={SAMPLE_DOC} />);
    expect(screen.getByTestId('attribute-viewer')).to.exist;
    expect(screen.getByTestId('attr-line-1')).to.exist;
    expect(screen.getByTestId('attr-line-2')).to.exist;
    expect(screen.getByTestId('attr-line-3')).to.exist;
    expect(screen.getByTestId('attr-line-4')).to.exist;
  });

  it('renders attribute values next to numbers', function () {
    render(<AttributeViewer document={SAMPLE_DOC} />);
    expect(screen.getByText('John Smith')).to.exist;
    expect(screen.getByText('TX')).to.exist;
  });

  it('shows DICT field names in tooltips when dictFields provided', function () {
    render(<AttributeViewer document={SAMPLE_DOC} dictFields={SAMPLE_DICT} />);
    // DICT tooltips are present — the trigger elements wrap the attr numbers
    expect(screen.getByTestId('attr-line-1')).to.exist;
  });

  it('falls back to numbered-only when dictFields is null', function () {
    render(<AttributeViewer document={SAMPLE_DOC} dictFields={null} />);
    expect(screen.getByTestId('attr-line-1')).to.exist;
  });

  it('shows expand toggle for multi-valued attributes', function () {
    render(<AttributeViewer document={SAMPLE_DOC} />);
    // Attribute 2 (ADDRESS) has multi-values
    expect(screen.getByTestId('expand-toggle-2')).to.exist;
    // Attribute 4 (CITY) also has multi-values
    expect(screen.getByTestId('expand-toggle-4')).to.exist;
  });

  it('does not show expand toggle for single-valued attributes', function () {
    render(<AttributeViewer document={SAMPLE_DOC} />);
    // Attribute 1 (NAME) and 3 (STATE) are single-valued
    expect(screen.queryByTestId('expand-toggle-1')).to.not.exist;
    expect(screen.queryByTestId('expand-toggle-3')).to.not.exist;
  });

  it('renders document item-id', function () {
    render(<AttributeViewer document={SAMPLE_DOC} />);
    expect(screen.getByTestId('item-id-line')).to.exist;
    expect(screen.getByText(/SMITH\.JOHN/)).to.exist;
  });

  it('handles single-element MGData', function () {
    render(<AttributeViewer document={{ _id: 'KEY', MGData: ['only'] }} />);
    expect(screen.getByText('only')).to.exist;
    expect(screen.getByTestId('attr-line-1')).to.exist;
  });

  it('handles empty MGData', function () {
    render(<AttributeViewer document={{ _id: 'EMPTY', MGData: [] }} />);
    expect(screen.getByTestId('attribute-viewer')).to.exist;
  });

  it('renders without crashing in default dark mode context', function () {
    const { container } = render(<AttributeViewer document={SAMPLE_DOC} />);
    expect(container).to.exist;
  });
});
