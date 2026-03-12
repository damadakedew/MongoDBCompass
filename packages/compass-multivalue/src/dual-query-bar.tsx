import React, { useState, useCallback, useRef, useMemo } from 'react';
import { css, cx } from '@leafygreen-ui/emotion';
import { palette } from '@leafygreen-ui/palette';
import { spacing } from '@leafygreen-ui/tokens';
import { useDarkMode, Icon, Tooltip } from '@mongodb-js/compass-components';
import type { BridgeClient } from './bridge-client';
import { ListOutputPanel } from './list-output-panel';
import type { ColumnInfo } from './list-output-panel';

// ── Types ──────────────────────────────────────────────────────────

export interface FieldUsed {
  name: string;
  attribute_number: number;
  mongo_path: string;
}

export interface TranslationResult {
  source_syntax: 'pick' | 'mongodb';
  target_syntax: 'pick' | 'mongodb';
  collection: string;
  pick_query: string;
  mongodb_filter: Record<string, unknown>;
  mongodb_sort?: Record<string, unknown> | null;
  fields_used: FieldUsed[];
  warnings: string[];
}

export interface QueryHistoryEntry {
  pickQuery: string;
  mongoFilter: string;
  mongoSort?: Record<string, unknown> | null;
  fieldsUsed: FieldUsed[];
  timestamp: number;
}

export interface DualQueryBarProps {
  database: string;
  collection: string;
  onApplyQuery: (
    filter: Record<string, unknown>,
    sort?: Record<string, unknown>
  ) => void;
  bridgeClient: BridgeClient | null;
  initialFilter?: string;
}

// ── Styles ─────────────────────────────────────────────────────────

const containerStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[200],
  padding: spacing[200],
});

const rowStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
});

const labelStyles = css({
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '12px',
  fontWeight: 600,
  minWidth: '80px',
  textAlign: 'right',
  flexShrink: 0,
});

const lightLabelStyles = css({
  color: palette.gray.dark1,
});

const darkLabelStyles = css({
  color: palette.gray.light1,
});

const inputBaseStyles = css({
  flex: 1,
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '13px',
  padding: `${spacing[100]}px ${spacing[200]}px`,
  borderRadius: '4px',
  border: '1px solid',
  outline: 'none',
  minHeight: '32px',
  resize: 'vertical' as const,
  ':focus': {
    borderWidth: '2px',
    padding: `${spacing[100] - 1}px ${spacing[200] - 1}px`,
  },
});

const lightInputStyles = css({
  backgroundColor: palette.white,
  color: palette.gray.dark3,
  borderColor: palette.gray.light1,
  ':focus': {
    borderColor: palette.blue.base,
  },
});

const darkInputStyles = css({
  backgroundColor: palette.gray.dark4,
  color: palette.gray.light2,
  borderColor: palette.gray.dark2,
  ':focus': {
    borderColor: palette.blue.light1,
  },
});

const pickInputBorderStyles = css({
  borderLeftWidth: '3px',
  borderLeftStyle: 'solid',
});

const lightPickBorderStyles = css({
  borderLeftColor: palette.green.dark1,
});

const darkPickBorderStyles = css({
  borderLeftColor: palette.green.base,
});

const disabledInputStyles = css({
  opacity: 0.5,
  cursor: 'not-allowed',
});

const buttonRowStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
  marginLeft: `calc(80px + ${spacing[200]}px)`,
});

const applyButtonStyles = css({
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '13px',
  fontWeight: 600,
  padding: `${spacing[100]}px ${spacing[400]}px`,
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
});

const lightApplyButtonStyles = css({
  backgroundColor: palette.green.dark1,
  color: palette.white,
  ':hover': {
    backgroundColor: palette.green.dark2,
  },
});

const darkApplyButtonStyles = css({
  backgroundColor: palette.green.base,
  color: palette.black,
  ':hover': {
    backgroundColor: palette.green.light1,
  },
});

const historyButtonStyles = css({
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '12px',
  padding: `${spacing[100]}px ${spacing[200]}px`,
  borderRadius: '4px',
  border: '1px solid',
  cursor: 'pointer',
  background: 'transparent',
  position: 'relative' as const,
});

const lightHistoryButtonStyles = css({
  borderColor: palette.gray.light1,
  color: palette.gray.dark1,
  ':hover': {
    backgroundColor: palette.gray.light3,
  },
});

const darkHistoryButtonStyles = css({
  borderColor: palette.gray.dark2,
  color: palette.gray.light1,
  ':hover': {
    backgroundColor: palette.gray.dark3,
  },
});

const statusStyles = css({
  fontSize: '12px',
  display: 'flex',
  alignItems: 'center',
  gap: spacing[100],
});

const errorStyles = css({
  fontSize: '12px',
  marginLeft: `calc(80px + ${spacing[200]}px)`,
});

const lightErrorStyles = css({
  color: palette.red.base,
});

const darkErrorStyles = css({
  color: palette.red.light1,
});

const warningStyles = css({
  fontSize: '12px',
  marginLeft: `calc(80px + ${spacing[200]}px)`,
});

const lightWarningStyles = css({
  color: palette.yellow.dark2,
});

const darkWarningStyles = css({
  color: palette.yellow.base,
});

const fieldsUsedStyles = css({
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: spacing[100],
  marginLeft: `calc(80px + ${spacing[200]}px)`,
});

const fieldChipStyles = css({
  fontSize: '11px',
  padding: `1px ${spacing[100]}px`,
  borderRadius: '3px',
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
});

const lightFieldChipStyles = css({
  backgroundColor: palette.blue.light3,
  color: palette.blue.dark2,
});

const darkFieldChipStyles = css({
  backgroundColor: palette.blue.dark3,
  color: palette.blue.light2,
});

const spinnerStyles = css({
  display: 'inline-block',
  width: '12px',
  height: '12px',
  border: '2px solid transparent',
  borderTopColor: 'currentColor',
  borderRadius: '50%',
  animation: 'dqb-spin 0.6s linear infinite',
  '@keyframes dqb-spin': {
    to: { transform: 'rotate(360deg)' },
  },
});

const lightSpinnerStyles = css({
  borderTopColor: palette.blue.base,
});

const darkSpinnerStyles = css({
  borderTopColor: palette.blue.light1,
});

const historyDropdownStyles = css({
  position: 'absolute' as const,
  top: '100%',
  left: 0,
  zIndex: 10,
  minWidth: '400px',
  maxHeight: '300px',
  overflowY: 'auto' as const,
  borderRadius: '4px',
  border: '1px solid',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '12px',
});

const lightHistoryDropdownStyles = css({
  backgroundColor: palette.white,
  borderColor: palette.gray.light1,
});

const darkHistoryDropdownStyles = css({
  backgroundColor: palette.gray.dark3,
  borderColor: palette.gray.dark2,
});

const historyItemStyles = css({
  padding: `${spacing[200]}px ${spacing[300]}px`,
  cursor: 'pointer',
  borderBottom: '1px solid',
});

const lightHistoryItemStyles = css({
  borderBottomColor: palette.gray.light2,
  ':hover': {
    backgroundColor: palette.gray.light3,
  },
});

const darkHistoryItemStyles = css({
  borderBottomColor: palette.gray.dark2,
  ':hover': {
    backgroundColor: palette.gray.dark4,
  },
});

const historyPickStyles = css({
  fontWeight: 600,
  marginBottom: '2px',
});

const historyMongoStyles = css({
  opacity: 0.7,
});

const emptyHistoryStyles = css({
  padding: `${spacing[200]}px ${spacing[300]}px`,
  fontStyle: 'italic',
  opacity: 0.6,
});

const listOutputContainerStyles = css({
  marginTop: spacing[200],
  height: '60vh',
});

// ── Constants ──────────────────────────────────────────────────────

const DEBOUNCE_MS = 500;
const MAX_HISTORY = 10;

// ── Component ──────────────────────────────────────────────────────

export function DualQueryBar({
  database,
  collection,
  onApplyQuery,
  bridgeClient,
  initialFilter,
}: DualQueryBarProps) {
  const darkMode = useDarkMode();

  // Query state
  const [mongoFilter, setMongoFilter] = useState(initialFilter || '');
  const [pickQuery, setPickQuery] = useState('');
  const [activeSource, setActiveSource] = useState<'mongodb' | 'pick'>(
    'mongodb'
  );

  // Translation state
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationWarnings, setTranslationWarnings] = useState<string[]>([]);
  const [fieldsUsed, setFieldsUsed] = useState<FieldUsed[]>([]);
  const [error, setError] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // LIST output state
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportColumns, setReportColumns] = useState<ColumnInfo[]>([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [isListing, setIsListing] = useState(false);
  const [listPage, setListPage] = useState(1);
  const [listHasMore, setListHasMore] = useState(false);

  // Refs
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const mongoTextareaRef = useRef<HTMLTextAreaElement>(null);

  const bridgeAvailable =
    bridgeClient !== null && bridgeClient.status === 'connected';

  // Auto-resize MongoDB filter textarea to fit content
  const autoResizeMongoTextarea = useCallback(() => {
    const el = mongoTextareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  }, []);

  // Sort from last translation (kept alongside the filter)
  const lastSortRef = useRef<Record<string, unknown> | null>(null);

  // ── Translation ────────────────────────────────────────────────

  const translate = useCallback(
    async (
      source: 'mongodb' | 'pick',
      query: string
    ): Promise<TranslationResult | null> => {
      if (!bridgeClient || bridgeClient.status !== 'connected') return null;
      if (!query.trim()) {
        // Clear the other field
        if (source === 'mongodb') {
          setPickQuery('');
        } else {
          setMongoFilter('');
        }
        setFieldsUsed([]);
        setTranslationWarnings([]);
        setError(null);
        lastSortRef.current = null;
        return null;
      }

      setIsTranslating(true);
      setError(null);
      setTranslationWarnings([]);

      try {
        const params: Record<string, unknown> = {
          database,
          source,
          query,
        };
        // MongoDB→Pick needs collection in params
        if (source === 'mongodb') {
          params.collection = collection;
        }

        const response = await bridgeClient.request('query.translate', params);
        const result = response.result as unknown as TranslationResult;

        if (source === 'pick') {
          setMongoFilter(JSON.stringify(result.mongodb_filter, null, 2));
          // Auto-resize after programmatic filter update
          setTimeout(autoResizeMongoTextarea, 0);
        } else {
          setPickQuery(result.pick_query || '');
        }

        lastSortRef.current = result.mongodb_sort ?? null;
        setFieldsUsed(result.fields_used || []);
        setTranslationWarnings(result.warnings || []);
        return result;
      } catch (err: any) {
        setError(err.message || 'Translation failed');
        return null;
      } finally {
        setIsTranslating(false);
      }
    },
    [bridgeClient, database, collection, autoResizeMongoTextarea]
  );

  // Debounced translate
  const debouncedTranslate = useCallback(
    (source: 'mongodb' | 'pick', query: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        translate(source, query);
      }, DEBOUNCE_MS);
    },
    [translate]
  );

  // ── Input handlers ─────────────────────────────────────────────

  const handleMongoChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setMongoFilter(value);
      setActiveSource('mongodb');
      setError(null);
      autoResizeMongoTextarea();
    },
    [autoResizeMongoTextarea]
  );

  const handleMongoBlur = useCallback(() => {
    if (activeSource === 'mongodb' && bridgeAvailable) {
      debouncedTranslate('mongodb', mongoFilter);
    }
  }, [activeSource, bridgeAvailable, debouncedTranslate, mongoFilter]);

  const handleMongoKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (bridgeAvailable) {
          translate('mongodb', mongoFilter);
        }
      }
    },
    [bridgeAvailable, translate, mongoFilter]
  );

  const handlePickChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setPickQuery(value);
      setActiveSource('pick');
      setError(null);
    },
    []
  );

  const handlePickBlur = useCallback(() => {
    if (activeSource === 'pick' && bridgeAvailable) {
      debouncedTranslate('pick', pickQuery);
    }
  }, [activeSource, bridgeAvailable, debouncedTranslate, pickQuery]);

  const handlePickKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (bridgeAvailable) {
          // Translate, then auto-apply+find in one keystroke
          const result = await translate('pick', pickQuery);
          if (result) {
            const filter = result.mongodb_filter ?? {};
            const sort = result.mongodb_sort ?? undefined;
            onApplyQuery(filter, sort);
          }
        }
      }
    },
    [bridgeAvailable, translate, pickQuery, onApplyQuery]
  );

  // ── Apply ──────────────────────────────────────────────────────

  const handleApply = useCallback(() => {
    const filterText = mongoFilter.trim();
    let parsed: Record<string, unknown>;

    if (!filterText) {
      parsed = {};
    } else {
      try {
        parsed = JSON.parse(filterText);
      } catch {
        setError('Invalid JSON in MongoDB filter');
        return;
      }
    }

    const sort = lastSortRef.current ?? undefined;
    onApplyQuery(parsed, sort);

    // Add to history
    const entry: QueryHistoryEntry = {
      pickQuery: pickQuery,
      mongoFilter: filterText || '{}',
      mongoSort: lastSortRef.current,
      fieldsUsed: [...fieldsUsed],
      timestamp: Date.now(),
    };

    setHistory((prev) => {
      // Deduplicate by mongo filter
      const deduped = prev.filter((h) => h.mongoFilter !== entry.mongoFilter);
      const updated = [entry, ...deduped];
      return updated.slice(0, MAX_HISTORY);
    });
  }, [mongoFilter, pickQuery, fieldsUsed, onApplyQuery]);

  // ── LIST output ──────────────────────────────────────────────

  const PAGE_SIZE = 50;

  const handleList = useCallback(
    async (skip = 0) => {
      if (!bridgeClient || bridgeClient.status !== 'connected') return;

      // Use the Pick query if available, otherwise build from mongo filter
      const query = pickQuery.trim();
      if (!query) {
        setError('Enter a MultiValue query to use LIST');
        return;
      }

      setIsListing(true);
      setError(null);
      try {
        const response = await bridgeClient.request(
          'query.execute',
          {
            database,
            collection,
            query: query,
            syntax: 'pick',
            format: 'report',
            limit: PAGE_SIZE,
            skip,
          },
          120000
        );
        const result = response.result as {
          report_text?: string;
          columns?: Array<{
            name: string;
            width: number;
            justification: string;
          }>;
          total?: number;
          has_more?: boolean;
        } | null;

        setReportText(result?.report_text ?? 'No items listed.');
        setReportColumns(
          (result?.columns ?? []).map((c) => ({
            name: c.name,
            width: c.width,
            justification: (c.justification || 'L') as 'L' | 'R' | 'C',
          }))
        );
        setReportTotal(result?.total ?? 0);
        setListHasMore(result?.has_more ?? false);
        setListPage(Math.floor(skip / PAGE_SIZE) + 1);
        setShowReport(true);
      } catch (err: any) {
        setError(err.message || 'LIST query failed');
      } finally {
        setIsListing(false);
      }
    },
    [bridgeClient, pickQuery, database, collection]
  );

  const handleNextPage = useCallback(() => {
    const nextSkip = listPage * PAGE_SIZE;
    handleList(nextSkip);
  }, [handleList, listPage]);

  const handlePreviousPage = useCallback(() => {
    const prevSkip = Math.max(0, (listPage - 2) * PAGE_SIZE);
    handleList(prevSkip);
  }, [handleList, listPage]);

  // ── History ────────────────────────────────────────────────────

  const handleHistorySelect = useCallback(
    (entry: QueryHistoryEntry) => {
      setMongoFilter(entry.mongoFilter);
      setPickQuery(entry.pickQuery);
      setFieldsUsed(entry.fieldsUsed);
      lastSortRef.current = entry.mongoSort ?? null;
      setTranslationWarnings([]);
      setError(null);
      setShowHistory(false);

      // Apply immediately
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(entry.mongoFilter);
      } catch {
        parsed = {};
      }
      const sort = entry.mongoSort ?? undefined;
      onApplyQuery(parsed, sort);
    },
    [onApplyQuery]
  );

  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => !prev);
  }, []);

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className={containerStyles} data-testid="dual-query-bar">
      {/* MongoDB filter row */}
      <div className={rowStyles}>
        <label
          className={cx(
            labelStyles,
            darkMode ? darkLabelStyles : lightLabelStyles
          )}
        >
          MongoDB:
        </label>
        <textarea
          className={cx(
            inputBaseStyles,
            darkMode ? darkInputStyles : lightInputStyles
          )}
          value={mongoFilter}
          ref={mongoTextareaRef}
          onChange={handleMongoChange}
          onBlur={handleMongoBlur}
          onKeyDown={handleMongoKeyDown}
          placeholder='{ "MGData.4": "TX" }'
          rows={1}
          data-testid="mongo-filter-input"
        />
      </div>

      {/* MultiValue query row */}
      <div className={rowStyles}>
        <label
          className={cx(
            labelStyles,
            darkMode ? darkLabelStyles : lightLabelStyles
          )}
        >
          MultiValue:
        </label>
        {bridgeAvailable ? (
          <textarea
            className={cx(
              inputBaseStyles,
              darkMode ? darkInputStyles : lightInputStyles,
              pickInputBorderStyles,
              darkMode ? darkPickBorderStyles : lightPickBorderStyles
            )}
            value={pickQuery}
            onChange={handlePickChange}
            onBlur={handlePickBlur}
            onKeyDown={handlePickKeyDown}
            placeholder='SELECT CUSTOMERS WITH STATE = "TX"'
            rows={1}
            data-testid="pick-query-input"
          />
        ) : (
          <Tooltip
            trigger={
              <textarea
                className={cx(
                  inputBaseStyles,
                  darkMode ? darkInputStyles : lightInputStyles,
                  pickInputBorderStyles,
                  darkMode ? darkPickBorderStyles : lightPickBorderStyles,
                  disabledInputStyles
                )}
                disabled
                placeholder="Connect to D3PyMongo bridge to use MultiValue queries"
                rows={1}
                data-testid="pick-query-input"
              />
            }
          >
            Connect to D3PyMongo bridge to use MultiValue queries
          </Tooltip>
        )}
      </div>

      {/* Action row */}
      <div className={buttonRowStyles}>
        <button
          className={cx(
            applyButtonStyles,
            darkMode ? darkApplyButtonStyles : lightApplyButtonStyles
          )}
          onClick={handleApply}
          data-testid="apply-query-button"
        >
          Apply
        </button>

        {bridgeAvailable && (
          <button
            className={cx(
              historyButtonStyles,
              darkMode ? darkHistoryButtonStyles : lightHistoryButtonStyles
            )}
            onClick={() => handleList(0)}
            disabled={isListing}
            data-testid="list-query-button"
          >
            {isListing ? 'Running...' : 'LIST'}
          </button>
        )}

        {history.length > 0 && (
          <div style={{ position: 'relative' }} ref={historyRef}>
            <button
              className={cx(
                historyButtonStyles,
                darkMode ? darkHistoryButtonStyles : lightHistoryButtonStyles
              )}
              onClick={toggleHistory}
              data-testid="history-button"
            >
              <Icon glyph="Clock" size="small" /> History ({history.length})
            </button>

            {showHistory && (
              <div
                className={cx(
                  historyDropdownStyles,
                  darkMode
                    ? darkHistoryDropdownStyles
                    : lightHistoryDropdownStyles
                )}
                data-testid="history-dropdown"
              >
                {history.map((entry, i) => (
                  <div
                    key={entry.timestamp}
                    className={cx(
                      historyItemStyles,
                      darkMode ? darkHistoryItemStyles : lightHistoryItemStyles
                    )}
                    onClick={() => handleHistorySelect(entry)}
                    data-testid={`history-item-${i}`}
                  >
                    {entry.pickQuery && (
                      <div className={historyPickStyles}>{entry.pickQuery}</div>
                    )}
                    <div className={historyMongoStyles}>
                      → {entry.mongoFilter}
                      {entry.mongoSort &&
                        ` (sort: ${JSON.stringify(entry.mongoSort)})`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Translation status */}
        {isTranslating && (
          <span className={statusStyles} data-testid="translating-indicator">
            <span
              className={cx(
                spinnerStyles,
                darkMode ? darkSpinnerStyles : lightSpinnerStyles
              )}
            />
            Translating...
          </span>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div
          className={cx(
            errorStyles,
            darkMode ? darkErrorStyles : lightErrorStyles
          )}
          data-testid="query-error"
        >
          {error}
        </div>
      )}

      {/* Translation warnings */}
      {translationWarnings.length > 0 && (
        <div
          className={cx(
            warningStyles,
            darkMode ? darkWarningStyles : lightWarningStyles
          )}
          data-testid="translation-warnings"
        >
          <Icon glyph="Warning" size="small" /> {translationWarnings.join('; ')}
        </div>
      )}

      {/* Fields used chips */}
      {fieldsUsed.length > 0 && (
        <div className={fieldsUsedStyles} data-testid="fields-used">
          <span
            className={cx(
              labelStyles,
              darkMode ? darkLabelStyles : lightLabelStyles
            )}
            style={{ minWidth: 'auto' }}
          >
            Fields:
          </span>
          {fieldsUsed.map((field) => (
            <span
              key={field.mongo_path}
              className={cx(
                fieldChipStyles,
                darkMode ? darkFieldChipStyles : lightFieldChipStyles
              )}
              data-testid={`field-chip-${field.name}`}
            >
              {field.name} (attr {field.attribute_number} → {field.mongo_path})
            </span>
          ))}
        </div>
      )}

      {/* LIST/SORT output panel */}
      {showReport && (
        <div className={listOutputContainerStyles}>
          <ListOutputPanel
            reportText={reportText}
            columns={reportColumns}
            total={reportTotal}
            onClose={() => setShowReport(false)}
            page={listPage}
            hasMore={listHasMore}
            onNextPage={handleNextPage}
            onPreviousPage={handlePreviousPage}
            isPaging={isListing}
          />
        </div>
      )}
    </div>
  );
}
