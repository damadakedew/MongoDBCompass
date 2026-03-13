import React, {
  useContext,
  useMemo,
  useCallback,
  useState,
  useRef,
} from 'react';
import HadronDocument from 'hadron-document';
import type { EditableDocumentProps } from './editable-document';
import EditableDocument from './editable-document';
import type { ReadonlyDocumentProps } from './readonly-document';
import ReadonlyDocument from './readonly-document';
import type { BSONObject } from '../stores/crud-store';
import {
  isMGData,
  DocumentViewToggle,
  useMVCollection,
  isProgramCollection,
  useBridgeClient,
} from '@mongodb-js/compass-multivalue'; // MVCompass
import { ProgramEditorContext } from './document-list'; // MVCompass

export type DocumentProps = {
  doc: HadronDocument | BSONObject;
  editable: boolean;
  isTimeSeries?: boolean;
  onUpdateQuery?: (field: string, value: unknown) => void;
  query?: BSONObject;
} & Omit<EditableDocumentProps, 'doc' | 'expandAll'> &
  Pick<ReadonlyDocumentProps, 'copyToClipboard' | 'openInsertDocumentDialog'>;

const Document = (props: DocumentProps) => {
  const {
    editable,
    isTimeSeries,
    copyToClipboard,
    openInsertDocumentDialog,
    doc: _doc,
    onUpdateQuery,
    query,
  } = props;

  const doc = useMemo(() => {
    // COMPASS-5872 If _doc is a plain js object rather than an instance of hadron-document Document
    // it may have an isRoot prop, which would cause the isRoot() to throw an error.
    if (typeof _doc?.isRoot === 'function' && _doc?.isRoot()) {
      return _doc as HadronDocument;
    }
    return new HadronDocument(_doc as Record<string, unknown>);
  }, [_doc]);

  // MVCompass: multivalue attribute/source view as body override (not early return)
  const rawDoc = useMemo(() => {
    if (typeof _doc?.isRoot === 'function') {
      return (_doc as HadronDocument).generateObject();
    }
    return _doc as Record<string, unknown>;
  }, [_doc]);

  const {
    dictFields,
    database: mvDatabase,
    collection: mvCollection,
  } = useMVCollection(); // MVCompass
  const onViewSource = useContext(ProgramEditorContext); // MVCompass: program editor
  const bridgeClient = useBridgeClient(); // MVCompass: for program save
  const isProgram = mvCollection ? isProgramCollection(mvCollection) : false;

  // MVCompass: save source callback for program collections (bridge document.write)
  const handleSaveSource = useCallback(
    async (itemId: string, sourceText: string) => {
      if (!bridgeClient || bridgeClient.status !== 'connected') {
        throw new Error('Bridge not connected');
      }
      const lines = sourceText.split('\n');
      await bridgeClient.request('document.write', {
        database: mvDatabase || '',
        collection: mvCollection || '',
        item_id: itemId,
        mgdata: lines,
      });
    },
    [bridgeClient, mvDatabase, mvCollection]
  );

  // MVCompass: dirty state + save ref for program source editor → footer wiring
  const [sourceDirty, setSourceDirty] = useState(false);
  const saveSourceRef = useRef<(() => Promise<void>) | null>(null);

  const handleProgramSave = useCallback(async () => {
    if (saveSourceRef.current) {
      await saveSourceRef.current();
    }
  }, []);

  // Build bodyOverride for MGData documents — passed into stock wrappers
  // so action buttons (edit/copy/clone/delete/expand) remain functional
  const mvBodyOverride = useMemo(() => {
    if (!isMGData(rawDoc)) return undefined;
    return (
      <DocumentViewToggle
        document={rawDoc as { _id: string; [key: string]: any }}
        dictFields={dictFields}
        onViewSource={
          onViewSource ? () => onViewSource(String(rawDoc._id)) : undefined
        }
        onSaveSource={isProgram ? handleSaveSource : undefined}
        onSourceDirtyChange={isProgram ? setSourceDirty : undefined}
        saveRef={isProgram ? saveSourceRef : undefined}
      />
    );
  }, [rawDoc, dictFields, onViewSource, isProgram, handleSaveSource]);
  // MVCompass: end multivalue body override

  if (editable && isTimeSeries) {
    return (
      <ReadonlyDocument
        doc={doc}
        copyToClipboard={copyToClipboard}
        openInsertDocumentDialog={(doc, cloned) => {
          void openInsertDocumentDialog?.(doc, cloned);
        }}
        onUpdateQuery={onUpdateQuery}
        query={query}
        bodyOverride={mvBodyOverride}
      />
    );
  }

  if (editable) {
    return (
      <EditableDocument
        {...props}
        doc={doc}
        onUpdateQuery={onUpdateQuery}
        query={query}
        bodyOverride={mvBodyOverride}
        isProgramCollection={isProgram}
        sourceDirty={sourceDirty}
        onProgramSave={handleProgramSave}
      />
    );
  }

  return (
    <ReadonlyDocument
      doc={doc}
      copyToClipboard={copyToClipboard}
      onUpdateQuery={onUpdateQuery}
      query={query}
      bodyOverride={mvBodyOverride}
    />
  );
};

export default React.memo(Document);
