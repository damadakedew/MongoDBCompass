// MVCompass: Multivalue document viewer components and utilities

// MGData parsing and formatting (client-side, no bridge dependency)
export {
  isMGData,
  parseMGData,
  formatValue,
  formatAttrNumber,
  parseMultiValues,
  DEFAULT_CONFIG,
} from './mgdata';
export type {
  MVAttribute,
  MVValue,
  MVDisplayConfig,
  DictField,
} from './mgdata';

// Collection grouping for sidebar
export {
  isMultivalueDatabase,
  groupCollections,
  reorderCollectionsForGroupedView,
} from './collection-grouping';
export type { CollectionInfo, GroupedCollection } from './collection-grouping';

// Bridge client
export { BridgeClient, BridgeError } from './bridge-client';
export type {
  BridgeStatus,
  BridgeRequest,
  BridgeResponse,
  BridgeEvent,
} from './bridge-client';

// Bridge service (singleton + preferences integration)
export {
  getBridgeClient,
  initBridgeClient,
  disconnectBridge,
  onBridgeStatusChange,
  connectBridgeFromPreferences,
} from './bridge-service';

// React hooks for bridge access
export {
  useBridgeClient,
  useBridgeStatus,
  useDictFields,
  clearDictCache,
} from './use-bridge';

// Collection-level context (DICT data provider)
export { MVCollectionProvider, useMVCollection } from './mv-collection-context';

// Components
export { AttributeViewer } from './attribute-viewer';
export type { AttributeViewerProps } from './attribute-viewer';
export { DocumentViewToggle } from './document-view-toggle';
export type { DocumentViewToggleProps } from './document-view-toggle';
export {
  buildColumnConfig,
  buildFallbackColumns,
  buildMergedColumns,
  inferSortType,
} from './dict-columns';
export type { DictColumnConfig, SortType } from './dict-columns';
export { DictColumnHeaders } from './dict-column-headers';
export type { DictColumnHeadersProps } from './dict-column-headers';

// Dual query bar
export { DualQueryBar } from './dual-query-bar';
export { MVQueryBarWrapper } from './query-bar-wrapper';
export type { MVQueryBarWrapperProps } from './query-bar-wrapper';
export type {
  DualQueryBarProps,
  TranslationResult,
  FieldUsed,
  QueryHistoryEntry,
} from './dual-query-bar';

// DICT editor
export { DictEditor } from './dict-editor';
export type { DictEditorProps } from './dict-editor';

// Terminal emulator
export { TerminalEmulator } from './terminal-emulator';
export type { TerminalEmulatorProps } from './terminal-emulator';

// LIST/SORT output panel
export { ListOutputPanel } from './list-output-panel';
export type { ListOutputPanelProps, ColumnInfo } from './list-output-panel';

// Import/Export dialog
export { ImportExportDialog } from './import-export-dialog';
export type { ImportExportDialogProps } from './import-export-dialog';

// Bridge toast notifications
export { initBridgeToasts, showBridgeError } from './bridge-toasts';
