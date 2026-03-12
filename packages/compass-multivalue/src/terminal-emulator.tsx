import React, { useState, useCallback, useEffect, useRef } from 'react';
import { css, cx } from '@leafygreen-ui/emotion';
import { palette } from '@leafygreen-ui/palette';
import { spacing } from '@leafygreen-ui/tokens';
import type { BridgeClient } from './bridge-client';

// ── Types ──────────────────────────────────────────────────────────

export interface TerminalEmulatorProps {
  database: string;
  bridgeClient: BridgeClient | null;
  onClose?: () => void;
}

interface OutputLine {
  text: string;
  timestamp: number;
}

// ── Constants ──────────────────────────────────────────────────────

const MAX_OUTPUT_LINES = 1000;
const MAX_HISTORY = 50;

// ── Styles (always dark — terminals don't follow light theme) ─────

const terminalContainerStyles = css({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: '300px',
  backgroundColor: palette.black,
  color: palette.gray.light2,
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '13px',
  borderRadius: '4px',
  overflow: 'hidden',
});

const terminalHeaderStyles = css({
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
  whiteSpace: 'pre',
  lineHeight: '1.4',
  minHeight: '200px',
});

const inputRowStyles = css({
  display: 'flex',
  alignItems: 'center',
  padding: `${spacing[100]}px ${spacing[300]}px`,
  borderTop: `1px solid ${palette.gray.dark2}`,
  backgroundColor: palette.gray.dark4,
});

const promptStyles = css({
  color: palette.green.base,
  fontWeight: 600,
  marginRight: spacing[100],
  flexShrink: 0,
});

const inputStyles = css({
  flex: 1,
  backgroundColor: 'transparent',
  border: 'none',
  outline: 'none',
  color: palette.white,
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '13px',
  caretColor: palette.green.base,
});

const disabledContainerStyles = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  minHeight: '300px',
  backgroundColor: palette.black,
  color: palette.gray.dark1,
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '13px',
  borderRadius: '4px',
});

const errorMessageStyles = css({
  padding: spacing[300],
  color: palette.red.light1,
});

const retryButtonStyles = css({
  background: 'transparent',
  border: `1px solid ${palette.gray.dark2}`,
  color: palette.gray.light1,
  cursor: 'pointer',
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '12px',
  padding: `${spacing[100]}px ${spacing[200]}px`,
  borderRadius: '4px',
  marginLeft: spacing[200],
  ':hover': {
    color: palette.white,
    borderColor: palette.gray.dark1,
  },
});

const statusIndicatorStyles = css({
  display: 'inline-block',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  marginRight: spacing[100],
});

const connectedIndicatorStyles = css({
  backgroundColor: palette.green.base,
});

const disconnectedIndicatorStyles = css({
  backgroundColor: palette.red.light1,
});

// ── Component ──────────────────────────────────────────────────────

export function TerminalEmulator({
  database,
  bridgeClient,
  onClose,
}: TerminalEmulatorProps) {
  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Output state
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const [prompt, setPrompt] = useState('>');

  // Input state
  const [inputValue, setInputValue] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Refs
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const eventUnsubRef = useRef<(() => void) | null>(null);

  const bridgeAvailable =
    bridgeClient !== null && bridgeClient.status === 'connected';

  // ── Auto-scroll ────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [outputLines, scrollToBottom]);

  // ── Append output ──────────────────────────────────────────────

  const appendOutput = useCallback((text: string) => {
    setOutputLines((prev) => {
      const newLines = [...prev, { text, timestamp: Date.now() }];
      if (newLines.length > MAX_OUTPUT_LINES) {
        return newLines.slice(newLines.length - MAX_OUTPUT_LINES);
      }
      return newLines;
    });
  }, []);

  // ── Session lifecycle ──────────────────────────────────────────

  const openSession = useCallback(async () => {
    if (!bridgeAvailable || !bridgeClient) return;

    setIsConnecting(true);
    setSessionError(null);

    try {
      const response = await bridgeClient.request('shell.open', { database });
      const result = response.result as {
        session_id: string;
        prompt: string;
      } | null;
      if (result) {
        setSessionId(result.session_id);
        setPrompt(result.prompt || '>');
        appendOutput(`Connected to ${database}\n`);

        // Subscribe to shell.output events
        const unsub = bridgeClient.onEvent('shell.output', (data, event) => {
          if (event.session_id === result.session_id) {
            if (data.text) {
              appendOutput(data.text as string);
            }
            if (data.prompt) {
              setPrompt(data.prompt as string);
            }
          }
        });
        eventUnsubRef.current = unsub;
      }
    } catch (err: any) {
      setSessionError(err.message || 'Failed to open shell session');
    } finally {
      setIsConnecting(false);
    }
  }, [bridgeAvailable, bridgeClient, database, appendOutput]);

  const closeSession = useCallback(async () => {
    if (eventUnsubRef.current) {
      eventUnsubRef.current();
      eventUnsubRef.current = null;
    }
    if (sessionId && bridgeClient && bridgeClient.status === 'connected') {
      try {
        await bridgeClient.request('shell.close', { session_id: sessionId });
      } catch {
        // Ignore close errors
      }
    }
    setSessionId(null);
  }, [sessionId, bridgeClient]);

  // Open session on mount
  useEffect(() => {
    if (bridgeAvailable) {
      openSession();
    }
    return () => {
      // Close on unmount — fire and forget
      if (eventUnsubRef.current) {
        eventUnsubRef.current();
        eventUnsubRef.current = null;
      }
      // We can't await in cleanup, so we do a best-effort close
      if (sessionId && bridgeClient && bridgeClient.status === 'connected') {
        bridgeClient
          .request('shell.close', { session_id: sessionId })
          .catch(() => {});
      }
    };
  }, [bridgeAvailable]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus input when session opens
  useEffect(() => {
    if (sessionId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [sessionId]);

  // ── Command submission ─────────────────────────────────────────

  const submitCommand = useCallback(
    async (line: string) => {
      if (!sessionId || !bridgeClient || bridgeClient.status !== 'connected')
        return;

      // Echo the command to output
      appendOutput(`${prompt} ${line}\n`);

      // Add to history
      if (line.trim()) {
        setCommandHistory((prev) => {
          const filtered = prev.filter((h) => h !== line);
          const updated = [line, ...filtered];
          return updated.slice(0, MAX_HISTORY);
        });
      }
      setHistoryIndex(-1);

      try {
        await bridgeClient.request('shell.input', {
          session_id: sessionId,
          line,
        });
      } catch (err: any) {
        appendOutput(`Error: ${err.message}\n`);
      }
    },
    [sessionId, bridgeClient, prompt, appendOutput]
  );

  // ── Input handlers ─────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const line = inputValue;
        setInputValue('');
        submitCommand(line);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (commandHistory.length > 0) {
          const newIndex = Math.min(
            historyIndex + 1,
            commandHistory.length - 1
          );
          setHistoryIndex(newIndex);
          setInputValue(commandHistory[newIndex]);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInputValue(commandHistory[newIndex]);
        } else {
          setHistoryIndex(-1);
          setInputValue('');
        }
      }
    },
    [inputValue, commandHistory, historyIndex, submitCommand]
  );

  // ── Render ─────────────────────────────────────────────────────

  if (!bridgeAvailable) {
    return (
      <div
        className={disabledContainerStyles}
        data-testid="terminal-emulator-disabled"
      >
        Connect to D3PyMongo bridge to use TCL shell
      </div>
    );
  }

  return (
    <div className={terminalContainerStyles} data-testid="terminal-emulator">
      {/* Header bar */}
      <div className={terminalHeaderStyles}>
        <span>
          <span
            className={cx(
              statusIndicatorStyles,
              sessionId ? connectedIndicatorStyles : disconnectedIndicatorStyles
            )}
          />
          TCL — {database}
        </span>
        {onClose && (
          <button
            className={closeButtonStyles}
            onClick={() => {
              closeSession();
              onClose();
            }}
            data-testid="terminal-close-button"
          >
            ×
          </button>
        )}
      </div>

      {/* Session error */}
      {sessionError && (
        <div className={errorMessageStyles} data-testid="session-error">
          {sessionError}
          <button
            className={retryButtonStyles}
            onClick={openSession}
            data-testid="retry-button"
          >
            Retry
          </button>
        </div>
      )}

      {/* Connecting state */}
      {isConnecting && (
        <div
          className={errorMessageStyles}
          style={{ color: palette.gray.light1 }}
          data-testid="connecting-indicator"
        >
          Connecting...
        </div>
      )}

      {/* Output area */}
      <div
        className={outputAreaStyles}
        ref={outputRef}
        data-testid="terminal-output"
        onClick={() => inputRef.current?.focus()}
      >
        {outputLines.map((line, i) => (
          <span key={i}>{line.text}</span>
        ))}
      </div>

      {/* Input line */}
      <div className={inputRowStyles}>
        <span className={promptStyles} data-testid="terminal-prompt">
          {prompt}
        </span>
        <input
          ref={inputRef}
          className={inputStyles}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!sessionId || isConnecting}
          autoFocus
          data-testid="terminal-input"
        />
      </div>
    </div>
  );
}
