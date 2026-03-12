// MVCompass: Import/Export dialog for T-LOAD, T-DUMP, and CSV operations
import React, { useState, useCallback, useEffect } from 'react';
import { css, cx } from '@leafygreen-ui/emotion';
import { palette } from '@leafygreen-ui/palette';
import { spacing } from '@leafygreen-ui/tokens';
import { useDarkMode } from '@mongodb-js/compass-components';
import type { BridgeClient } from './bridge-client';
import type { DictField } from './mgdata';

// ── Types ──────────────────────────────────────────────────────────

export interface ImportExportDialogProps {
  database: string;
  collection: string;
  bridgeClient: BridgeClient | null;
  onClose: () => void;
}

type TabMode = 'import' | 'export';
type ExportFormat = 'tdump' | 'csv';

interface OperationResult {
  success: boolean;
  message: string;
  details?: string;
}

// ── Styles ─────────────────────────────────────────────────────────

const containerStyles = css({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '13px',
});

const lightContainerStyles = css({
  backgroundColor: palette.white,
  color: palette.gray.dark3,
});

const darkContainerStyles = css({
  backgroundColor: palette.gray.dark4,
  color: palette.gray.light2,
});

const headerStyles = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: `${spacing[200]}px ${spacing[400]}px`,
  borderBottom: '1px solid',
  fontWeight: 600,
  fontSize: '16px',
});

const lightHeaderStyles = css({
  borderBottomColor: palette.gray.light2,
});

const darkHeaderStyles = css({
  borderBottomColor: palette.gray.dark2,
});

const closeButtonStyles = css({
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '18px',
  padding: spacing[100],
});

const lightCloseButtonStyles = css({
  color: palette.gray.dark1,
  ':hover': { color: palette.gray.dark3 },
});

const darkCloseButtonStyles = css({
  color: palette.gray.light1,
  ':hover': { color: palette.white },
});

const tabBarStyles = css({
  display: 'flex',
  borderBottom: '1px solid',
});

const lightTabBarStyles = css({
  borderBottomColor: palette.gray.light2,
});

const darkTabBarStyles = css({
  borderBottomColor: palette.gray.dark2,
});

const tabStyles = css({
  padding: `${spacing[200]}px ${spacing[400]}px`,
  cursor: 'pointer',
  border: 'none',
  background: 'transparent',
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '13px',
  fontWeight: 600,
  borderBottom: '2px solid transparent',
});

const lightTabStyles = css({
  color: palette.gray.dark1,
  ':hover': { color: palette.gray.dark3 },
});

const darkTabStyles = css({
  color: palette.gray.light1,
  ':hover': { color: palette.white },
});

const activeTabStyles = css({});

const lightActiveTabStyles = css({
  color: palette.blue.base,
  borderBottomColor: palette.blue.base,
});

const darkActiveTabStyles = css({
  color: palette.blue.light1,
  borderBottomColor: palette.blue.light1,
});

const bodyStyles = css({
  flex: 1,
  padding: spacing[400],
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[300],
  overflowY: 'auto',
});

const formRowStyles = css({
  display: 'grid',
  gridTemplateColumns: '120px 1fr',
  alignItems: 'center',
  gap: spacing[200],
});

const labelStyles = css({
  fontSize: '12px',
  fontWeight: 600,
  textAlign: 'right',
});

const inputStyles = css({
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '13px',
  padding: `${spacing[100]}px ${spacing[200]}px`,
  borderRadius: '4px',
  border: '1px solid',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
});

const lightInputStyles = css({
  backgroundColor: palette.white,
  color: palette.gray.dark3,
  borderColor: palette.gray.light1,
  ':focus': { borderColor: palette.blue.base },
});

const darkInputStyles = css({
  backgroundColor: palette.gray.dark4,
  color: palette.gray.light2,
  borderColor: palette.gray.dark2,
  ':focus': { borderColor: palette.blue.light1 },
});

const selectStyles = css({
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '13px',
  padding: `${spacing[100]}px ${spacing[200]}px`,
  borderRadius: '4px',
  border: '1px solid',
  cursor: 'pointer',
});

const lightSelectStyles = css({
  backgroundColor: palette.white,
  color: palette.gray.dark3,
  borderColor: palette.gray.light1,
});

const darkSelectStyles = css({
  backgroundColor: palette.gray.dark4,
  color: palette.gray.light2,
  borderColor: palette.gray.dark2,
});

const actionButtonStyles = css({
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '13px',
  fontWeight: 600,
  padding: `${spacing[200]}px ${spacing[400]}px`,
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
  alignSelf: 'flex-start',
});

const lightActionButtonStyles = css({
  backgroundColor: palette.green.dark2,
  color: palette.white,
  ':hover': { backgroundColor: palette.green.dark3 },
  ':disabled': { opacity: 0.5, cursor: 'not-allowed' },
});

const darkActionButtonStyles = css({
  backgroundColor: palette.green.base,
  color: palette.black,
  ':hover': { backgroundColor: palette.green.light1 },
  ':disabled': { opacity: 0.5, cursor: 'not-allowed' },
});

const progressBarContainerStyles = css({
  height: '4px',
  borderRadius: '2px',
  overflow: 'hidden',
});

const lightProgressBarContainerStyles = css({
  backgroundColor: palette.gray.light2,
});

const darkProgressBarContainerStyles = css({
  backgroundColor: palette.gray.dark2,
});

const progressBarFillStyles = css({
  height: '100%',
  borderRadius: '2px',
  transition: 'width 0.3s ease',
});

const lightProgressBarFillStyles = css({
  backgroundColor: palette.blue.base,
});

const darkProgressBarFillStyles = css({
  backgroundColor: palette.blue.light1,
});

const resultStyles = css({
  padding: spacing[300],
  borderRadius: '4px',
  border: '1px solid',
});

const lightSuccessStyles = css({
  backgroundColor: palette.green.light3,
  borderColor: palette.green.base,
  color: palette.green.dark2,
});

const darkSuccessStyles = css({
  backgroundColor: palette.green.dark3,
  borderColor: palette.green.dark2,
  color: palette.green.light2,
});

const lightErrorStyles = css({
  backgroundColor: palette.red.light3,
  borderColor: palette.red.base,
  color: palette.red.dark2,
});

const darkErrorStyles = css({
  backgroundColor: palette.red.dark3,
  borderColor: palette.red.dark2,
  color: palette.red.light2,
});

const infoTextStyles = css({
  fontSize: '12px',
  opacity: 0.7,
});

const checkboxRowStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[100],
  fontSize: '12px',
});

const fieldSelectorStyles = css({
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: spacing[100],
  maxHeight: '120px',
  overflowY: 'auto',
  padding: spacing[200],
  borderRadius: '4px',
  border: '1px solid',
});

const lightFieldSelectorStyles = css({
  borderColor: palette.gray.light2,
});

const darkFieldSelectorStyles = css({
  borderColor: palette.gray.dark2,
});

const fieldChipStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '11px',
  padding: `2px ${spacing[100]}px`,
  borderRadius: '3px',
  cursor: 'pointer',
});

const lightFieldChipStyles = css({
  backgroundColor: palette.gray.light3,
  ':hover': { backgroundColor: palette.gray.light2 },
});

const darkFieldChipStyles = css({
  backgroundColor: palette.gray.dark3,
  ':hover': { backgroundColor: palette.gray.dark2 },
});

const lightSelectedFieldChipStyles = css({
  backgroundColor: palette.blue.light3,
  color: palette.blue.dark2,
});

const darkSelectedFieldChipStyles = css({
  backgroundColor: palette.blue.dark3,
  color: palette.blue.light2,
});

// ── Component ──────────────────────────────────────────────────────

export function ImportExportDialog({
  database,
  collection,
  bridgeClient,
  onClose,
}: ImportExportDialogProps) {
  const darkMode = useDarkMode();
  const [tab, setTab] = useState<TabMode>('import');
  const [importPath, setImportPath] = useState('');
  const [importTargetCollection, setImportTargetCollection] = useState('');
  const [exportPath, setExportPath] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('tdump');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OperationResult | null>(null);

  // T-DUMP scope options
  const [dumpDict, setDumpDict] = useState(true);
  const [dumpData, setDumpData] = useState(true);

  // CSV export options
  const [dictFields, setDictFields] = useState<DictField[]>([]);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [includeHeader, setIncludeHeader] = useState(true);
  const [applyConversions, setApplyConversions] = useState(true);

  const bridgeAvailable =
    bridgeClient !== null && bridgeClient.status === 'connected';

  // Load DICT fields for CSV field selector
  useEffect(() => {
    if (!bridgeAvailable || !bridgeClient) return;
    bridgeClient
      .request('dict.list', { database, collection })
      .then((response) => {
        const res = response.result as { fields?: DictField[] } | null;
        const fields = res?.fields ?? [];
        setDictFields(fields);
        setSelectedFields(new Set(fields.map((f) => f.item_id)));
      })
      .catch(() => setDictFields([]));
  }, [bridgeAvailable, bridgeClient, database, collection]);

  const toggleField = useCallback((itemId: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const handleImport = useCallback(async () => {
    if (!bridgeAvailable || !bridgeClient || !importPath.trim()) return;

    setIsRunning(true);
    setProgress(0);
    setResult(null);

    try {
      const params: Record<string, unknown> = {
        database,
        file_path: importPath.trim(),
      };
      if (importTargetCollection.trim()) {
        params.target_collection = importTargetCollection.trim();
      }
      const response = await bridgeClient.request(
        'import.tload',
        params,
        300000
      ); // 5 minute timeout for imports
      const res = response.result as {
        records_imported?: number;
        duration_ms?: number;
      } | null;
      setProgress(100);
      setResult({
        success: true,
        message: `Imported ${res?.records_imported ?? '?'} records`,
        details: res?.duration_ms
          ? `Duration: ${(res.duration_ms / 1000).toFixed(1)}s`
          : undefined,
      });
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || 'Import failed',
      });
    } finally {
      setIsRunning(false);
    }
  }, [bridgeAvailable, bridgeClient, importPath, database]);

  const handleExport = useCallback(async () => {
    if (!bridgeAvailable || !bridgeClient || !exportPath.trim()) return;

    setIsRunning(true);
    setProgress(0);
    setResult(null);

    const method = exportFormat === 'tdump' ? 'export.tdump' : 'export.csv';
    try {
      const params: Record<string, unknown> = {
        database,
        collection,
        output_path: exportPath.trim(),
      };
      if (exportFormat === 'tdump') {
        // T-DUMP scope: both, dict, or data
        if (dumpDict && dumpData) {
          params.scope = 'both';
        } else if (dumpDict) {
          params.scope = 'dict';
        } else if (dumpData) {
          params.scope = 'data';
        } else {
          params.scope = 'both'; // fallback if neither checked
        }
      } else {
        params.output_fields = Array.from(selectedFields);
        params.include_header = includeHeader;
        params.apply_conversions = applyConversions;
      }
      const response = await bridgeClient.request(method, params, 300000);
      const res = response.result as {
        records_exported?: number;
        duration_ms?: number;
      } | null;
      setProgress(100);
      setResult({
        success: true,
        message: `Exported ${
          res?.records_exported ?? '?'
        } records (${exportFormat.toUpperCase()})`,
        details: res?.duration_ms
          ? `Duration: ${(res.duration_ms / 1000).toFixed(1)}s`
          : undefined,
      });
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || 'Export failed',
      });
    } finally {
      setIsRunning(false);
    }
  }, [
    bridgeAvailable,
    bridgeClient,
    exportPath,
    exportFormat,
    database,
    collection,
    dumpDict,
    dumpData,
  ]);

  return (
    <div
      className={cx(
        containerStyles,
        darkMode ? darkContainerStyles : lightContainerStyles
      )}
    >
      {/* Header */}
      <div
        className={cx(
          headerStyles,
          darkMode ? darkHeaderStyles : lightHeaderStyles
        )}
      >
        <span>
          Import / Export — {database}.{collection}
        </span>
        <button
          className={cx(
            closeButtonStyles,
            darkMode ? darkCloseButtonStyles : lightCloseButtonStyles
          )}
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div
        className={cx(
          tabBarStyles,
          darkMode ? darkTabBarStyles : lightTabBarStyles
        )}
      >
        <button
          className={cx(
            tabStyles,
            darkMode ? darkTabStyles : lightTabStyles,
            tab === 'import' && activeTabStyles,
            tab === 'import' &&
              (darkMode ? darkActiveTabStyles : lightActiveTabStyles)
          )}
          onClick={() => {
            setTab('import');
            setResult(null);
          }}
        >
          Import (T-LOAD)
        </button>
        <button
          className={cx(
            tabStyles,
            darkMode ? darkTabStyles : lightTabStyles,
            tab === 'export' && activeTabStyles,
            tab === 'export' &&
              (darkMode ? darkActiveTabStyles : lightActiveTabStyles)
          )}
          onClick={() => {
            setTab('export');
            setResult(null);
          }}
        >
          Export
        </button>
      </div>

      {/* Body */}
      <div className={bodyStyles}>
        {!bridgeAvailable && (
          <div
            className={cx(
              resultStyles,
              darkMode ? darkErrorStyles : lightErrorStyles
            )}
          >
            Bridge not connected. Import/Export requires a running D3PyMongo
            bridge.
          </div>
        )}

        {tab === 'import' && (
          <>
            <div className={formRowStyles}>
              <label className={labelStyles}>File path:</label>
              <input
                className={cx(
                  inputStyles,
                  darkMode ? darkInputStyles : lightInputStyles
                )}
                value={importPath}
                onChange={(e) => setImportPath(e.target.value)}
                placeholder="/path/to/tdump-file.dat"
                disabled={isRunning}
                data-testid="import-path-input"
              />
            </div>
            <div className={formRowStyles}>
              <label className={labelStyles}>Target:</label>
              <input
                className={cx(
                  inputStyles,
                  darkMode ? darkInputStyles : lightInputStyles
                )}
                value={importTargetCollection}
                onChange={(e) => setImportTargetCollection(e.target.value)}
                placeholder={`Default: from T-DUMP header`}
                disabled={isRunning}
                data-testid="import-target-input"
              />
            </div>
            <div className={infoTextStyles}>
              Server-side file path to T-DUMP data file. The bridge will import
              records into {database}.
            </div>
            <button
              className={cx(
                actionButtonStyles,
                darkMode ? darkActionButtonStyles : lightActionButtonStyles
              )}
              onClick={handleImport}
              disabled={isRunning || !bridgeAvailable || !importPath.trim()}
              data-testid="import-button"
            >
              {isRunning ? 'Importing...' : 'Import'}
            </button>
          </>
        )}

        {tab === 'export' && (
          <>
            <div className={formRowStyles}>
              <label className={labelStyles}>Format:</label>
              <select
                className={cx(
                  selectStyles,
                  darkMode ? darkSelectStyles : lightSelectStyles
                )}
                value={exportFormat}
                onChange={(e) =>
                  setExportFormat(e.target.value as ExportFormat)
                }
                disabled={isRunning}
                data-testid="export-format-select"
              >
                <option value="tdump">T-DUMP</option>
                <option value="csv">CSV</option>
              </select>
            </div>
            {/* T-DUMP scope checkboxes */}
            {exportFormat === 'tdump' && (
              <div className={formRowStyles}>
                <label className={labelStyles}>Scope:</label>
                <div
                  style={{
                    display: 'flex',
                    gap: spacing[400],
                  }}
                >
                  <label className={checkboxRowStyles}>
                    <input
                      type="checkbox"
                      checked={dumpDict}
                      onChange={(e) => setDumpDict(e.target.checked)}
                      disabled={isRunning}
                      data-testid="tdump-dict-checkbox"
                    />
                    DICT
                  </label>
                  <label className={checkboxRowStyles}>
                    <input
                      type="checkbox"
                      checked={dumpData}
                      onChange={(e) => setDumpData(e.target.checked)}
                      disabled={isRunning}
                      data-testid="tdump-data-checkbox"
                    />
                    DATA
                  </label>
                </div>
              </div>
            )}
            <div className={formRowStyles}>
              <label className={labelStyles}>File path:</label>
              <input
                className={cx(
                  inputStyles,
                  darkMode ? darkInputStyles : lightInputStyles
                )}
                value={exportPath}
                onChange={(e) => setExportPath(e.target.value)}
                placeholder="/path/to/export-file"
                disabled={isRunning}
                data-testid="export-path-input"
              />
            </div>
            {/* CSV-specific options */}
            {exportFormat === 'csv' && (
              <>
                <div className={formRowStyles}>
                  <label className={labelStyles}>Fields:</label>
                  <div
                    className={cx(
                      fieldSelectorStyles,
                      darkMode
                        ? darkFieldSelectorStyles
                        : lightFieldSelectorStyles
                    )}
                    data-testid="csv-field-selector"
                  >
                    {dictFields.length === 0 && (
                      <span style={{ opacity: 0.6, fontSize: '11px' }}>
                        No DICT fields available
                      </span>
                    )}
                    {dictFields.map((field) => (
                      <span
                        key={field.item_id}
                        className={cx(
                          fieldChipStyles,
                          darkMode ? darkFieldChipStyles : lightFieldChipStyles,
                          selectedFields.has(field.item_id) &&
                            (darkMode
                              ? darkSelectedFieldChipStyles
                              : lightSelectedFieldChipStyles)
                        )}
                        onClick={() => toggleField(field.item_id)}
                        data-testid={`csv-field-${field.item_id}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedFields.has(field.item_id)}
                          readOnly
                          style={{ margin: 0 }}
                        />
                        {field.item_id}
                      </span>
                    ))}
                  </div>
                </div>
                <div className={formRowStyles}>
                  <label className={labelStyles}>Options:</label>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: spacing[100],
                    }}
                  >
                    <label className={checkboxRowStyles}>
                      <input
                        type="checkbox"
                        checked={includeHeader}
                        onChange={(e) => setIncludeHeader(e.target.checked)}
                        data-testid="csv-include-header"
                      />
                      Include header row
                    </label>
                    <label className={checkboxRowStyles}>
                      <input
                        type="checkbox"
                        checked={applyConversions}
                        onChange={(e) => setApplyConversions(e.target.checked)}
                        data-testid="csv-apply-conversions"
                      />
                      Apply conversions (OCONV)
                    </label>
                  </div>
                </div>
              </>
            )}
            <div className={infoTextStyles}>
              Server-side file path for export output. Exports {database}.
              {collection}.
            </div>
            <button
              className={cx(
                actionButtonStyles,
                darkMode ? darkActionButtonStyles : lightActionButtonStyles
              )}
              onClick={handleExport}
              disabled={isRunning || !bridgeAvailable || !exportPath.trim()}
              data-testid="export-button"
            >
              {isRunning ? 'Exporting...' : 'Export'}
            </button>
          </>
        )}

        {/* Progress bar */}
        {isRunning && (
          <div
            className={cx(
              progressBarContainerStyles,
              darkMode
                ? darkProgressBarContainerStyles
                : lightProgressBarContainerStyles
            )}
          >
            <div
              className={cx(
                progressBarFillStyles,
                darkMode
                  ? darkProgressBarFillStyles
                  : lightProgressBarFillStyles
              )}
              style={{ width: `${Math.max(progress, 10)}%` }}
            />
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            className={cx(
              resultStyles,
              result.success
                ? darkMode
                  ? darkSuccessStyles
                  : lightSuccessStyles
                : darkMode
                ? darkErrorStyles
                : lightErrorStyles
            )}
            data-testid="operation-result"
          >
            <div>{result.message}</div>
            {result.details && (
              <div className={infoTextStyles}>{result.details}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
