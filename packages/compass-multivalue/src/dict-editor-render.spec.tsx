import React from 'react';
import { expect } from 'chai';
import sinon from 'sinon';
import { render, screen } from '@mongodb-js/testing-library-compass';

import { DictEditor } from './dict-editor';

function createMockBridge() {
  const stub = sinon.stub();
  stub.withArgs('dict.list', sinon.match.any).resolves({
    id: 'test',
    result: {
      dict_collection: 'DICT_CUSTOMERS',
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
  stub.resolves({ id: 'test', result: {}, error: null });

  return {
    status: 'connected',
    request: stub,
    connect: sinon.stub().resolves('connected'),
    disconnect: sinon.stub(),
    onStatusChange: sinon.stub().returns(() => {}),
    onEvent: sinon.stub().returns(() => {}),
    url: 'ws://localhost:9800',
  };
}

describe('DictEditor Component Rendering', function () {
  it('renders the editor container', function () {
    render(
      <DictEditor
        database="PROD"
        collection="CUSTOMERS"
        bridgeClient={createMockBridge() as any}
        onClose={sinon.stub()}
      />
    );
    expect(screen.getByTestId('dict-editor')).to.exist;
  });

  it('renders field list panel', function () {
    render(
      <DictEditor
        database="PROD"
        collection="CUSTOMERS"
        bridgeClient={createMockBridge() as any}
        onClose={sinon.stub()}
      />
    );
    expect(screen.getByTestId('field-list')).to.exist;
  });

  it('renders detail panel', function () {
    render(
      <DictEditor
        database="PROD"
        collection="CUSTOMERS"
        bridgeClient={createMockBridge() as any}
        onClose={sinon.stub()}
      />
    );
    expect(screen.getByTestId('detail-panel')).to.exist;
  });

  it('renders New Field button', function () {
    render(
      <DictEditor
        database="PROD"
        collection="CUSTOMERS"
        bridgeClient={createMockBridge() as any}
        onClose={sinon.stub()}
      />
    );
    expect(screen.getByTestId('new-field-button')).to.exist;
  });

  it('shows error when bridge is null', function () {
    render(
      <DictEditor
        database="PROD"
        collection="CUSTOMERS"
        bridgeClient={null}
        onClose={sinon.stub()}
      />
    );
    expect(screen.getByTestId('field-list-error')).to.exist;
  });
});
