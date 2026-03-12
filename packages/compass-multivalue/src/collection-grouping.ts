/**
 * MVCompass: Collection grouping logic for multivalue databases.
 *
 * Groups DICT_X collections with their data counterpart X.
 * Groups multi-level files (X, X_1, X_2, ...) under X.
 * Marks MD as a standalone special collection.
 */

/** Input collection info (matches what Compass sidebar provides) */
export interface CollectionInfo {
  _id: string;
  name: string;
  type: string;
}

/** A grouped collection entry for the sidebar */
export interface GroupedCollection {
  /** Display name for the group */
  name: string;
  /** The primary data collection (null if group has no data, e.g. orphan DICT) */
  dataCollection: CollectionInfo | null;
  /** The DICT collection (null if no DICT exists) */
  dictCollection: CollectionInfo | null;
  /** Multi-level sub-files (e.g., TEMP-MASTER_1, TEMP-MASTER_2) */
  subFiles: CollectionInfo[];
  /** True if this is the MD collection */
  isMD: boolean;
}

const DICT_PREFIX = 'DICT_';

/**
 * Detect whether a database is likely multivalue based on collection names.
 * Simple client-side check: does an 'MD' collection exist?
 *
 * @param collectionNames - Array of collection names in the database
 * @returns true if the database appears to be multivalue
 */
export function isMultivalueDatabase(collectionNames: string[]): boolean {
  return collectionNames.some((name) => name === 'MD' || name === 'md');
}

/**
 * Group collections for the sidebar.
 *
 * Logic:
 * 1. Separate DICT_ collections from data collections
 * 2. For each data collection, find its DICT_ counterpart
 * 3. Group multi-level files (NAME_1, NAME_2, ...) under NAME
 * 4. Mark MD as standalone
 * 5. Orphan DICTs (no matching data collection) shown as standalone groups
 *
 * @param collections - Flat list of collections from the database
 * @returns Grouped collections sorted alphabetically by name
 */
export function groupCollections(
  collections: CollectionInfo[]
): GroupedCollection[] {
  const dictMap = new Map<string, CollectionInfo>();
  const dataCollections: CollectionInfo[] = [];

  // Separate DICT_ from data collections
  for (const coll of collections) {
    if (coll.name.startsWith(DICT_PREFIX)) {
      const dataName = coll.name.slice(DICT_PREFIX.length);
      dictMap.set(dataName, coll);
    } else {
      dataCollections.push(coll);
    }
  }

  // Track which collections are consumed as sub-files
  const consumedAsSubFile = new Set<string>();

  // Detect multi-level files: NAME_1, NAME_2, etc.
  // A collection NAME_N is a sub-file if NAME also exists as a collection
  const dataNames = new Set(dataCollections.map((c) => c.name));
  const subFileMap = new Map<string, CollectionInfo[]>();

  for (const coll of dataCollections) {
    const match = coll.name.match(/^(.+)_(\d+)$/);
    if (match) {
      const baseName = match[1];
      if (dataNames.has(baseName)) {
        if (!subFileMap.has(baseName)) {
          subFileMap.set(baseName, []);
        }
        subFileMap.get(baseName)!.push(coll);
        consumedAsSubFile.add(coll.name);
      }
    }
  }

  // Build groups
  const groups: GroupedCollection[] = [];
  const consumedDicts = new Set<string>();

  for (const coll of dataCollections) {
    if (consumedAsSubFile.has(coll.name)) {
      continue;
    }

    const dict = dictMap.get(coll.name) ?? null;
    if (dict) {
      consumedDicts.add(coll.name);
    }

    const subFiles = subFileMap.get(coll.name) ?? [];
    // Sort sub-files by numeric suffix
    subFiles.sort((a, b) => {
      const aNum = parseInt(a.name.match(/_(\d+)$/)?.[1] ?? '0', 10);
      const bNum = parseInt(b.name.match(/_(\d+)$/)?.[1] ?? '0', 10);
      return aNum - bNum;
    });

    groups.push({
      name: coll.name,
      dataCollection: coll,
      dictCollection: dict,
      subFiles,
      isMD: coll.name === 'MD',
    });
  }

  // Add orphan DICTs (DICT_X exists but X does not)
  for (const [dataName, dictColl] of dictMap) {
    if (!consumedDicts.has(dataName)) {
      groups.push({
        name: dataName,
        dataCollection: null,
        dictCollection: dictColl,
        subFiles: [],
        isMD: false,
      });
    }
  }

  // Sort alphabetically, MD first
  groups.sort((a, b) => {
    if (a.isMD) return -1;
    if (b.isMD) return 1;
    return a.name.localeCompare(b.name);
  });

  return groups;
}

/**
 * Reorder a flat collection list for grouped display.
 *
 * Groups DICT_X immediately after X, sub-files after their parent.
 * MD sorted to top. This produces a flat array compatible with the
 * existing Compass tree-data rendering — no new item types needed.
 *
 * @param collections - Flat list of collections (any shape with `name`)
 * @returns Reordered collection array (same objects, new order)
 */
export function reorderCollectionsForGroupedView<T extends { name: string }>(
  collections: T[]
): T[] {
  const groups = groupCollections(
    collections.map((c) => ({ _id: c.name, name: c.name, type: 'collection' }))
  );

  const byName = new Map<string, T>();
  for (const c of collections) {
    byName.set(c.name, c);
  }

  const result: T[] = [];
  for (const group of groups) {
    // Data collection first
    if (group.dataCollection) {
      const item = byName.get(group.dataCollection.name);
      if (item) result.push(item);
    }
    // DICT immediately after
    if (group.dictCollection) {
      const item = byName.get(group.dictCollection.name);
      if (item) result.push(item);
    }
    // Sub-files
    for (const sub of group.subFiles) {
      const item = byName.get(sub.name);
      if (item) result.push(item);
    }
  }

  return result;
}
