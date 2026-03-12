import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import {
  EditorView,
  lineNumbers,
  drawSelection,
  keymap,
} from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
  foldKeymap,
} from '@codemirror/language';
import { pickBasicLanguage } from './pick-basic-language';

// ── Types ──────────────────────────────────────────────────────────

type ViewMode = 'json' | 'attribute' | 'source';

export interface DocumentViewToggleProps {
  /** The MongoDB document to display */
  document: { _id: string; [key: string]: any };

  /** DICT definitions (optional, passed through to AttributeViewer) */
  dictFields?: DictField[] | null;

  /** Display configuration (passed through to AttributeViewer) */
  config?: Partial<MVDisplayConfig>;

  /** Callback when user clicks an attribute */
  onAttributeClick?: (attrNumber: number) => void;

  /** When set, this is a program collection — show Source tab instead of Attribute */
  onViewSource?: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Convert MGData array to source text (each element = one line) */
function mgdataToSource(mgdata: unknown[]): string {
  return mgdata
    .map((line) => {
      if (typeof line === 'string') return line;
      if (Array.isArray(line)) return line.join(String.fromCharCode(253));
      return String(line ?? '');
    })
    .join('\n');
}

// ── Styles ─────────────────────────────────────────────────────────

const wrapperStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[200],
});

const toggleBarStyles = css({
  alignSelf: 'flex-start',
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
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

const sourceContainerStyles = css({
  borderRadius: '4px',
  overflow: 'hidden',
  '& .cm-editor': {
    maxHeight: '400px',
  },
  '& .cm-scroller': {
    fontFamily:
      '"Source Code Pro", Menlo, Monaco, Consolas, monospace !important',
    fontSize: '13px',
    lineHeight: '1.5',
  },
});

// CodeMirror dark theme
const cmDarkTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: palette.gray.dark4,
      color: palette.gray.light2,
    },
    '.cm-gutters': {
      backgroundColor: palette.gray.dark3,
      color: palette.gray.base,
      borderRight: `1px solid ${palette.gray.dark2}`,
    },
    '.cm-activeLineGutter': {
      backgroundColor: palette.gray.dark2,
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    '.cm-cursor': {
      borderLeftColor: palette.gray.light2,
    },
    '.cm-selectionBackground': {
      backgroundColor: 'rgba(100, 150, 255, 0.2) !important',
    },
  },
  { dark: true }
);

// CodeMirror light theme
const cmLightTheme = EditorView.theme({
  '&': {
    backgroundColor: palette.white,
    color: palette.gray.dark3,
  },
  '.cm-gutters': {
    backgroundColor: palette.gray.light3,
    color: palette.gray.dark1,
    borderRight: `1px solid ${palette.gray.light1}`,
  },
  '.cm-activeLineGutter': {
    backgroundColor: palette.gray.light2,
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
});

// ── Inline Source Viewer ────────────────────────────────────────────

function InlineSourceViewer({
  source,
  darkMode,
}: {
  source: string;
  darkMode: boolean;
}) {
  const editorParentRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!editorParentRef.current || !source) return;

    if (editorViewRef.current) {
      editorViewRef.current.destroy();
      editorViewRef.current = null;
    }

    const state = EditorState.create({
      doc: source,
      extensions: [
        lineNumbers(),
        foldGutter(),
        history(),
        drawSelection(),
        bracketMatching(),
        syntaxHighlighting(defaultHighlightStyle),
        pickBasicLanguage,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        darkMode ? cmDarkTheme : cmLightTheme,
        keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),
      ],
    });

    editorViewRef.current = new EditorView({
      state,
      parent: editorParentRef.current,
    });

    return () => {
      if (editorViewRef.current) {
        editorViewRef.current.destroy();
        editorViewRef.current = null;
      }
    };
  }, [source, darkMode]);

  return (
    <div
      ref={editorParentRef}
      className={sourceContainerStyles}
      data-testid="inline-source-view"
    />
  );
}

// ── Component ──────────────────────────────────────────────────────

export function DocumentViewToggle({
  document: doc,
  dictFields,
  config,
  onAttributeClick,
  onViewSource,
}: DocumentViewToggleProps) {
  const darkMode = useDarkMode();
  const hasMGData = isMGData(doc);
  const isProgram = !!onViewSource;

  // Program collections default to 'source', others to 'attribute'
  const [mode, setMode] = useState<ViewMode>(
    isProgram ? 'source' : hasMGData ? 'attribute' : 'json'
  );

  const handleModeChange = useCallback((value: string) => {
    setMode(value as ViewMode);
  }, []);

  // Build source text from MGData (only for program collections)
  const sourceText =
    isProgram && hasMGData ? mgdataToSource(doc.MGData as unknown[]) : '';

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
          {isProgram ? (
            <SegmentedControlOption
              value="source"
              data-testid="toggle-source"
              disabled={!hasMGData}
            >
              Source
            </SegmentedControlOption>
          ) : (
            <SegmentedControlOption
              value="attribute"
              data-testid="toggle-attribute"
              disabled={!hasMGData}
            >
              Attribute
            </SegmentedControlOption>
          )}
        </SegmentedControl>
      </div>

      {/* View content */}
      {mode === 'json' && (
        <pre
          className={cx(
            jsonViewStyles,
            darkMode ? darkJsonStyles : lightJsonStyles
          )}
          data-testid="json-view"
        >
          {JSON.stringify(doc, null, 2)}
        </pre>
      )}
      {mode === 'attribute' && (
        <AttributeViewer
          document={doc as { _id: string; MGData: any[] }}
          dictFields={dictFields}
          config={config}
          onAttributeClick={onAttributeClick}
        />
      )}
      {mode === 'source' && (
        <InlineSourceViewer source={sourceText} darkMode={darkMode} />
      )}
    </div>
  );
}
