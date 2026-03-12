// MVCompass: Bridge status toast notifications
//
// Surfaces bridge connection status changes as visible toast notifications.
// Uses Compass's global openToast/closeToast API (from @mongodb-js/compass-components).

import type { BridgeStatus } from './bridge-client';
import { onBridgeStatusChange, getBridgeClient } from './bridge-service';

const TOAST_ID = 'mvcompass-bridge-status';
let lastNotifiedStatus: BridgeStatus | null = null;
let initialized = false;

// Dynamic import to avoid circular dependency issues.
// openToast is a global singleton, safe to import lazily.
let _openToast: ((id: string, props: any) => void) | null = null;
let _closeToast: ((id: string) => void) | null = null;

function getToastFns(): {
  openToast: typeof _openToast;
  closeToast: typeof _closeToast;
} {
  if (!_openToast) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const components = require('@mongodb-js/compass-components');
      _openToast = components.openToast;
      _closeToast = components.closeToast;
    } catch {
      // Compass components not available (e.g., in tests)
    }
  }
  return { openToast: _openToast, closeToast: _closeToast };
}

function showBridgeToast(status: BridgeStatus): void {
  const { openToast, closeToast } = getToastFns();
  if (!openToast || !closeToast) return;

  // Don't notify the same status twice
  if (status === lastNotifiedStatus) return;
  const previousStatus = lastNotifiedStatus;
  lastNotifiedStatus = status;

  const client = getBridgeClient();
  const url = client?.url ?? 'unknown';

  switch (status) {
    case 'connected':
      openToast(TOAST_ID, {
        variant: 'success',
        title: 'D3PyMongo bridge connected',
        description: `Connected to ${url}`,
        timeout: 5000,
      });
      break;
    case 'error':
      openToast(TOAST_ID, {
        variant: 'warning',
        title: 'D3PyMongo bridge connection failed',
        description: `Could not connect to bridge at ${url}. MultiValue features unavailable.`,
        timeout: 10000,
      });
      break;
    case 'disconnected':
      // Only show disconnect toast if we were previously connected (not on initial state)
      if (previousStatus === 'connected') {
        openToast(TOAST_ID, {
          variant: 'warning',
          title: 'D3PyMongo bridge disconnected',
          description:
            'MultiValue features unavailable until bridge reconnects.',
          timeout: 8000,
        });
      }
      break;
    case 'connecting':
      // Don't show a toast for connecting — too transient
      break;
  }
}

/**
 * Initialize bridge toast notifications.
 * Call once at app startup (e.g., in MVCollectionProvider).
 * Safe to call multiple times — only initializes once.
 */
export function initBridgeToasts(): void {
  if (initialized) return;
  initialized = true;

  onBridgeStatusChange((status) => {
    showBridgeToast(status);
  });

  console.debug('[MVCompass] Bridge toast notifications initialized');
}

/**
 * Show an error toast for a bridge operation failure.
 */
export function showBridgeError(title: string, description: string): void {
  const { openToast } = getToastFns();
  if (!openToast) return;

  openToast(`mvcompass-error-${Date.now()}`, {
    variant: 'warning',
    title,
    description,
    timeout: 8000,
  });
}
