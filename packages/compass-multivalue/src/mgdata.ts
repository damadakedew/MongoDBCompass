/**
 * MGData TypeScript Library
 *
 * Pure formatting utility that parses MongoDB MGData arrays into structured
 * attribute objects for Pick-style display. No I/O, no bridge calls.
 *
 * MGData format:
 *   { _id: "KEY", MGData: ["attr1", ["mv1", "mv2"], "attr3"] }
 *
 * - Plain string = single-value attribute
 * - Array of strings = multi-valued attribute (VM)
 * - Array containing arrays = sub-values within multi-values (SVM)
 * - 0-indexed in MongoDB, displayed 1-indexed in Pick
 */

// ── Types ──────────────────────────────────────────────────────────

/** A single value within a multi-valued attribute */
export interface MVValue {
  /** The string value */
  value: string;

  /** Sub-values if this value contains nested arrays */
  subvalues: string[] | null;
}

/** A single attribute in a multivalue record */
export interface MVAttribute {
  /** 1-based attribute number (for display) */
  number: number;

  /** Raw value from MGData array */
  raw: string | string[] | string[][];

  /** Whether this attribute has multiple values (VM) */
  multivalued: boolean;

  /** Whether any multi-value contains sub-values (SVM) */
  subvalued: boolean;

  /** Formatted display string (VM/SVM separators applied) */
  display: string;

  /** Individual values (for multi-value expansion) */
  values: MVValue[];
}

/** Display configuration */
export interface MVDisplayConfig {
  /** Character to display between multi-values. Default: "]" */
  vmSeparator: string;

  /** Character to display between sub-values. Default: "\\" */
  svmSeparator: string;

  /** Whether to show empty attributes as blank numbered lines. Default: true */
  showEmpty: boolean;

  /** Whether attribute numbers are zero-padded (001 vs 1). Default: true */
  zeroPad: boolean;
}

/** DICT field definition (matches bridge dict.list response) */
export interface DictField {
  item_id: string;
  type: string;
  attribute_number: number;
  header: string;
  conversion: string;
  correlative?: string;
  justification: string;
  width: number;
}

// ── Defaults ───────────────────────────────────────────────────────

export const DEFAULT_CONFIG: MVDisplayConfig = {
  vmSeparator: ']',
  svmSeparator: '\\',
  showEmpty: true,
  zeroPad: true,
};

// ── Core Functions ─────────────────────────────────────────────────

/**
 * Format attribute number for display.
 * zeroPad=true:  1 → "001", 12 → "012", 100 → "100"
 * zeroPad=false: 1 → "1", 12 → "12"
 */
export function formatAttrNumber(num: number, zeroPad: boolean): string {
  if (!zeroPad) return String(num);
  return String(num).padStart(3, '0');
}

/**
 * Format a single MGData element as a display string.
 * Single values returned as-is.
 * Arrays joined with VM separator.
 * Nested arrays: inner joined with SVM separator, outer joined with VM separator.
 */
export function formatValue(
  value: any,
  config: MVDisplayConfig = DEFAULT_CONFIG
): string {
  if (value === null || value === undefined) return '';
  if (!Array.isArray(value)) return String(value);

  const parts = value.map((element: any) => {
    if (Array.isArray(element)) {
      return element.map(String).join(config.svmSeparator);
    }
    return String(element);
  });

  return parts.join(config.vmSeparator);
}

/**
 * Parse multi-values from a single attribute into MVValue objects.
 *
 * @param raw - Raw MGData value
 * @returns Array of MVValue objects (one per value-mark position)
 */
export function parseMultiValues(
  raw: string | string[] | string[][]
): MVValue[] {
  if (typeof raw === 'string') {
    return [{ value: raw, subvalues: null }];
  }

  if (Array.isArray(raw)) {
    return raw.map((val) => {
      if (Array.isArray(val)) {
        return {
          value: val.map(String).join(', '),
          subvalues: val.map(String),
        };
      }
      return { value: String(val), subvalues: null };
    });
  }

  return [{ value: String(raw), subvalues: null }];
}

/**
 * Parse an MGData array into structured attributes.
 *
 * @param mgdata - The MGData array from a MongoDB document
 * @param config - Display configuration (optional, uses defaults)
 * @returns Array of MVAttribute objects, 1-indexed
 */
export function parseMGData(
  mgdata: any[],
  config?: Partial<MVDisplayConfig>
): MVAttribute[] {
  if (!Array.isArray(mgdata)) return [];

  const cfg: MVDisplayConfig = { ...DEFAULT_CONFIG, ...config };
  const attributes: MVAttribute[] = [];

  for (let i = 0; i < mgdata.length; i++) {
    const raw = mgdata[i];
    const number = i + 1;
    const multivalued = Array.isArray(raw);
    const subvalued = multivalued && raw.some((el: any) => Array.isArray(el));
    const display = formatValue(raw, cfg);
    const values = parseMultiValues(raw);

    attributes.push({
      number,
      raw,
      multivalued,
      subvalued,
      display,
      values,
    });
  }

  return attributes;
}

/**
 * Check if a MongoDB document uses the MGData multivalue format.
 *
 * Validates the full document structure: must have _id and MGData fields,
 * MGData must be a non-empty array, and array elements must be strings,
 * arrays of strings, or nested arrays of strings (no plain objects).
 *
 * @param doc - A MongoDB document to check
 * @returns true if the document uses MGData format
 */
export function isMGData(doc: Record<string, unknown>): boolean {
  if (doc == null || typeof doc !== 'object') return false;
  if (!('_id' in doc) || !('MGData' in doc)) return false;
  if (!Array.isArray(doc.MGData)) return false;

  const mgdata = doc.MGData;
  if (mgdata.length === 0) return false;

  for (const element of mgdata) {
    if (element === null || element === undefined) continue;
    if (typeof element === 'string') continue;
    if (Array.isArray(element)) {
      for (const inner of element) {
        if (inner === null || inner === undefined) continue;
        if (typeof inner === 'string') continue;
        if (Array.isArray(inner)) {
          for (const sv of inner) {
            if (sv !== null && sv !== undefined && typeof sv !== 'string') {
              return false;
            }
          }
          continue;
        }
        if (typeof inner === 'object') return false;
      }
      continue;
    }
    if (typeof element === 'object') return false;
  }

  return true;
}
