// MVCompass: DualQueryBar wrapper for conditional rendering in Compass
import React from 'react';
import { DualQueryBar } from './dual-query-bar';
import { useBridgeClient } from './use-bridge';
import { useMVCollection } from './mv-collection-context';

export interface MVQueryBarWrapperProps {
  namespace: string;
  onApplyFilter: (
    filter: Record<string, unknown>,
    sort?: Record<string, unknown>
  ) => void;
  currentFilter?: string;
}

/**
 * Wraps DualQueryBar with automatic bridge client and MV collection detection.
 * Returns null for non-multivalue collections — no UI change for regular MongoDB.
 */
export const MVQueryBarWrapper: React.FunctionComponent<
  MVQueryBarWrapperProps
> = ({ namespace, onApplyFilter, currentFilter }) => {
  const bridge = useBridgeClient();
  const { dictFields } = useMVCollection();

  // Only render for multivalue collections with DICT fields
  if (!dictFields || dictFields.length === 0) {
    return null;
  }

  const parts = namespace.split('.');
  const database = parts[0] || '';
  const collection = parts.slice(1).join('.') || '';

  if (!database || !collection) {
    return null;
  }

  return (
    <DualQueryBar
      database={database}
      collection={collection}
      onApplyQuery={onApplyFilter}
      bridgeClient={bridge}
      initialFilter={currentFilter}
    />
  );
};
