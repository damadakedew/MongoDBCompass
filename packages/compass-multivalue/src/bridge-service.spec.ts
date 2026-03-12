import { expect } from 'chai';
import sinon from 'sinon';
import {
  getBridgeClient,
  initBridgeClient,
  disconnectBridge,
  onBridgeStatusChange,
  connectBridgeFromPreferences,
} from './bridge-service';
import { BridgeClient } from './bridge-client';

// Minimal WebSocket mock for Node.js testing
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
    setTimeout(() => this.onopen?.(), 0);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }
}

describe('bridge-service', function () {
  let originalWebSocket: typeof globalThis.WebSocket;

  beforeEach(function () {
    MockWebSocket.instances = [];
    originalWebSocket = (globalThis as any).WebSocket;
    (globalThis as any).WebSocket = MockWebSocket as any;
    disconnectBridge(); // Clean state
  });

  afterEach(function () {
    disconnectBridge();
    (globalThis as any).WebSocket = originalWebSocket;
  });

  describe('getBridgeClient', function () {
    it('returns null when not initialized', function () {
      expect(getBridgeClient()).to.be.null;
    });

    it('returns client after initialization', function () {
      initBridgeClient('ws://localhost:9800');
      const client = getBridgeClient();
      expect(client).to.not.be.null;
      expect(client).to.be.instanceOf(BridgeClient);
    });
  });

  describe('initBridgeClient', function () {
    it('creates a new client with the given URL', function () {
      const client = initBridgeClient('ws://server:1234');
      expect(client.url).to.equal('ws://server:1234');
    });

    it('disconnects previous client on reinit', async function () {
      const client1 = initBridgeClient('ws://server:1111');
      await client1.connect();

      const client2 = initBridgeClient('ws://server:2222');
      expect(client1.status).to.equal('disconnected');
      expect(client2.url).to.equal('ws://server:2222');
      expect(getBridgeClient()).to.equal(client2);
    });
  });

  describe('disconnectBridge', function () {
    it('disconnects and nullifies the client', async function () {
      initBridgeClient('ws://localhost:9800');
      const client = getBridgeClient()!;
      await client.connect();

      disconnectBridge();
      expect(getBridgeClient()).to.be.null;
      expect(client.status).to.equal('disconnected');
    });

    it('is safe to call when no client exists', function () {
      disconnectBridge();
      expect(getBridgeClient()).to.be.null;
    });
  });

  describe('onBridgeStatusChange', function () {
    it('notifies listeners on status changes', async function () {
      const statuses: string[] = [];
      onBridgeStatusChange((s) => statuses.push(s));

      const client = initBridgeClient('ws://localhost:9800');
      await client.connect();

      expect(statuses).to.include('connecting');
      expect(statuses).to.include('connected');
    });

    it('returns unsubscribe function', async function () {
      const statuses: string[] = [];
      const unsub = onBridgeStatusChange((s) => statuses.push(s));

      initBridgeClient('ws://localhost:9800');
      unsub();

      const client = getBridgeClient()!;
      await client.connect();

      // Should NOT have received status changes after unsubscribe
      expect(statuses).to.have.length(0);
    });
  });

  describe('connectBridgeFromPreferences', function () {
    it('connects with a valid URL', async function () {
      const status = await connectBridgeFromPreferences('ws://localhost:9800');
      expect(status).to.equal('connected');
      expect(getBridgeClient()?.status).to.equal('connected');
    });

    it('returns disconnected for empty URL', async function () {
      const status = await connectBridgeFromPreferences('');
      expect(status).to.equal('disconnected');
      expect(getBridgeClient()).to.be.null;
    });

    it('returns error when connection fails', async function () {
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

      const status = await connectBridgeFromPreferences('ws://bad-host:9999');
      expect(status).to.equal('error');
    });
  });
});
