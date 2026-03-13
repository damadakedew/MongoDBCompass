import React, { useContext, useMemo } from 'react';
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

  const { dictFields } = useMVCollection(); // MVCompass: DICT data from context
  const onViewSource = useContext(ProgramEditorContext); // MVCompass: program editor

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
      />
    );
  }, [rawDoc, dictFields, onViewSource]);
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
