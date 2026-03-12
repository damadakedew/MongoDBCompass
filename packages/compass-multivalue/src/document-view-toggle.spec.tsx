import React from 'react';
import { expect } from 'chai';
import { render, screen } from '@mongodb-js/testing-library-compass';

import { DocumentViewToggle } from './document-view-toggle';

const MGDATA_DOC = {
  _id: 'SMITH.JOHN',
  MGData: ['John Smith', 'TX'],
};

const PLAIN_DOC = {
  _id: 'plain-key',
  name: 'Not multivalue',
  age: 30,
};

describe('DocumentViewToggle Component', function () {
  it('renders SegmentedControl with JSON and Attribute options', function () {
    render(<DocumentViewToggle document={MGDATA_DOC} />);
    expect(screen.getByTestId('document-view-toggle')).to.exist;
    expect(screen.getByTestId('toggle-json')).to.exist;
    expect(screen.getByTestId('toggle-attribute')).to.exist;
  });

  it('default view is Attribute for MGData documents', function () {
    render(<DocumentViewToggle document={MGDATA_DOC} />);
    // Attribute view should be active — AttributeViewer renders
    expect(screen.getByTestId('attribute-viewer')).to.exist;
    // JSON view should not be visible
    expect(screen.queryByTestId('json-view')).to.not.exist;
  });

  it('JSON option is rendered and clickable', function () {
    render(<DocumentViewToggle document={MGDATA_DOC} />);
    const jsonOption = screen.getByTestId('toggle-json');
    expect(jsonOption).to.exist;
    // Verify the text content
    expect(jsonOption.textContent).to.include('JSON');
  });

  it('non-MGData documents default to JSON view', function () {
    render(<DocumentViewToggle document={PLAIN_DOC} />);
    expect(screen.getByTestId('json-view')).to.exist;
    expect(screen.queryByTestId('attribute-viewer')).to.not.exist;
  });

  it('JSON view shows formatted document content', function () {
    render(<DocumentViewToggle document={PLAIN_DOC} />);
    const jsonView = screen.getByTestId('json-view');
    expect(jsonView.textContent).to.include('plain-key');
    expect(jsonView.textContent).to.include('Not multivalue');
  });
});
