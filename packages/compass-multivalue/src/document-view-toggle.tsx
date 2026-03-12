import React, { useState, useCallback } from 'react';
import { css, cx } from '@leafygreen-ui/emotion';
import { palette } from '@leafygreen-ui/palette';
import { spacing } from '@leafygreen-ui/tokens';
import {
  useDarkMode,
  SegmentedControl,
  SegmentedControlOption,
} from '@mongodb-js/compass-components';

import { AttributeViewer, type AttributeViewerProps } from './attribute-viewer';
import { isMGData, type MVDisplayConfig, type DictField } from './mgdata';

// ── Types ──────────────────────────────────────────────────────────

type ViewMode = 'json' | 'attribute';

export interface DocumentViewToggleProps {
  /** The MongoDB document to display */
  document: { _id: string; [key: string]: any };

  /** DICT definitions (optional, passed through to AttributeViewer) */
  dictFields?: DictField[] | null;

  /** Display configuration (passed through to AttributeViewer) */
  config?: Partial<MVDisplayConfig>;

  /** Callback when user clicks an attribute */
  onAttributeClick?: (attrNumber: number) => void;
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

const jsonViewStyles = css({
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '13px',
  lineHeight: '1.5',
  padding: spacing[400],
  borderRadius: '4px',
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  margin: 0,
});

const lightJsonStyles = css({
  backgroundColor: palette.gray.light3,
  color: palette.gray.dark3,
});

const darkJsonStyles = css({
  backgroundColor: palette.black,
  color: palette.gray.light2,
});

// ── Component ──────────────────────────────────────────────────────

export function DocumentViewToggle({
  document: doc,
  dictFields,
  config,
  onAttributeClick,
}: DocumentViewToggleProps) {
  const darkMode = useDarkMode();
  const hasMGData = isMGData(doc);
  const [mode, setMode] = useState<ViewMode>(hasMGData ? 'attribute' : 'json');

  const handleModeChange = useCallback((value: string) => {
    setMode(value as ViewMode);
  }, []);

  return (
    <div className={wrapperStyles} data-testid="document-view-toggle">
      {/* Toggle */}
      <div className={toggleBarStyles}>
        <SegmentedControl
          size="xsmall"
          value={mode}
          onChange={handleModeChange}
          aria-label="Document view mode"
        >
          <SegmentedControlOption value="json" data-testid="toggle-json">
            JSON
          </SegmentedControlOption>
          <SegmentedControlOption
            value="attribute"
            data-testid="toggle-attribute"
            disabled={!hasMGData}
          >
            Attribute
          </SegmentedControlOption>
        </SegmentedControl>
      </div>

      {/* View content */}
      {mode === 'json' ? (
        <pre
          className={cx(
            jsonViewStyles,
            darkMode ? darkJsonStyles : lightJsonStyles
          )}
          data-testid="json-view"
        >
          {JSON.stringify(doc, null, 2)}
        </pre>
      ) : (
        <AttributeViewer
          document={doc as { _id: string; MGData: any[] }}
          dictFields={dictFields}
          config={config}
          onAttributeClick={onAttributeClick}
        />
      )}
    </div>
  );
}
