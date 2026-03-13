import React from 'react';
import { expect } from 'chai';
import sinon from 'sinon';
import { render, screen } from '@mongodb-js/testing-library-compass';

import { DualQueryBar } from './dual-query-bar';

describe('DualQueryBar Component Rendering', function () {
  it('renders both input fields', function () {
    render(
      <DualQueryBar
        database="PROD"
        collection="CUSTOMERS"
        onApplyQuery={sinon.stub()}
        bridgeClient={null}
      />
    );
    expect(screen.getByTestId('dual-query-bar')).to.exist;
    expect(screen.getByTestId('mongo-filter-input')).to.exist;
    expect(screen.getByTestId('pick-query-input')).to.exist;
  });

  it('Pick field is disabled when bridgeClient is null', function () {
    render(
      <DualQueryBar
        database="PROD"
        collection="CUSTOMERS"
        onApplyQuery={sinon.stub()}
        bridgeClient={null}
      />
    );
    const pickInput = screen.getByTestId('pick-query-input');
    expect(pickInput.hasAttribute('disabled')).to.equal(true);
  });

  it('MongoDB field is always enabled', function () {
    render(
      <DualQueryBar
        database="PROD"
        collection="CUSTOMERS"
        onApplyQuery={sinon.stub()}
        bridgeClient={null}
      />
    );
    const mongoInput = screen.getByTestId('mongo-filter-input');
    expect(mongoInput.hasAttribute('disabled')).to.equal(false);
  });

  it('does not render Apply button (Enter key triggers action)', function () {
    render(
      <DualQueryBar
        database="PROD"
        collection="CUSTOMERS"
        onApplyQuery={sinon.stub()}
        bridgeClient={null}
      />
    );
    expect(screen.queryByTestId('apply-query-button')).to.be.null;
  });

  it('renders with initialFilter populated', function () {
    render(
      <DualQueryBar
        database="PROD"
        collection="CUSTOMERS"
        onApplyQuery={sinon.stub()}
        bridgeClient={null}
        initialFilter='{"MGData.4": "TX"}'
      />
    );
    const mongoInput = screen.getByTestId(
      'mongo-filter-input'
    ) as HTMLTextAreaElement;
    expect(mongoInput.value).to.equal('{"MGData.4": "TX"}');
  });
});
