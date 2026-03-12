import { expect } from 'chai';
import sinon from 'sinon';
import { BridgeClient, BridgeError } from './bridge-client';
import type { BridgeResponse, BridgeEvent } from './bridge-client';

// Minimal WebSocket mock for Node.js testing (no browser WebSocket)
class MockWebSocket {
  static instances: MockWebSocket[] = [];

  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  sent: string[] = [];
  closed = false;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    // Simulate async connection
    setTimeout(() => this.onopen?.(), 0);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }

  // Test helpers
  simulateMessage(data: Record<string, unknown>): void {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateClose(): void {
    this.onclose?.();
  }

  simulateError(): void {
    this.onerror?.();
  }
}

describe('BridgeClient', function () {
  let originalWebSocket: typeof globalThis.WebSocket;

  beforeEach(function () {
    MockWebSocket.instances = [];
    originalWebSocket = (globalThis as any).WebSocket;
    (globalThis as any).WebSocket = MockWebSocket as any;
  });

  afterEach(function () {
    (globalThis as any).WebSocket = originalWebSocket;
  });

  describe('constructor', function () {
    it('uses default URL', function () {
      const client = new BridgeClient();
      expect(client.url).to.equal('ws://localhost:9800');
      expect(client.status).to.equal('disconnected');
    });

    it('accepts custom URL', function () {
      const client = new BridgeClient('ws://server:1234');
      expect(client.url).to.equal('ws://server:1234');
    });
  });

  describe('connect', function () {
    it('connects successfully', async function () {
      const client = new BridgeClient();
      const status = await client.connect();
      expect(status).to.equal('connected');
      expect(client.status).to.equal('connected');
    });

    it('returns connected if already connected', async function () {
      const client = new BridgeClient();
      await client.connect();
      const status = await client.connect();
      expect(status).to.equal('connected');
      expect(MockWebSocket.instances).to.have.length(1); // No second WebSocket
    });

    it('notifies status listeners', async function () {
      const client = new BridgeClient();
      const statuses: string[] = [];
      client.onStatusChange((s) => statuses.push(s));
      await client.connect();
      expect(statuses).to.include('connecting');
      expect(statuses).to.include('connected');
    });

    it('rejects on connection error', async function () {
      (globalThis as any).WebSocket = class {
        onopen: any;
        onerror: any;
        onclose: any;
        onmessage: any;
        constructor() {
          setTimeout(() => this.onerror?.(), 0);
        }
        send() {}
        close() {}
      };

      const client = new BridgeClient();
      try {
        await client.connect();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).to.include('Failed to connect');
        expect(client.status).to.equal('error');
      }
    });
  });

  describe('request', function () {
    it('sends JSON envelope and resolves on response', async function () {
      const client = new BridgeClient();
      await client.connect();
      const ws = MockWebSocket.instances[0];

      const promise = client.request('dict.list', { database: 'PROD' });

      // Parse the sent message to get the ID
      expect(ws.sent).to.have.length(1);
      const sent = JSON.parse(ws.sent[0]);
      expect(sent.method).to.equal('dict.list');
      expect(sent.params).to.deep.equal({ database: 'PROD' });
      expect(sent.id).to.be.a('string');

      // Simulate server response
      ws.simulateMessage({
        id: sent.id,
        result: { fields: [] },
        error: null,
      });

      const response = await promise;
      expect(response.result).to.deep.equal({ fields: [] });
    });

    it('rejects with BridgeError on server error', async function () {
      const client = new BridgeClient();
      await client.connect();
      const ws = MockWebSocket.instances[0];

      const promise = client.request('bad.method', {});
      const sent = JSON.parse(ws.sent[0]);

      ws.simulateMessage({
        id: sent.id,
        result: null,
        error: { code: 1000, message: 'Unknown method' },
      });

      try {
        await promise;
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).to.be.instanceOf(BridgeError);
        expect(err.code).to.equal(1000);
        expect(err.message).to.equal('Unknown method');
      }
    });

    it('rejects if not connected', async function () {
      const client = new BridgeClient();
      try {
        await client.request('test', {});
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).to.include('Not connected');
      }
    });

    it('rejects on timeout', async function () {
      const client = new BridgeClient('ws://localhost:9800', 50);
      await client.connect();

      try {
        await client.request('slow.method', {}, 50);
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).to.include('timed out');
      }
    });
  });

  describe('onEvent', function () {
    it('dispatches server-push events', async function () {
      const client = new BridgeClient();
      await client.connect();
      const ws = MockWebSocket.instances[0];

      const received: Record<string, unknown>[] = [];
      client.onEvent('shell.output', (data) => received.push(data));

      ws.simulateMessage({
        event: 'shell.output',
        session_id: 'sess-1',
        data: { text: 'hello\n', prompt: '>' },
      });

      expect(received).to.have.length(1);
      expect(received[0]).to.deep.equal({ text: 'hello\n', prompt: '>' });
    });

    it('returns unsubscribe function', async function () {
      const client = new BridgeClient();
      await client.connect();
      const ws = MockWebSocket.instances[0];

      const received: string[] = [];
      const unsub = client.onEvent('test', () => received.push('hit'));

      ws.simulateMessage({ event: 'test', data: {} });
      expect(received).to.have.length(1);

      unsub();
      ws.simulateMessage({ event: 'test', data: {} });
      expect(received).to.have.length(1); // No second hit
    });

    it('does not dispatch unmatched events', async function () {
      const client = new BridgeClient();
      await client.connect();
      const ws = MockWebSocket.instances[0];

      const received: string[] = [];
      client.onEvent('shell.output', () => received.push('hit'));

      ws.simulateMessage({ event: 'import.progress', data: {} });
      expect(received).to.have.length(0);
    });
  });

  describe('disconnect', function () {
    it('closes WebSocket and rejects pending requests', async function () {
      const client = new BridgeClient();
      await client.connect();
      const ws = MockWebSocket.instances[0];

      const promise = client.request('test', {});
      client.disconnect();

      expect(ws.closed).to.be.true;
      expect(client.status).to.equal('disconnected');

      try {
        await promise;
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).to.include('disconnected');
      }
    });
  });

  describe('unexpected close', function () {
    it('rejects pending requests on server disconnect', async function () {
      const client = new BridgeClient();
      await client.connect();
      const ws = MockWebSocket.instances[0];

      const promise = client.request('test', {});
      ws.simulateClose();

      expect(client.status).to.equal('disconnected');

      try {
        await promise;
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).to.include('closed');
      }
    });
  });

  describe('onStatusChange', function () {
    it('returns unsubscribe function', async function () {
      const client = new BridgeClient();
      const statuses: string[] = [];
      const unsub = client.onStatusChange((s) => statuses.push(s));

      await client.connect();
      unsub();
      client.disconnect();

      // Should have connecting + connected, but NOT disconnected
      expect(statuses).to.include('connecting');
      expect(statuses).to.include('connected');
      expect(statuses).to.not.include('disconnected');
    });
  });
});
