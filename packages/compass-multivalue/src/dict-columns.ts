/**
 * DICT-Aware Column Configuration
 *
 * Maps DICT field definitions (from the bridge's dict.list response) to
 * table column specs. Handles fallback to raw MGData headers when no DICT
 * exists, sort-type inference from conversion codes, and column ordering.
 */

import type { DictField } from './mgdata';

// ── Types ──────────────────────────────────────────────────────────

/** Sort behavior inferred from DICT conversion codes */
export type SortType = 'string' | 'number' | 'date';

/** Column configuration for the document table view */
export interface DictColumnConfig {
  /** MGData index (0-based) */
  index: number;

  /** Display header from DICT (e.g., "Customer Name") or fallback (e.g., "MGData.0") */
  header: string;

  /** Column width from DICT attr 9. Default: 10 */
  width: number;

  /** Justification from DICT attr 10 (L, R, C). Default: 'L' */
  justification: 'L' | 'R' | 'C';

  /** Conversion code from DICT attr 3 (for sort behavior) */
  conversion: string;

  /** Original DICT item-id (e.g., "CUST.NAME"), or null for fallback columns */
  dictItemId: string | null;

  /** Inferred sort type based on conversion code */
  sortType: SortType;

  /** Whether this column came from a DICT definition or is a fallback */
  fromDict: boolean;
}

// ── Constants ──────────────────────────────────────────────────────

const DEFAULT_WIDTH = 10;
const DEFAULT_JUSTIFICATION: 'L' | 'R' | 'C' = 'L';

// ── Sort Type Inference ────────────────────────────────────────────

/**
 * Infer sort type from a DICT conversion code.
 *
 * - Date codes (D, D2, D4, D2-, D4/, etc.) → 'date'
 * - Numeric codes (MD, MR, ML followed by digits) → 'number'
 * - Right-justified with no conversion → 'number' (Pick convention)
 * - Everything else → 'string'
 */
export function inferSortType(
  conversion: string,
  justification: string
): SortType {
  const code = conversion.trim().toUpperCase();

  if (!code) {
    // No conversion — right-justified fields are typically numeric in Pick
    return justification === 'R' ? 'number' : 'string';
  }

  // Date conversions: D, D2, D4, D2-, D2/, D4-, D4/, DI, etc.
  if (/^D\d?/.test(code)) {
    return 'date';
  }

  // Numeric conversions: MD, MR, ML followed by digits
  if (/^M[DRL]\d/.test(code)) {
    return 'number';
  }

  // MT (time) — numeric internal storage
  if (/^MT/.test(code)) {
    return 'number';
  }

  // MX (hex) — numeric
  if (/^MX/.test(code)) {
    return 'number';
  }

  return 'string';
}

// ── Justification Normalization ────────────────────────────────────

function normalizeJustification(j: string): 'L' | 'R' | 'C' {
  const upper = j.trim().toUpperCase();
  if (upper === 'R') return 'R';
  if (upper === 'C') return 'C';
  return 'L';
}

// ── Core Functions ─────────────────────────────────────────────────

/**
 * Build column configuration from DICT fields.
 *
 * Maps DICT attribute definitions to table column specs, sorted by
 * attribute number. Only includes A-type and S-type fields (data fields).
 *
 * @param dictFields - Array of DICT field definitions from bridge dict.list
 * @returns Column configs sorted by attribute number (ascending)
 */
export function buildColumnConfig(dictFields: DictField[]): DictColumnConfig[] {
  if (!dictFields || dictFields.length === 0) return [];

  return dictFields
    .filter((f) => f.type === 'A' || f.type === 'S')
    .sort((a, b) => a.attribute_number - b.attribute_number)
    .map((field) => {
      const justification = normalizeJustification(field.justification);
      return {
        index: field.attribute_number - 1, // 1-based attr → 0-based MGData index
        header: field.header || field.item_id,
        width: field.width > 0 ? field.width : DEFAULT_WIDTH,
        justification,
        conversion: field.conversion || '',
        dictItemId: field.item_id,
        sortType: inferSortType(field.conversion || '', justification),
        fromDict: true,
      };
    });
}

/**
 * Build fallback column configuration when no DICT exists.
 *
 * Generates columns named "MGData.0", "MGData.1", ... for each attribute
 * present in the document.
 *
 * @param attributeCount - Number of attributes in the MGData array
 * @returns Column configs with generic headers
 */
export function buildFallbackColumns(
  attributeCount: number
): DictColumnConfig[] {
  const columns: DictColumnConfig[] = [];
  for (let i = 0; i < attributeCount; i++) {
    columns.push({
      index: i,
      header: `Attr ${i + 1}`,
      width: DEFAULT_WIDTH,
      justification: DEFAULT_JUSTIFICATION,
      conversion: '',
      dictItemId: null,
      sortType: 'string',
      fromDict: false,
    });
  }
  return columns;
}

/**
 * Build a complete column set for a collection, merging DICT definitions
 * with fallback columns for any attributes not covered by DICT.
 *
 * @param dictFields - DICT field definitions (may be null/empty)
 * @param attributeCount - Total attributes in the document(s)
 * @returns Complete column config covering all attributes
 */
export function buildMergedColumns(
  dictFields: DictField[] | null | undefined,
  attributeCount: number
): DictColumnConfig[] {
  if (!dictFields || dictFields.length === 0) {
    return buildFallbackColumns(attributeCount);
  }

  const dictColumns = buildColumnConfig(dictFields);

  // Build a set of covered 0-based indices
  const covered = new Set(dictColumns.map((c) => c.index));

  // Add fallback columns for any uncovered attributes
  const fallbacks: DictColumnConfig[] = [];
  for (let i = 0; i < attributeCount; i++) {
    if (!covered.has(i)) {
      fallbacks.push({
        index: i,
        header: `Attr ${i + 1}`,
        width: DEFAULT_WIDTH,
        justification: DEFAULT_JUSTIFICATION,
        conversion: '',
        dictItemId: null,
        sortType: 'string',
        fromDict: false,
      });
    }
  }

  // Merge and sort by index
  return [...dictColumns, ...fallbacks].sort((a, b) => a.index - b.index);
}
