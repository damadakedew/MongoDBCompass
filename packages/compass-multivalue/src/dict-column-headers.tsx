import React, { useState, useCallback, useMemo } from 'react';
import { css, cx } from '@leafygreen-ui/emotion';
import { palette } from '@leafygreen-ui/palette';
import { spacing } from '@leafygreen-ui/tokens';
import {
  useDarkMode,
  SegmentedControl,
  SegmentedControlOption,
  Icon,
} from '@mongodb-js/compass-components';

import type { DictField } from './mgdata';
import {
  formatValue,
  normalizeMGData,
  DEFAULT_CONFIG,
  type MVDisplayConfig,
} from './mgdata';
import {
  buildMergedColumns,
  type DictColumnConfig,
  type SortType,
} from './dict-columns';

// ── Types ──────────────────────────────────────────────────────────

export interface DictColumnHeadersProps {
  /** DICT field definitions from bridge dict.list response. Null = no DICT. */
  dictFields: DictField[] | null;

  /** Documents to display in the table */
  documents: Array<{ _id: string; MGData: any[] }>;

  /** Display configuration for VM/SVM separators */
  config?: Partial<MVDisplayConfig>;

  /** Callback when a column header is clicked (for sorting) */
  onSort?: (column: DictColumnConfig, direction: 'asc' | 'desc') => void;

  /** Callback when a row is clicked */
  onRowClick?: (itemId: string) => void;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  columnIndex: number | null;
  direction: SortDirection;
}

// ── Styles ─────────────────────────────────────────────────────────

const wrapperStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[200],
});

const toggleBarStyles = css({
  alignSelf: 'flex-start',
});

const tableContainerStyles = css({
  overflow: 'auto',
  borderRadius: '4px',
});

const lightTableContainerStyles = css({
  border: `1px solid ${palette.gray.light2}`,
});

const darkTableContainerStyles = css({
  border: `1px solid ${palette.gray.dark2}`,
});

const tableStyles = css({
  width: '100%',
  borderCollapse: 'collapse',
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '13px',
});

const thBaseStyles = css({
  padding: `${spacing[100]}px ${spacing[300]}px`,
  borderRight: '1px solid',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  userSelect: 'none',
  fontWeight: 600,
  position: 'relative',
});

const lightThStyles = css({
  backgroundColor: palette.gray.light3,
  color: palette.blue.dark1,
  borderBottom: `2px solid ${palette.gray.light1}`,
  borderRightColor: palette.gray.light2,
});

const darkThStyles = css({
  backgroundColor: palette.gray.dark3,
  color: palette.blue.light1,
  borderBottom: `2px solid ${palette.gray.dark1}`,
  borderRightColor: palette.gray.dark2,
});

const thItemIdStyles = css({
  padding: `${spacing[100]}px ${spacing[300]}px`,
  whiteSpace: 'nowrap',
  fontWeight: 600,
  textAlign: 'left',
  minWidth: '12ch',
  borderRight: '1px solid',
});

const lightThItemIdStyles = css({
  backgroundColor: palette.gray.light3,
  color: palette.blue.dark1,
  borderBottom: `2px solid ${palette.gray.light1}`,
  borderRightColor: palette.gray.light2,
});

const darkThItemIdStyles = css({
  backgroundColor: palette.gray.dark3,
  color: palette.blue.light1,
  borderBottom: `2px solid ${palette.gray.dark1}`,
  borderRightColor: palette.gray.dark2,
});

const tdBaseStyles = css({
  padding: `${spacing[100]}px ${spacing[300]}px`,
  borderRight: '1px solid',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const lightTdStyles = css({
  borderBottom: `1px solid ${palette.gray.light2}`,
  borderRightColor: palette.gray.light2,
  color: palette.gray.dark3,
});

const darkTdStyles = css({
  borderBottom: `1px solid ${palette.gray.dark2}`,
  borderRightColor: palette.gray.dark2,
  color: palette.gray.light2,
});

const tdItemIdStyles = css({
  padding: `${spacing[100]}px ${spacing[300]}px`,
  whiteSpace: 'nowrap',
  fontWeight: 600,
  borderRight: '1px solid',
});

const lightTdItemIdStyles = css({
  borderBottom: `1px solid ${palette.gray.light2}`,
  borderRightColor: palette.gray.light2,
  color: palette.blue.dark1,
});

const darkTdItemIdStyles = css({
  borderBottom: `1px solid ${palette.gray.dark2}`,
  borderRightColor: palette.gray.dark2,
  color: palette.blue.light1,
});

const lightRowHoverStyles = css({
  ':hover': {
    backgroundColor: palette.gray.light2,
  },
});

const darkRowHoverStyles = css({
  ':hover': {
    backgroundColor: palette.gray.dark3,
  },
});

const rowStyles = css({
  cursor: 'pointer',
});

const sortIndicatorStyles = css({
  marginLeft: spacing[100],
  fontSize: '10px',
  display: 'inline-flex',
  verticalAlign: 'middle',
});

const dictBadgeStyles = css({
  fontSize: '10px',
  display: 'block',
  fontWeight: 'normal',
});

const lightDictBadgeStyles = css({
  color: palette.green.dark1,
});

const darkDictBadgeStyles = css({
  color: palette.green.base,
});

const lightFallbackBadgeStyles = css({
  color: palette.gray.dark1,
  fontStyle: 'italic',
});

const darkFallbackBadgeStyles = css({
  color: palette.gray.light1,
  fontStyle: 'italic',
});

// ── Helpers ────────────────────────────────────────────────────────

function justificationToTextAlign(j: string): 'left' | 'right' | 'center' {
  if (j === 'R') return 'right';
  if (j === 'C') return 'center';
  return 'left';
}

// ── Component ──────────────────────────────────────────────────────

export function DictColumnHeaders({
  dictFields,
  documents,
  config: configOverride,
  onSort,
  onRowClick,
}: DictColumnHeadersProps) {
  const darkMode = useDarkMode();
  const cfg: MVDisplayConfig = { ...DEFAULT_CONFIG, ...configOverride };

  const [headerMode, setHeaderMode] = useState<'dict' | 'raw'>(
    dictFields && dictFields.length > 0 ? 'dict' : 'raw'
  );
  const [sortState, setSortState] = useState<SortState>({
    columnIndex: null,
    direction: null,
  });

  const maxAttrs = useMemo(
    () =>
      Math.max(
        0,
        ...documents.map((d) =>
          d.MGData ? normalizeMGData(d.MGData).length : 0
        )
      ),
    [documents]
  );

  const dictColumns = useMemo(
    () => buildMergedColumns(dictFields, maxAttrs),
    [dictFields, maxAttrs]
  );

  const rawColumns = useMemo(
    () => buildMergedColumns(null, maxAttrs),
    [maxAttrs]
  );

  const columns = headerMode === 'dict' ? dictColumns : rawColumns;

  const handleSort = useCallback(
    (col: DictColumnConfig) => {
      setSortState((prev) => {
        let direction: SortDirection;
        if (prev.columnIndex === col.index) {
          direction =
            prev.direction === 'asc'
              ? 'desc'
              : prev.direction === 'desc'
              ? null
              : 'asc';
        } else {
          direction = 'asc';
        }
        if (direction && onSort) {
          onSort(col, direction);
        }
        return { columnIndex: direction ? col.index : null, direction };
      });
    },
    [onSort]
  );

  const sortedDocuments = useMemo(() => {
    if (sortState.columnIndex === null || sortState.direction === null) {
      return documents;
    }
    const idx = sortState.columnIndex;
    const dir = sortState.direction === 'asc' ? 1 : -1;
    const col = columns.find((c) => c.index === idx);
    const sortType: SortType = col?.sortType ?? 'string';

    return [...documents].sort((a, b) => {
      const aNorm = normalizeMGData(a.MGData);
      const bNorm = normalizeMGData(b.MGData);
      const aVal = aNorm[idx];
      const bVal = bNorm[idx];

      const aStr = Array.isArray(aVal)
        ? formatValue(aVal, cfg)
        : String(aVal ?? '');
      const bStr = Array.isArray(bVal)
        ? formatValue(bVal, cfg)
        : String(bVal ?? '');

      if (sortType === 'number') {
        return ((parseFloat(aStr) || 0) - (parseFloat(bStr) || 0)) * dir;
      }
      if (sortType === 'date') {
        return ((parseInt(aStr) || 0) - (parseInt(bStr) || 0)) * dir;
      }
      return aStr.localeCompare(bStr) * dir;
    });
  }, [documents, sortState, columns, cfg]);

  const hasDictFields = dictFields && dictFields.length > 0;

  return (
    <div className={wrapperStyles} data-testid="dict-column-headers">
      {/* Header mode toggle */}
      {hasDictFields && (
        <div className={toggleBarStyles}>
          <SegmentedControl
            size="xsmall"
            value={headerMode}
            onChange={(value: string) => setHeaderMode(value as 'dict' | 'raw')}
            aria-label="Header display mode"
          >
            <SegmentedControlOption
              value="dict"
              data-testid="toggle-dict-headers"
            >
              DICT Headers
            </SegmentedControlOption>
            <SegmentedControlOption
              value="raw"
              data-testid="toggle-raw-headers"
            >
              Raw Headers
            </SegmentedControlOption>
          </SegmentedControl>
        </div>
      )}

      {/* Table */}
      <div
        className={cx(
          tableContainerStyles,
          darkMode ? darkTableContainerStyles : lightTableContainerStyles
        )}
      >
        <table className={tableStyles} data-testid="dict-table">
          <thead>
            <tr>
              <th
                className={cx(
                  thItemIdStyles,
                  darkMode ? darkThItemIdStyles : lightThItemIdStyles
                )}
              >
                item-id
              </th>
              {columns.map((col) => (
                <th
                  key={`${col.index}-${col.dictItemId ?? 'fb'}`}
                  className={cx(
                    thBaseStyles,
                    darkMode ? darkThStyles : lightThStyles
                  )}
                  style={{
                    textAlign: justificationToTextAlign(col.justification),
                    minWidth: `${Math.max(col.width, 4)}ch`,
                  }}
                  onClick={() => handleSort(col)}
                  data-testid={`col-header-${col.index}`}
                >
                  {col.header}
                  {sortState.columnIndex === col.index && (
                    <span className={sortIndicatorStyles}>
                      <Icon
                        glyph={
                          sortState.direction === 'asc'
                            ? 'SortAscending'
                            : 'SortDescending'
                        }
                        size="small"
                      />
                    </span>
                  )}
                  {headerMode === 'dict' && (
                    <span
                      className={cx(
                        dictBadgeStyles,
                        col.fromDict
                          ? darkMode
                            ? darkDictBadgeStyles
                            : lightDictBadgeStyles
                          : darkMode
                          ? darkFallbackBadgeStyles
                          : lightFallbackBadgeStyles
                      )}
                    >
                      {col.fromDict ? col.dictItemId : `MGData.${col.index}`}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedDocuments.map((doc) => (
              <tr
                key={doc._id}
                className={cx(
                  rowStyles,
                  darkMode ? darkRowHoverStyles : lightRowHoverStyles
                )}
                onClick={() => onRowClick?.(doc._id)}
                data-testid={`row-${doc._id}`}
              >
                <td
                  className={cx(
                    tdItemIdStyles,
                    darkMode ? darkTdItemIdStyles : lightTdItemIdStyles
                  )}
                >
                  {doc._id}
                </td>
                {columns.map((col) => {
                  const raw = normalizeMGData(doc.MGData)[col.index];
                  const display =
                    raw !== undefined ? formatValue(raw, cfg) : '';
                  return (
                    <td
                      key={`${col.index}-${col.dictItemId ?? 'fb'}`}
                      className={cx(
                        tdBaseStyles,
                        darkMode ? darkTdStyles : lightTdStyles
                      )}
                      style={{
                        textAlign: justificationToTextAlign(col.justification),
                      }}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
