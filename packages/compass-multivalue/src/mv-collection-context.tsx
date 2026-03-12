// MVCompass: React context for multivalue collection data
//
// Provides DICT fields and namespace info to deeply nested components
// (like the Document component in compass-crud) without prop drilling.
// The provider goes at the DocumentList level where namespace is available;
// consumers go in individual Document renders.
//
// Also auto-initializes the bridge client on first render if not already
// connected, reading mvBridgeUrl from Compass preferences.

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type { DictField } from './mgdata';
import { useDictFields } from './use-bridge';
import {
  getBridgeClient,
  connectBridgeFromPreferences,
  isBridgeMongoReady,
} from './bridge-service';
import { initBridgeToasts } from './bridge-toasts';

// ── Context ─────────────────────────────────────────────────────────

interface MVCollectionData {
  database: string | null;
  collection: string | null;
  dictFields: DictField[] | null;
}

const MVCollectionContext = createContext<MVCollectionData>({
  database: null,
  collection: null,
  dictFields: null,
});

// ── Provider ────────────────────────────────────────────────────────

interface MVCollectionProviderProps {
  /** Namespace string in "database.collection" format */
  namespace: string;
  /** Bridge URL from Compass preferences (optional — reads from preference if available) */
  bridgeUrl?: string;
  /** MongoDB connection string to pass to bridge server for initialization */
  mongoConnectionString?: string;
  children: React.ReactNode;
}

/**
 * Wraps a section of the component tree with multivalue collection context.
 * Automatically fetches DICT fields from the bridge when available.
 * Also initializes the bridge client on first render if not already connected.
 * Place this at the DocumentList level where namespace is known.
 */
export function MVCollectionProvider({
  namespace,
  bridgeUrl,
  mongoConnectionString,
  children,
}: MVCollectionProviderProps) {
  const initRef = useRef(false);

  // Auto-initialize bridge on first render if not yet connected
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    console.debug(
      '[MVCompass] MVCollectionProvider init, namespace:',
      namespace
    );
    initBridgeToasts(); // MVCompass: start toast notifications for bridge status

    const client = getBridgeClient();
    if (client && client.status === 'connected' && isBridgeMongoReady()) {
      return;
    }

    // Use provided URL or fall back to default
    const url = bridgeUrl || 'ws://localhost:9800';
    console.debug('[MVCompass] Connecting bridge to:', url);
    void connectBridgeFromPreferences(url, mongoConnectionString);
  }, [bridgeUrl]);

  const { database, collection } = useMemo(() => {
    const dotIndex = namespace.indexOf('.');
    if (dotIndex === -1) {
      return { database: namespace, collection: null };
    }
    return {
      database: namespace.slice(0, dotIndex),
      collection: namespace.slice(dotIndex + 1),
    };
  }, [namespace]);

  const dictFields = useDictFields(database, collection);

  const value = useMemo(
    () => ({ database, collection, dictFields }),
    [database, collection, dictFields]
  );

  return (
    <MVCollectionContext.Provider value={value}>
      {children}
    </MVCollectionContext.Provider>
  );
}

// ── Consumer Hook ───────────────────────────────────────────────────

/**
 * Access the current collection's DICT fields from any nested component.
 * Returns null for dictFields if bridge is unavailable or no DICT exists.
 */
export function useMVCollection(): MVCollectionData {
  return useContext(MVCollectionContext);
}
