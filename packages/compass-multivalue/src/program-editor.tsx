// MVCompass: Read-only Pick Basic program viewer
//
// Displays Pick Basic source code stored in MongoDB (MGData format)
// with syntax highlighting via CodeMirror 6. Phase 1 is read-only;
// Phase 2 (future) will add edit/save and transpiler integration.

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { css, cx } from '@leafygreen-ui/emotion';
import { palette } from '@leafygreen-ui/palette';
import { spacing } from '@leafygreen-ui/tokens';
import { useDarkMode } from '@mongodb-js/compass-components';
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
import type { BridgeClient } from './bridge-client';

// ── Types ──────────────────────────────────────────────────────────

export interface ProgramEditorProps {
  database: string;
  collection: string;
  itemId: string;
  bridgeClient: BridgeClient;
  onClose: () => void;
}

// ── Styles ─────────────────────────────────────────────────────────

const overlayStyles = css({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  zIndex: 100,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
});

const dialogStyles = css({
  width: '80vw',
  maxWidth: '1000px',
  height: '80vh',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: '8px',
  overflow: 'hidden',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
});

const lightDialogStyles = css({
  backgroundColor: palette.white,
  border: `1px solid ${palette.gray.light1}`,
});

const darkDialogStyles = css({
  backgroundColor: palette.gray.dark4,
  border: `1px solid ${palette.gray.dark2}`,
});

const headerStyles = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: `${spacing[200]}px ${spacing[400]}px`,
  flexShrink: 0,
});

const lightHeaderStyles = css({
  backgroundColor: palette.gray.light3,
  borderBottom: `1px solid ${palette.gray.light1}`,
});

const darkHeaderStyles = css({
  backgroundColor: palette.gray.dark3,
  borderBottom: `1px solid ${palette.gray.dark2}`,
});

const titleStyles = css({
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '14px',
  fontWeight: 600,
});

const lightTitleStyles = css({
  color: palette.gray.dark3,
});

const darkTitleStyles = css({
  color: palette.gray.light2,
});

const subtitleStyles = css({
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '12px',
  opacity: 0.7,
  marginLeft: spacing[200],
});

const closeButtonStyles = css({
  background: 'transparent',
  border: 'none',
  fontSize: '18px',
  cursor: 'pointer',
  padding: spacing[100],
  borderRadius: '4px',
});

const lightCloseButtonStyles = css({
  color: palette.gray.dark1,
  ':hover': { color: palette.gray.dark3, backgroundColor: palette.gray.light2 },
});

const darkCloseButtonStyles = css({
  color: palette.gray.light1,
  ':hover': { color: palette.white, backgroundColor: palette.gray.dark2 },
});

const editorContainerStyles = css({
  flex: 1,
  overflow: 'auto',
  '& .cm-editor': {
    height: '100%',
  },
  '& .cm-scroller': {
    fontFamily:
      '"Source Code Pro", Menlo, Monaco, Consolas, monospace !important',
    fontSize: '13px',
    lineHeight: '1.5',
  },
});

const loadingStyles = css({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100%',
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '14px',
});

const lightLoadingStyles = css({
  color: palette.gray.dark1,
});

const darkLoadingStyles = css({
  color: palette.gray.light1,
});

const errorStyles = css({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100%',
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '14px',
  padding: spacing[400],
  textAlign: 'center',
});

const lightErrorStyles = css({
  color: palette.red.base,
});

const darkErrorStyles = css({
  color: palette.red.light1,
});

const statusBarStyles = css({
  padding: `${spacing[100]}px ${spacing[400]}px`,
  fontSize: '12px',
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  display: 'flex',
  justifyContent: 'space-between',
  flexShrink: 0,
});

const lightStatusBarStyles = css({
  backgroundColor: palette.gray.light3,
  borderTop: `1px solid ${palette.gray.light1}`,
  color: palette.gray.dark1,
});

const darkStatusBarStyles = css({
  backgroundColor: palette.gray.dark3,
  borderTop: `1px solid ${palette.gray.dark2}`,
  color: palette.gray.light1,
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

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Heuristic to detect if a collection likely contains Pick Basic programs.
 * Checks for common naming patterns: BP, PROGRAMS, SOURCE, etc.
 */
export function isProgramCollection(collectionName: string): boolean {
  const upper = collectionName.toUpperCase();
  return (
    upper === 'BP' ||
    upper.endsWith('.BP') ||
    upper.includes('PROGRAMS') ||
    upper.includes('SOURCE') ||
    upper.endsWith('.LIB') ||
    upper === 'BLIB' ||
    upper === 'PYTHONLIB'
  );
}

/**
 * Convert MGData array to source text.
 * Each element is one line of source code.
 */
function mgdataToSource(mgdata: unknown[]): string {
  return mgdata
    .map((line) => {
      if (typeof line === 'string') return line;
      if (Array.isArray(line)) return line.join(String.fromCharCode(253));
      return String(line ?? '');
    })
    .join('\n');
}

// ── Component ──────────────────────────────────────────────────────

export function ProgramEditor({
  database,
  collection,
  itemId,
  bridgeClient,
  onClose,
}: ProgramEditorProps) {
  const darkMode = useDarkMode();
  const editorParentRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState('');
  const [lineCount, setLineCount] = useState(0);

  // Fetch document on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchDocument() {
      setLoading(true);
      setError(null);
      try {
        const response = await bridgeClient.request('document.read', {
          database,
          collection,
          item_id: itemId,
        });
        if (cancelled) return;

        const doc = response.result as {
          item_id: string;
          attributes: Array<{ number: number; value: unknown; raw?: unknown }>;
        } | null;

        if (!doc || !doc.attributes) {
          setError(`Item "${itemId}" not found in ${collection}`);
          return;
        }

        // Reconstruct MGData from attributes (sorted by number)
        const mgdata = doc.attributes
          .sort((a, b) => a.number - b.number)
          .map((attr) => attr.value ?? attr.raw);

        const text = mgdataToSource(mgdata);
        setSourceText(text);
        setLineCount(text.split('\n').length);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to read document');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDocument();
    return () => {
      cancelled = true;
    };
  }, [bridgeClient, database, collection, itemId]);

  // Initialize CodeMirror when source text is ready
  useEffect(() => {
    if (loading || error || !editorParentRef.current || !sourceText) return;

    // Clean up previous editor
    if (editorViewRef.current) {
      editorViewRef.current.destroy();
      editorViewRef.current = null;
    }

    const state = EditorState.create({
      doc: sourceText,
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
        EditorView.lineWrapping,
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
  }, [loading, error, sourceText, darkMode]);

  // Handle Escape key to close
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <div
      className={overlayStyles}
      onKeyDown={handleKeyDown}
      data-testid="program-editor-overlay"
    >
      <div
        className={cx(
          dialogStyles,
          darkMode ? darkDialogStyles : lightDialogStyles
        )}
        data-testid="program-editor"
      >
        {/* Header */}
        <div
          className={cx(
            headerStyles,
            darkMode ? darkHeaderStyles : lightHeaderStyles
          )}
        >
          <div>
            <span
              className={cx(
                titleStyles,
                darkMode ? darkTitleStyles : lightTitleStyles
              )}
            >
              {itemId}
            </span>
            <span
              className={cx(
                subtitleStyles,
                darkMode ? darkTitleStyles : lightTitleStyles
              )}
            >
              {database}/{collection}
            </span>
          </div>
          <button
            className={cx(
              closeButtonStyles,
              darkMode ? darkCloseButtonStyles : lightCloseButtonStyles
            )}
            onClick={onClose}
            data-testid="program-editor-close"
          >
            ×
          </button>
        </div>

        {/* Editor area */}
        <div className={editorContainerStyles}>
          {loading && (
            <div
              className={cx(
                loadingStyles,
                darkMode ? darkLoadingStyles : lightLoadingStyles
              )}
            >
              Loading {itemId}...
            </div>
          )}
          {error && (
            <div
              className={cx(
                errorStyles,
                darkMode ? darkErrorStyles : lightErrorStyles
              )}
              data-testid="program-editor-error"
            >
              {error}
            </div>
          )}
          {!loading && !error && (
            <div ref={editorParentRef} style={{ height: '100%' }} />
          )}
        </div>

        {/* Status bar */}
        <div
          className={cx(
            statusBarStyles,
            darkMode ? darkStatusBarStyles : lightStatusBarStyles
          )}
          data-testid="program-editor-status"
        >
          <span>
            {lineCount} line{lineCount !== 1 ? 's' : ''}
          </span>
          <span>Pick Basic — Read Only</span>
        </div>
      </div>
    </div>
  );
}
