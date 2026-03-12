// MVCompass: React hooks for bridge client and DICT data
//
// useBridgeClient() — returns the singleton BridgeClient (or null)
// useBridgeStatus() — reactive bridge connection status
// useDictFields(database, collection) — fetches and caches DICT fields

import { useState, useEffect, useRef, useCallback } from 'react';
import type { BridgeStatus } from './bridge-client';
import type { DictField } from './mgdata';
import { getBridgeClient, onBridgeStatusChange } from './bridge-service';

/**
 * Returns the current BridgeClient instance, or null if not initialized.
 * Re-renders when bridge status changes so the client reference stays current.
 */
export function useBridgeClient() {
  // Subscribe to status changes so we re-render when bridge connects/disconnects
  useBridgeStatus();
  return getBridgeClient();
}

/**
 * Returns the current bridge connection status, re-rendering on changes.
 */
export function useBridgeStatus(): BridgeStatus {
  const client = getBridgeClient();
  const [status, setStatus] = useState<BridgeStatus>(
    client?.status ?? 'disconnected'
  );

  useEffect(() => {
    // Listen to service-level status changes only — do NOT read client.status
    // directly, because the service may be suppressing status during the
    // bridge MongoDB init sequence (connect request must complete first)
    const unsub = onBridgeStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    return unsub;
  }, []);

  return status;
}

// Simple DICT cache keyed by "database/collection"
const dictCache = new Map<string, DictField[]>();

/**
 * Fetches DICT fields for a collection from the bridge server.
 * Caches results per collection. Returns null while loading or if unavailable.
 */
export function useDictFields(
  database: string | null,
  collection: string | null
): DictField[] | null {
  const [fields, setFields] = useState<DictField[] | null>(null);
  const [loading, setLoading] = useState(false);
  const status = useBridgeStatus();
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;

    if (!database || !collection) {
      setFields(null);
      return;
    }

    const cacheKey = `${database}/${collection}`;

    // Return cached result if available
    const cached = dictCache.get(cacheKey);
    if (cached) {
      setFields(cached);
      return;
    }

    const client = getBridgeClient();
    if (!client || status !== 'connected') {
      setFields(null);
      return;
    }

    console.debug('[MVCompass] useDictFields: fetching', cacheKey);
    setLoading(true);
    client
      .request('dict.list', { database, collection })
      .then((response) => {
        if (abortRef.current) return;
        const result = response.result as { fields?: DictField[] } | null;
        const dictFields = result?.fields ?? null;
        console.debug(
          '[MVCompass] useDictFields: loaded',
          dictFields?.length ?? 0,
          'fields for',
          cacheKey
        );
        if (dictFields) {
          dictCache.set(cacheKey, dictFields);
        }
        setFields(dictFields);
      })
      .catch((err) => {
        if (abortRef.current) return;
        console.warn(
          '[MVCompass] useDictFields: error fetching dict.list:',
          err
        );
        setFields(null);
      })
      .finally(() => {
        if (!abortRef.current) setLoading(false);
      });

    return () => {
      abortRef.current = true;
    };
  }, [database, collection, status]);

  return fields;
}

/**
 * Clear the DICT cache (e.g., when a DICT is modified via bridge).
 */
export function clearDictCache(database?: string, collection?: string): void {
  if (database && collection) {
    dictCache.delete(`${database}/${collection}`);
  } else {
    dictCache.clear();
  }
}
