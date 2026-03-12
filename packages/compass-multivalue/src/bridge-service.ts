// MVCompass: Bridge service — singleton BridgeClient with preference integration
//
// Provides a global BridgeClient instance that reads its URL from Compass
// preferences (`mvBridgeUrl`). Components access it via useBridgeClient() hook.
// Graceful degradation: if bridge is unavailable, all MVCompass features fall
// back to numbered-only attribute display (no DICT names).

import { BridgeClient } from './bridge-client';
import type { BridgeStatus } from './bridge-client';

// ── Singleton ───────────────────────────────────────────────────────

let bridgeInstance: BridgeClient | null = null;
const statusListeners: Array<(status: BridgeStatus) => void> = [];
let suppressForwarding = false; // Hold back status during init sequence
let mongoInitDone = false; // True after bridge 'connect' request with MongoDB URI succeeds

/**
 * Get the current bridge client instance (or null if not initialized).
 */
export function getBridgeClient(): BridgeClient | null {
  return bridgeInstance;
}

/**
 * Whether the bridge has completed its MongoDB initialization
 * (WebSocket open AND 'connect' request sent with MongoDB URI).
 */
export function isBridgeMongoReady(): boolean {
  return mongoInitDone;
}

/**
 * Initialize (or reinitialize) the bridge client with a new URL.
 * Disconnects any existing client before creating the new one.
 * Does NOT auto-connect — call connect() separately.
 */
export function initBridgeClient(url: string): BridgeClient {
  if (bridgeInstance) {
    bridgeInstance.disconnect();
  }
  bridgeInstance = new BridgeClient(url);

  // Forward status changes to service-level listeners
  bridgeInstance.onStatusChange((status) => {
    if (suppressForwarding) return; // Hold back during init
    for (const listener of statusListeners) {
      listener(status);
    }
  });

  return bridgeInstance;
}

/**
 * Disconnect and destroy the bridge client.
 */
export function disconnectBridge(): void {
  if (bridgeInstance) {
    bridgeInstance.disconnect();
    bridgeInstance = null;
  }
}

/**
 * Register a listener for bridge status changes at the service level.
 * Returns an unsubscribe function.
 */
export function onBridgeStatusChange(
  listener: (status: BridgeStatus) => void
): () => void {
  statusListeners.push(listener);
  return () => {
    const index = statusListeners.indexOf(listener);
    if (index >= 0) {
      statusListeners.splice(index, 1);
    }
  };
}

/** Notify all service-level status listeners */
function notifyStatus(status: BridgeStatus): void {
  for (const listener of statusListeners) {
    listener(status);
  }
}

/**
 * Initialize the bridge from Compass preferences and attempt to connect.
 * Intended to be called once during app startup or when preferences change.
 * Logs errors but does not throw — bridge unavailability is not fatal.
 *
 * The init sequence:
 * 1. Open WebSocket to bridge server
 * 2. Send 'connect' method with MongoDB connection string (so bridge can query MongoDB)
 * 3. THEN notify listeners as 'connected' (so useDictFields fires dict.list AFTER bridge has a MongoDB client)
 */
export async function connectBridgeFromPreferences(
  mvBridgeUrl: string,
  mongoConnectionString?: string
): Promise<BridgeStatus> {
  if (!mvBridgeUrl) {
    console.debug('[MVCompass] empty bridge URL, skipping');
    return 'disconnected';
  }

  const client = initBridgeClient(mvBridgeUrl);
  try {
    // Suppress status forwarding so useDictFields doesn't fire dict.list
    // before the bridge has a MongoDB connection
    suppressForwarding = true;

    const wsStatus = await client.connect();

    // Send 'connect' method to initialize bridge server-side MongoDB connection
    if (wsStatus === 'connected' && mongoConnectionString) {
      try {
        const resp = await client.request('connect', {
          connection_string: mongoConnectionString,
        });
        console.debug('[MVCompass] bridge MongoDB init complete:', resp.result);
        mongoInitDone = true;
      } catch (err) {
        console.warn('[MVCompass] bridge connect request failed:', err);
      }
    } else if (wsStatus === 'connected' && !mongoConnectionString) {
      console.warn(
        '[MVCompass] bridge connected but no MongoDB connection string available — dict.list will fail'
      );
    }

    // Now allow forwarding and notify — useDictFields will fire dict.list
    suppressForwarding = false;
    notifyStatus('connected');
    return 'connected';
  } catch (err) {
    suppressForwarding = false;
    console.warn('[MVCompass] bridge connection failed:', err);
    return 'error';
  }
}
