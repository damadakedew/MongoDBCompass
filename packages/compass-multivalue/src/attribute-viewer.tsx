import React, { useState, useCallback } from 'react';
import { css, cx } from '@leafygreen-ui/emotion';
import { palette } from '@leafygreen-ui/palette';
import { spacing } from '@leafygreen-ui/tokens';
import { useDarkMode } from '@mongodb-js/compass-components';
import { Icon, Tooltip, Badge } from '@mongodb-js/compass-components';

import {
  parseMGData,
  formatAttrNumber,
  type MVAttribute,
  type MVDisplayConfig,
  type DictField,
  DEFAULT_CONFIG,
} from './mgdata';

// ── Props ──────────────────────────────────────────────────────────

export interface AttributeViewerProps {
  /** The MongoDB document to display */
  document: {
    _id: string;
    MGData: any[];
  };

  /** DICT definitions for this collection (from bridge dict.list response).
   *  Optional — if provided, enables hover tooltips on attribute numbers. */
  dictFields?: DictField[] | null;

  /** Display configuration */
  config?: Partial<MVDisplayConfig>;

  /** Callback when user clicks an attribute (for future editing) */
  onAttributeClick?: (attrNumber: number) => void;
}

// ── Styles ─────────────────────────────────────────────────────────

const containerStyles = css({
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '13px',
  lineHeight: '1.5',
  padding: spacing[400],
  borderRadius: '4px',
  overflow: 'auto',
});

const lightContainerStyles = css({
  backgroundColor: palette.gray.light3,
  color: palette.gray.dark3,
});

const darkContainerStyles = css({
  backgroundColor: palette.black,
  color: palette.gray.light2,
});

const itemIdStyles = css({
  marginBottom: spacing[100],
  fontWeight: 600,
});

const lightItemIdStyles = css({
  color: palette.blue.dark1,
});

const darkItemIdStyles = css({
  color: palette.blue.light1,
});

const attrLineStyles = css({
  display: 'flex',
  alignItems: 'flex-start',
  cursor: 'default',
  padding: '1px 0',
  borderRadius: '2px',
});

const lightAttrLineHoverStyles = css({
  ':hover': {
    backgroundColor: palette.gray.light2,
  },
});

const darkAttrLineHoverStyles = css({
  ':hover': {
    backgroundColor: palette.gray.dark3,
  },
});

const attrNumberStyles = css({
  marginRight: spacing[100],
  userSelect: 'none',
  flexShrink: 0,
});

const lightAttrNumberStyles = css({
  color: palette.green.dark1,
});

const darkAttrNumberStyles = css({
  color: palette.green.base,
});

const attrValueStyles = css({
  whiteSpace: 'pre',
});

const lightAttrValueStyles = css({
  color: palette.gray.dark3,
});

const darkAttrValueStyles = css({
  color: palette.gray.light2,
});

const expandToggleStyles = css({
  cursor: 'pointer',
  userSelect: 'none',
  marginLeft: spacing[200],
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2px',
});

const expandedValueStyles = css({
  paddingLeft: '40px',
});

const lightExpandedValueStyles = css({
  color: palette.gray.dark1,
});

const darkExpandedValueStyles = css({
  color: palette.gray.light1,
});

const expandedSubvalueStyles = css({
  paddingLeft: '54px',
});

const lightExpandedSubvalueStyles = css({
  color: palette.yellow.dark2,
});

const darkExpandedSubvalueStyles = css({
  color: palette.yellow.base,
});

const dictTooltipContentStyles = css({
  fontSize: '12px',
  lineHeight: '1.4',
});

// ── Component ──────────────────────────────────────────────────────

export function AttributeViewer({
  document: doc,
  dictFields,
  config: configOverride,
  onAttributeClick,
}: AttributeViewerProps) {
  const darkMode = useDarkMode();
  const config: MVDisplayConfig = { ...DEFAULT_CONFIG, ...configOverride };
  const attributes = parseMGData(doc.MGData, config);

  const [expandedAttrs, setExpandedAttrs] = useState<Set<number>>(new Set());

  const toggleExpand = useCallback((attrNumber: number) => {
    setExpandedAttrs((prev) => {
      const next = new Set(prev);
      if (next.has(attrNumber)) {
        next.delete(attrNumber);
      } else {
        next.add(attrNumber);
      }
      return next;
    });
  }, []);

  // Build DICT lookup by attribute number
  const dictByAttr = new Map<number, DictField>();
  if (dictFields) {
    for (const field of dictFields) {
      dictByAttr.set(field.attribute_number, field);
    }
  }

  const handleAttrClick = useCallback(
    (attr: MVAttribute) => {
      if (attr.multivalued) {
        toggleExpand(attr.number);
      }
      onAttributeClick?.(attr.number);
    },
    [toggleExpand, onAttributeClick]
  );

  return (
    <div
      className={cx(
        containerStyles,
        darkMode ? darkContainerStyles : lightContainerStyles
      )}
      data-testid="attribute-viewer"
    >
      {/* Item ID line */}
      <div
        className={cx(
          itemIdStyles,
          darkMode ? darkItemIdStyles : lightItemIdStyles
        )}
        data-testid="item-id-line"
      >
        _id: {doc._id}
      </div>

      {/* Attribute lines */}
      {attributes.map((attr) => {
        const isExpanded = expandedAttrs.has(attr.number);
        const dictField = dictByAttr.get(attr.number);
        const numStr = formatAttrNumber(attr.number, config.zeroPad);

        const attrNumberEl = (
          <span
            className={cx(
              attrNumberStyles,
              darkMode ? darkAttrNumberStyles : lightAttrNumberStyles
            )}
          >
            {numStr}:
          </span>
        );

        return (
          <div key={attr.number}>
            {/* Main attribute line */}
            <div
              className={cx(
                attrLineStyles,
                darkMode ? darkAttrLineHoverStyles : lightAttrLineHoverStyles
              )}
              data-testid={`attr-line-${attr.number}`}
              onClick={() => handleAttrClick(attr)}
            >
              {/* Attribute number — with DICT tooltip if available */}
              {dictField ? (
                <Tooltip
                  trigger={({ children, ...triggerProps }) => (
                    <span {...triggerProps}>
                      {attrNumberEl}
                      {children}
                    </span>
                  )}
                >
                  <div className={dictTooltipContentStyles}>
                    <strong>{dictField.item_id}</strong> — {dictField.header}
                    {dictField.conversion && (
                      <div>Conv: {dictField.conversion}</div>
                    )}
                    <div>
                      Just: {dictField.justification} | Width: {dictField.width}
                    </div>
                  </div>
                </Tooltip>
              ) : (
                attrNumberEl
              )}

              <span
                className={cx(
                  attrValueStyles,
                  darkMode ? darkAttrValueStyles : lightAttrValueStyles
                )}
              >
                {isExpanded && attr.multivalued
                  ? attr.values[0]?.value ?? ''
                  : attr.display}
              </span>

              {attr.multivalued && (
                <span
                  className={expandToggleStyles}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(attr.number);
                  }}
                  data-testid={`expand-toggle-${attr.number}`}
                >
                  <Icon
                    glyph={isExpanded ? 'CaretDown' : 'CaretRight'}
                    size="small"
                  />
                  <Badge>{attr.values.length}V</Badge>
                </span>
              )}
            </div>

            {/* Expanded multi-value lines */}
            {isExpanded && attr.multivalued && (
              <div data-testid={`expanded-${attr.number}`}>
                {attr.values.map((mv, vi) => {
                  if (vi === 0 && !mv.subvalues) return null;

                  if (mv.subvalues) {
                    return mv.subvalues.map((sv, si) => {
                      if (vi === 0 && si === 0) return null;
                      return (
                        <div
                          key={`${vi}-${si}`}
                          className={cx(
                            si === 0
                              ? expandedValueStyles
                              : expandedSubvalueStyles,
                            si === 0
                              ? darkMode
                                ? darkExpandedValueStyles
                                : lightExpandedValueStyles
                              : darkMode
                              ? darkExpandedSubvalueStyles
                              : lightExpandedSubvalueStyles
                          )}
                        >
                          {sv}
                        </div>
                      );
                    });
                  }

                  return (
                    <div
                      key={vi}
                      className={cx(
                        expandedValueStyles,
                        darkMode
                          ? darkExpandedValueStyles
                          : lightExpandedValueStyles
                      )}
                    >
                      {mv.value}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
