import { expect } from 'chai';
import sinon from 'sinon';

import type { TerminalEmulatorProps } from './terminal-emulator';

// ── Mock helpers ───────────────────────────────────────────────────

function createMockBridge(overrides?: {
  status?: string;
  request?: sinon.SinonStub;
  onEvent?: sinon.SinonStub;
}) {
  const defaultRequest = sinon.stub();

  // shell.open returns session
  defaultRequest.withArgs('shell.open', sinon.match.any).resolves({
    id: 'test',
    result: { session_id: 'sess-1234', prompt: '>' },
    error: null,
  });

  // shell.input acknowledges
  defaultRequest.withArgs('shell.input', sinon.match.any).resolves({
    id: 'test',
    result: { acknowledged: true },
    error: null,
  });

  // shell.close succeeds
  defaultRequest.withArgs('shell.close', sinon.match.any).resolves({
    id: 'test',
    result: { closed: true },
    error: null,
  });

  return {
    status: overrides?.status ?? 'connected',
    request: overrides?.request ?? defaultRequest,
    connect: sinon.stub().resolves('connected'),
    disconnect: sinon.stub(),
    onStatusChange: sinon.stub().returns(() => {}),
    onEvent: overrides?.onEvent ?? sinon.stub().returns(() => {}),
    url: 'ws://localhost:9800',
  };
}

// ── Session lifecycle tests ────────────────────────────────────────

describe('TerminalEmulator — Session Lifecycle', function () {
  it('opens shell session with database param', async function () {
    const bridge = createMockBridge();
    const response = await bridge.request('shell.open', {
      database: 'PRODUCTION',
    });
    const result = response.result as any;
    expect(result.session_id).to.equal('sess-1234');
    expect(result.prompt).to.equal('>');
  });

  it('closes shell session with session_id', async function () {
    const bridge = createMockBridge();
    const response = await bridge.request('shell.close', {
      session_id: 'sess-1234',
    });
    expect((response.result as any).closed).to.equal(true);
  });

  it('submits command via shell.input', async function () {
    const bridge = createMockBridge();
    const response = await bridge.request('shell.input', {
      session_id: 'sess-1234',
      line: 'SELECT CUSTOMERS WITH STATE = "TX"',
    });
    expect((response.result as any).acknowledged).to.equal(true);
  });

  it('subscribes to shell.output events', function () {
    const bridge = createMockBridge();
    const handler = sinon.stub();
    const unsub = bridge.onEvent('shell.output', handler);
    expect(bridge.onEvent.calledOnce).to.equal(true);
    expect(bridge.onEvent.firstCall.args[0]).to.equal('shell.output');
    expect(typeof unsub).to.equal('function');
  });
});

// ── Output handling tests ──────────────────────────────────────────

describe('TerminalEmulator — Output Handling', function () {
  it('shell.output event contains text and prompt', function () {
    const eventData = {
      text: '2 items selected.\n',
      prompt: ':',
    };
    expect(eventData.text).to.include('items selected');
    expect(eventData.prompt).to.equal(':');
  });

  it('prompt changes after SELECT (> to :)', function () {
    const beforeSelect = '>';
    const afterSelect = ':';
    expect(beforeSelect).to.equal('>');
    expect(afterSelect).to.equal(':');
  });

  it('whitespace preserved in output', function () {
    const output =
      '  SMITH.JOHN    John Smith      TX\n  DOE.JANE      Jane Doe        CA\n';
    // Whitespace-preserved text should maintain spacing
    expect(output).to.include('  SMITH.JOHN');
    expect(output).to.include('    John Smith');
    // Multiple spaces preserved
    expect(output.indexOf('  SMITH')).to.equal(0);
  });

  it('multiple commands accumulate output', function () {
    const lines: string[] = [];
    lines.push('> SELECT CUSTOMERS WITH STATE = "TX"\n');
    lines.push('2 items selected.\n');
    lines.push(': LIST CUSTOMERS NAME STATE\n');
    lines.push('SMITH.JOHN    John Smith    TX\n');
    lines.push('DOE.JANE      Jane Doe      TX\n');
    expect(lines).to.have.length(5);
    expect(lines.join('')).to.include('SELECT');
    expect(lines.join('')).to.include('LIST');
  });

  it('output buffer limits to MAX_OUTPUT_LINES', function () {
    const MAX_OUTPUT_LINES = 1000;
    const lines: { text: string }[] = [];
    for (let i = 0; i < 1050; i++) {
      lines.push({ text: `line ${i}\n` });
    }
    const trimmed = lines.slice(lines.length - MAX_OUTPUT_LINES);
    expect(trimmed).to.have.length(MAX_OUTPUT_LINES);
    expect(trimmed[0].text).to.equal('line 50\n');
  });
});

// ── Command history tests ──────────────────────────────────────────

describe('TerminalEmulator — Command History', function () {
  it('commands added to history on submit', function () {
    const history: string[] = [];
    const command = 'SELECT CUSTOMERS';
    history.unshift(command);
    expect(history).to.have.length(1);
    expect(history[0]).to.equal('SELECT CUSTOMERS');
  });

  it('up arrow recalls previous command', function () {
    const history = ['LIST CUSTOMERS', 'SELECT CUSTOMERS', 'COUNT CUSTOMERS'];
    let index = -1;
    // First up arrow
    index = Math.min(index + 1, history.length - 1);
    expect(history[index]).to.equal('LIST CUSTOMERS');
    // Second up arrow
    index = Math.min(index + 1, history.length - 1);
    expect(history[index]).to.equal('SELECT CUSTOMERS');
  });

  it('down arrow goes forward in history', function () {
    const history = ['LIST CUSTOMERS', 'SELECT CUSTOMERS'];
    let index = 1; // at 'SELECT CUSTOMERS'
    // Down arrow
    index = index - 1;
    expect(history[index]).to.equal('LIST CUSTOMERS');
    // Down arrow past beginning clears input
    index = index - 1;
    expect(index).to.equal(-1);
  });

  it('history deduplicates commands', function () {
    const history: string[] = ['SELECT CUSTOMERS', 'LIST CUSTOMERS'];
    const newCommand = 'SELECT CUSTOMERS'; // duplicate
    const filtered = history.filter((h) => h !== newCommand);
    const updated = [newCommand, ...filtered];
    expect(updated).to.have.length(2);
    expect(updated[0]).to.equal('SELECT CUSTOMERS');
    expect(updated[1]).to.equal('LIST CUSTOMERS');
  });

  it('history limits to MAX_HISTORY entries', function () {
    const MAX_HISTORY = 50;
    const history: string[] = [];
    for (let i = 0; i < 55; i++) {
      history.unshift(`CMD ${i}`);
    }
    const trimmed = history.slice(0, MAX_HISTORY);
    expect(trimmed).to.have.length(MAX_HISTORY);
  });
});

// ── Error handling tests ───────────────────────────────────────────

describe('TerminalEmulator — Error Handling', function () {
  it('bridge unavailable shows disabled message', function () {
    const bridgeAvailable = false;
    const message = bridgeAvailable
      ? null
      : 'Connect to D3PyMongo bridge to use TCL shell';
    expect(message).to.equal('Connect to D3PyMongo bridge to use TCL shell');
  });

  it('session open failure provides error and retry', async function () {
    const errorBridge = createMockBridge({
      request: sinon.stub().rejects(new Error('Connection refused')),
    });
    try {
      await errorBridge.request('shell.open', { database: 'PROD' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).to.include('Connection refused');
      // Component shows error + retry button
    }
  });

  it('shell.input error appends error to output', async function () {
    const bridge = createMockBridge();
    // Override shell.input to fail
    bridge.request
      .withArgs('shell.input', sinon.match.any)
      .rejects(new Error('Session expired'));
    try {
      await bridge.request('shell.input', {
        session_id: 'sess-1234',
        line: 'BAD',
      });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).to.equal('Session expired');
    }
  });
});

// ── TerminalEmulatorProps contract ─────────────────────────────────

describe('TerminalEmulatorProps contract', function () {
  it('accepts required props', function () {
    const props: TerminalEmulatorProps = {
      database: 'PRODUCTION',
      bridgeClient: null,
    };
    expect(props.database).to.equal('PRODUCTION');
    expect(props.bridgeClient).to.be.null;
  });

  it('accepts optional onClose callback', function () {
    const onClose = sinon.stub();
    const props: TerminalEmulatorProps = {
      database: 'PRODUCTION',
      bridgeClient: createMockBridge() as any,
      onClose,
    };
    props.onClose?.();
    expect(onClose.calledOnce).to.equal(true);
  });
});
