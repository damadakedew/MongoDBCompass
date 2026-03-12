import React, { useState, useCallback, useRef } from 'react';
import { css, cx } from '@leafygreen-ui/emotion';
import { palette } from '@leafygreen-ui/palette';
import { spacing } from '@leafygreen-ui/tokens';

// ── Types ──────────────────────────────────────────────────────────

export interface ColumnInfo {
  name: string;
  width: number;
  justification: 'L' | 'R' | 'C';
}

export interface ListOutputPanelProps {
  reportText: string;
  columns: ColumnInfo[];
  total: number;
  onClose?: () => void;
}

// ── Styles (always dark — terminal aesthetic) ─────────────────────

const containerStyles = css({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: '200px',
  backgroundColor: palette.black,
  color: palette.gray.light2,
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '13px',
  borderRadius: '4px',
  overflow: 'hidden',
});

const headerStyles = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: `${spacing[100]}px ${spacing[300]}px`,
  backgroundColor: palette.gray.dark4,
  borderBottom: `1px solid ${palette.gray.dark2}`,
  fontSize: '12px',
  fontWeight: 600,
  color: palette.gray.light1,
});

const headerLeftStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
});

const headerButtonsStyles = css({
  display: 'flex',
  gap: spacing[100],
});

const buttonStyles = css({
  background: 'transparent',
  border: `1px solid ${palette.gray.dark2}`,
  color: palette.gray.light1,
  cursor: 'pointer',
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '11px',
  padding: `2px ${spacing[200]}px`,
  borderRadius: '3px',
  ':hover': {
    color: palette.white,
    borderColor: palette.gray.dark1,
  },
});

const closeButtonStyles = css({
  background: 'transparent',
  border: 'none',
  color: palette.gray.light1,
  cursor: 'pointer',
  fontSize: '14px',
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  padding: `${spacing[100]}px`,
  ':hover': {
    color: palette.white,
  },
});

const outputAreaStyles = css({
  flex: 1,
  padding: spacing[300],
  overflowY: 'auto',
  overflowX: 'auto',
  whiteSpace: 'pre',
  lineHeight: '1.4',
});

const statusBarStyles = css({
  padding: `${spacing[100]}px ${spacing[300]}px`,
  backgroundColor: palette.gray.dark4,
  borderTop: `1px solid ${palette.gray.dark2}`,
  fontSize: '11px',
  color: palette.gray.light1,
  display: 'flex',
  justifyContent: 'space-between',
});

const copiedFeedbackStyles = css({
  color: palette.green.base,
  fontSize: '11px',
});

const emptyStyles = css({
  padding: spacing[400],
  textAlign: 'center',
  color: palette.gray.dark1,
  fontStyle: 'italic',
});

// ── Component ──────────────────────────────────────────────────────

export function ListOutputPanel({
  reportText,
  columns,
  total,
  onClose,
}: ListOutputPanelProps) {
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = reportText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [reportText]);

  return (
    <div className={containerStyles} data-testid="list-output-panel">
      {/* Header */}
      <div className={headerStyles}>
        <div className={headerLeftStyles}>
          <span>LIST Output</span>
          {columns.length > 0 && (
            <span style={{ opacity: 0.6 }}>
              ({columns.length} column{columns.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>
        <div className={headerButtonsStyles}>
          {copied && (
            <span className={copiedFeedbackStyles} data-testid="copy-feedback">
              Copied!
            </span>
          )}
          <button
            className={buttonStyles}
            onClick={handleCopy}
            data-testid="copy-button"
          >
            Copy
          </button>
          {onClose && (
            <button
              className={closeButtonStyles}
              onClick={onClose}
              data-testid="close-button"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Output area */}
      <pre
        className={outputAreaStyles}
        ref={outputRef}
        data-testid="report-output"
      >
        {reportText || <span className={emptyStyles}>No items listed.</span>}
      </pre>

      {/* Status bar */}
      <div className={statusBarStyles} data-testid="status-bar">
        <span>
          {total} item{total !== 1 ? 's' : ''} listed
        </span>
        <span>{columns.map((col) => col.name).join(' | ')}</span>
      </div>
    </div>
  );
}
