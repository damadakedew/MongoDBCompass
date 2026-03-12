/**
 * MVCompass: WebSocket bridge client.
 *
 * Connects Compass to the Python bridge server (see bridge-contract.md).
 * Implements request/response matching via UUID ids and server-push event handling.
 *
 * Usage:
 *   const client = new BridgeClient('ws://localhost:9800');
 *   await client.connect();
 *   const result = await client.request('dict.list', { database: 'PROD', collection: 'CUSTOMERS' });
 *   client.onEvent('shell.output', (data) => console.log(data));
 *   client.disconnect();
 */

/** Bridge connection status */
export type BridgeStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

/** Bridge request envelope (client -> server) */
export interface BridgeRequest {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

/** Bridge response envelope (server -> client) */
export interface BridgeResponse {
  id: string;
  api_version?: number;
  result: Record<string, unknown> | null;
  error: { code: number; message: string } | null;
}

/** Bridge server-initiated event */
export interface BridgeEvent {
  event: string;
  session_id?: string;
  job_id?: string;
  data: Record<string, unknown>;
}

/** Error thrown when a bridge request fails */
export class BridgeError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
  }
}

const DEFAULT_BRIDGE_URL = 'ws://localhost:9800';
const DEFAULT_TIMEOUT_MS = 30000;

/** Pending request awaiting a response */
interface PendingRequest {
  resolve: (response: BridgeResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

type EventHandler = (data: Record<string, unknown>, event: BridgeEvent) => void;

/** Generate a simple UUID v4 */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * WebSocket bridge client for the D3PyMongo Python bridge server.
 *
 * Handles:
 * - Connection lifecycle (connect, disconnect, reconnect)
 * - Request/response matching via UUID ids
 * - Server-push event subscription
 * - Request timeouts
 */
export class BridgeClient {
  private _url: string;
  private _status: BridgeStatus = 'disconnected';
  private _ws: WebSocket | null = null;
  private _pending: Map<string, PendingRequest> = new Map();
  private _eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private _timeoutMs: number;
  private _statusListeners: Set<(status: BridgeStatus) => void> = new Set();

  constructor(
    url: string = DEFAULT_BRIDGE_URL,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ) {
    this._url = url;
    this._timeoutMs = timeoutMs;
  }

  get url(): string {
    return this._url;
  }

  get status(): BridgeStatus {
    return this._status;
  }

  /**
   * Register a callback for status changes.
   */
  onStatusChange(listener: (status: BridgeStatus) => void): () => void {
    this._statusListeners.add(listener);
    return () => {
      this._statusListeners.delete(listener);
    };
  }

  private _setStatus(status: BridgeStatus): void {
    this._status = status;
    for (const listener of this._statusListeners) {
      try {
        listener(status);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Connect to the bridge server.
   * Resolves when the WebSocket connection is established.
   * Rejects if the connection fails or times out.
   */
  connect(): Promise<BridgeStatus> {
    if (this._status === 'connected' && this._ws) {
      return Promise.resolve('connected' as BridgeStatus);
    }

    this._setStatus('connecting');

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._setStatus('error');
        reject(new Error(`Connection to ${this._url} timed out`));
      }, this._timeoutMs);

      try {
        console.debug('[MVCompass] Creating WebSocket to:', this._url);
        const ws = new WebSocket(this._url);

        ws.onopen = () => {
          console.debug('[MVCompass] WebSocket connected');
          clearTimeout(timer);
          this._ws = ws;
          this._setStatus('connected');
          resolve('connected');
        };

        ws.onerror = (e) => {
          console.warn('[MVCompass] WebSocket error:', e);
          clearTimeout(timer);
          this._setStatus('error');
          reject(new Error(`Failed to connect to bridge at ${this._url}`));
        };

        ws.onclose = () => {
          this._handleClose();
        };

        ws.onmessage = (event: MessageEvent) => {
          this._handleMessage(event.data);
        };
      } catch (err) {
        clearTimeout(timer);
        this._setStatus('error');
        reject(err);
      }
    });
  }

  /**
   * Send a request to the bridge and await the response.
   *
   * @param method - API method name (e.g., 'dict.list', 'query.execute')
   * @param params - Method parameters
   * @param timeoutMs - Override default timeout for this request
   * @returns The response envelope (check .error for failures)
   * @throws BridgeError if the server returns an error
   * @throws Error if not connected or request times out
   */
  request(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs?: number
  ): Promise<BridgeResponse> {
    if (this._status !== 'connected' || !this._ws) {
      return Promise.reject(new Error('Not connected to bridge server'));
    }

    const id = uuid();
    const timeout = timeoutMs ?? this._timeoutMs;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error(`Request ${method} timed out after ${timeout}ms`));
      }, timeout);

      this._pending.set(id, { resolve, reject, timer });

      const envelope: BridgeRequest = { id, method, params };
      try {
        this._ws!.send(JSON.stringify(envelope));
      } catch (err) {
        clearTimeout(timer);
        this._pending.delete(id);
        reject(err);
      }
    });
  }

  /**
   * Register a handler for server-push events.
   *
   * @param eventName - Event name (e.g., 'shell.output', 'import.progress')
   * @param handler - Callback receiving (data, fullEvent)
   * @returns Unsubscribe function
   */
  onEvent(eventName: string, handler: EventHandler): () => void {
    if (!this._eventHandlers.has(eventName)) {
      this._eventHandlers.set(eventName, new Set());
    }
    this._eventHandlers.get(eventName)!.add(handler);

    return () => {
      const handlers = this._eventHandlers.get(eventName);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this._eventHandlers.delete(eventName);
        }
      }
    };
  }

  /**
   * Disconnect from the bridge server.
   * Rejects all pending requests.
   */
  disconnect(): void {
    if (this._ws) {
      this._ws.onclose = null; // Prevent _handleClose from firing
      this._ws.close();
      this._ws = null;
    }
    this._rejectAllPending('Client disconnected');
    this._setStatus('disconnected');
  }

  /**
   * Handle an incoming WebSocket message.
   * Dispatches to pending request or event handler.
   */
  private _handleMessage(data: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(data);
    } catch {
      return; // Ignore malformed messages
    }

    // Server-push event (has 'event' field, no 'id')
    if ('event' in msg && typeof msg.event === 'string') {
      const event = msg as unknown as BridgeEvent;
      const handlers = this._eventHandlers.get(event.event);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(event.data ?? {}, event);
          } catch {
            // Ignore handler errors
          }
        }
      }
      return;
    }

    // Response to a pending request (has 'id' field)
    if ('id' in msg && typeof msg.id === 'string') {
      const pending = this._pending.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this._pending.delete(msg.id);

        const response = msg as unknown as BridgeResponse;
        if (response.error) {
          pending.reject(
            new BridgeError(response.error.code, response.error.message)
          );
        } else {
          pending.resolve(response);
        }
      }
    }
  }

  /**
   * Handle WebSocket close (unexpected disconnect).
   */
  private _handleClose(): void {
    console.debug('[MVCompass] WebSocket closed');
    this._ws = null;
    this._rejectAllPending('Connection closed');
    this._setStatus('disconnected');
  }

  /**
   * Reject all pending requests with the given reason.
   */
  private _rejectAllPending(reason: string): void {
    for (const [id, pending] of this._pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
      this._pending.delete(id);
    }
  }
}
