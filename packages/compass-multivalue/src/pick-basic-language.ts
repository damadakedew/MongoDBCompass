// MVCompass: Pick Basic language definition for CodeMirror 6
//
// Provides syntax highlighting for Pick/D3 Basic source code.
// Uses StreamLanguage (simple tokenizer) — not a full parser.

import { StreamLanguage } from '@codemirror/language';

// ── Keywords ──────────────────────────────────────────────────────

const KEYWORDS = new Set([
  'IF',
  'THEN',
  'ELSE',
  'END',
  'FOR',
  'NEXT',
  'TO',
  'STEP',
  'WHILE',
  'UNTIL',
  'LOOP',
  'REPEAT',
  'DO',
  'GOSUB',
  'RETURN',
  'GO',
  'GOTO',
  'CALL',
  'SUBROUTINE',
  'FUNCTION',
  'DEFFUN',
  'OPEN',
  'READ',
  'WRITE',
  'DELETE',
  'READU',
  'WRITEU',
  'READV',
  'WRITEV',
  'READVU',
  'WRITEVU',
  'MATREAD',
  'MATWRITE',
  'RELEASE',
  'PRINT',
  'CRT',
  'INPUT',
  'PROMPT',
  'DATA',
  'BEGIN',
  'CASE',
  'EXECUTE',
  'CHAIN',
  'ENTER',
  'STOP',
  'ABORT',
  'DEBUG',
  'LOCATE',
  'FIND',
  'FINDSTR',
  'EQUATE',
  'EQU',
  'COMMON',
  'DIM',
  'DIMENSION',
  'ON',
  'OFF',
  'PRECISION',
  'CLEARFILE',
  'CLOSE',
  'MAT',
  'CONVERT',
  'SWAP',
  'LOCK',
  'UNLOCK',
  'SLEEP',
  'NAP',
  'RQM',
  'CAPTURING',
  'RETURNING',
  'SETTING',
  'PASSLIST',
  'RTNLIST',
  'AND',
  'OR',
  'NOT',
  'CAT',
  'CHAR',
  'LEN',
  'TRIM',
  'TRIMF',
  'TRIMB',
  'STR',
  'SPACE',
  'INDEX',
  'COUNT',
  'DCOUNT',
  'MOD',
  'REM',
  'INT',
  'ABS',
  'PWR',
  'SQRT',
  'EXP',
  'LN',
  'SIN',
  'COS',
  'TAN',
  'ASIN',
  'ACOS',
  'ATAN',
  'NUM',
  'ALPHA',
  'ICONV',
  'OCONV',
  'DATE',
  'TIME',
  'TIMEDATE',
  'SYSTEM',
  'INSERT',
  'EXTRACT',
  'REPLACE',
  'FIELD',
  'FIELDS',
  'SEQ',
  'CHAR',
  'UPCASE',
  'DOWNCASE',
  'ASSIGNED',
  'UNASSIGNED',
  'READNEXT',
  'SELECT',
  'CLEARSELECT',
  'PRINTER',
  'PAGE',
  'HEADING',
  'FOOTING',
  'INCLUDE',
  '$INCLUDE',
]);

// ── Tokenizer State ───────────────────────────────────────────────

interface PickBasicState {
  /** True when we're at the very start of a line */
  lineStart: boolean;
}

// ── StreamParser ──────────────────────────────────────────────────

const pickBasicStreamParser = {
  name: 'pick-basic',

  startState(): PickBasicState {
    return { lineStart: true };
  },

  token(stream: any, state: PickBasicState): string | null {
    // Beginning of line checks
    if (stream.sol()) {
      state.lineStart = true;
    }

    // Skip whitespace
    if (stream.eatSpace()) {
      return null;
    }

    // Full-line comments: lines starting with * or !
    if (state.lineStart && (stream.peek() === '*' || stream.peek() === '!')) {
      stream.skipToEnd();
      state.lineStart = false;
      return 'comment';
    }

    state.lineStart = false;

    // Inline comment after ;* or ;!
    if (stream.match(/^;[*!]/)) {
      stream.skipToEnd();
      return 'comment';
    }

    // REM as full-line comment keyword
    if (stream.match(/^REM\b/i)) {
      // Check if this is the REM statement (comment) vs REM() function
      if (!stream.match(/^\s*\(/, false)) {
        stream.skipToEnd();
        return 'comment';
      }
      return 'keyword';
    }

    // String literals — single quoted
    if (stream.peek() === "'") {
      stream.next();
      while (!stream.eol()) {
        if (stream.next() === "'") break;
      }
      return 'string';
    }

    // String literals — double quoted
    if (stream.peek() === '"') {
      stream.next();
      while (!stream.eol()) {
        if (stream.next() === '"') break;
      }
      return 'string';
    }

    // String literals — backslash delimited (Pick convention)
    if (stream.peek() === '\\') {
      stream.next();
      while (!stream.eol()) {
        if (stream.next() === '\\') break;
      }
      return 'string';
    }

    // Numbers
    if (stream.match(/^-?\d+\.?\d*/)) {
      return 'number';
    }

    // Operators
    if (stream.match(/^[<>]=?|^[=#+\-*\/&|:]/)) {
      return 'operator';
    }

    // Labels — identifier followed by : at start-ish of line
    // (simplified: any IDENT: pattern)
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_.]*:/)) {
      return 'labelName';
    }

    // Identifiers and keywords
    if (stream.match(/^[A-Za-z_$@][A-Za-z0-9_.$]*/)) {
      const word = stream.current().toUpperCase();
      if (KEYWORDS.has(word)) {
        return 'keyword';
      }
      // @ system variables
      if (word.startsWith('@')) {
        return 'variableName.special';
      }
      return 'variableName';
    }

    // Angle brackets (dynamic array access)
    if (stream.match(/^[<>]/)) {
      return 'bracket';
    }

    // Parentheses, semicolons, commas
    if (stream.match(/^[();,]/)) {
      return 'punctuation';
    }

    // Skip unknown character
    stream.next();
    return null;
  },

  blankLine(state: PickBasicState): void {
    state.lineStart = true;
  },
};

/** CodeMirror 6 language support for Pick Basic */
export const pickBasicLanguage = StreamLanguage.define(pickBasicStreamParser);
