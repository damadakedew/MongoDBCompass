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
import {
  isMGData,
  normalizeMGData,
  type MVDisplayConfig,
  type DictField,
} from './mgdata';
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

  /** When set, source view is editable and Save calls this with the new source text */
  onSaveSource?: (itemId: string, sourceText: string) => Promise<void>;

  /** Notifies parent when source dirty state changes (for footer Update button) */
  onSourceDirtyChange?: (dirty: boolean) => void;

  /** Ref that parent can call to trigger save from footer Update button */
  saveRef?: React.MutableRefObject<(() => Promise<void>) | null>;
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

// ── Save button styles ──────────────────────────────────────────────

const saveBarStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
  padding: `${spacing[100]}px 0`,
});

const saveButtonStyles = css({
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '12px',
  fontWeight: 600,
  padding: `${spacing[100]}px ${spacing[300]}px`,
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
});

const saveFeedbackStyles = css({
  fontSize: '12px',
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
});

// ── Inline Source Viewer ────────────────────────────────────────────

function InlineSourceViewer({
  source,
  darkMode,
  editable,
  onSave,
  onDirtyChange,
  saveRef,
}: {
  source: string;
  darkMode: boolean;
  editable?: boolean;
  onSave?: (text: string) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  saveRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}) {
  const editorParentRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const [dirty, setDirtyInternal] = useState(false);
  const setDirty = useCallback(
    (value: boolean) => {
      setDirtyInternal(value);
      onDirtyChange?.(value);
    },
    [onDirtyChange]
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(
    null
  );

  useEffect(() => {
    if (!editorParentRef.current || !source) return;

    if (editorViewRef.current) {
      editorViewRef.current.destroy();
      editorViewRef.current = null;
    }

    const extensions = [
      lineNumbers(),
      foldGutter(),
      history(),
      drawSelection(),
      bracketMatching(),
      syntaxHighlighting(defaultHighlightStyle),
      pickBasicLanguage,
      darkMode ? cmDarkTheme : cmLightTheme,
      keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),
    ];

    if (!editable) {
      extensions.push(EditorState.readOnly.of(true));
      extensions.push(EditorView.editable.of(false));
    } else {
      // Track changes for dirty state
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setDirty(true);
            setFeedback(null);
          }
        })
      );
    }

    const state = EditorState.create({
      doc: source,
      extensions,
    });

    editorViewRef.current = new EditorView({
      state,
      parent: editorParentRef.current,
    });

    setDirty(false);
    setFeedback(null);

    return () => {
      if (editorViewRef.current) {
        editorViewRef.current.destroy();
        editorViewRef.current = null;
      }
    };
  }, [source, darkMode, editable]);

  const handleSave = useCallback(async () => {
    if (!editorViewRef.current || !onSave) return;
    const text = editorViewRef.current.state.doc.toString();
    setSaving(true);
    setFeedback(null);
    try {
      await onSave(text);
      setDirty(false);
      setFeedback({ ok: true, msg: 'Saved' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ ok: false, msg: err.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  // Expose save function to parent via ref (for footer Update button)
  useEffect(() => {
    if (saveRef) {
      saveRef.current = handleSave;
      return () => {
        saveRef.current = null;
      };
    }
  }, [saveRef, handleSave]);

  return (
    <div data-testid="inline-source-view">
      {feedback && (
        <div className={saveBarStyles}>
          <span
            className={saveFeedbackStyles}
            style={{
              color: feedback.ok ? palette.green.base : palette.red.base,
            }}
            data-testid="source-save-feedback"
          >
            {feedback.msg}
          </span>
        </div>
      )}
      <div ref={editorParentRef} className={sourceContainerStyles} />
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────

export function DocumentViewToggle({
  document: doc,
  dictFields,
  config,
  onAttributeClick,
  onViewSource,
  onSaveSource,
  onSourceDirtyChange,
  saveRef,
}: DocumentViewToggleProps) {
  const darkMode = useDarkMode();
  const hasMGData = isMGData(doc);
  const isProgram = !!onViewSource;

  // Program collections default to 'source', others to 'attribute'
  const [mode, setMode] = useState<ViewMode>(
    isProgram ? 'source' : hasMGData ? 'attribute' : 'json'
  );
  // Track dirty state from InlineSourceViewer for tab-switch blocking + footer Update
  const [sourceDirty, setSourceDirty] = useState(false);
  const [tabBlockMessage, setTabBlockMessage] = useState<string | null>(null);

  // Notify parent of dirty state changes
  const handleDirtyChange = useCallback(
    (dirty: boolean) => {
      setSourceDirty(dirty);
      onSourceDirtyChange?.(dirty);
    },
    [onSourceDirtyChange]
  );

  const handleModeChange = useCallback(
    (value: string) => {
      if (sourceDirty && mode === 'source' && value !== 'source') {
        // Block tab switch while source has unsaved edits
        setTabBlockMessage('Save or cancel your changes first');
        setTimeout(() => setTabBlockMessage(null), 3000);
        return;
      }
      setTabBlockMessage(null);
      setMode(value as ViewMode);
    },
    [sourceDirty, mode]
  );

  // Build source text from MGData (only for program collections)
  const sourceText =
    isProgram && hasMGData ? mgdataToSource(normalizeMGData(doc.MGData)) : '';

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
        <InlineSourceViewer
          source={sourceText}
          darkMode={darkMode ?? false}
          editable={!!onSaveSource}
          onSave={
            onSaveSource
              ? (text: string) => onSaveSource(String(doc._id), text)
              : undefined
          }
          onDirtyChange={handleDirtyChange}
          saveRef={saveRef}
        />
      )}
      {tabBlockMessage && (
        <div
          style={{
            color: palette.yellow.base,
            fontSize: '12px',
            padding: '4px 8px',
            fontStyle: 'italic',
          }}
          data-testid="tab-block-message"
        >
          {tabBlockMessage}
        </div>
      )}
    </div>
  );
}
