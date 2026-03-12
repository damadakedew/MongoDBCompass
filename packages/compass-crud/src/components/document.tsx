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

  // MVCompass: render multivalue attribute view for MGData documents
  const rawDoc = useMemo(() => {
    if (typeof _doc?.isRoot === 'function') {
      return (_doc as HadronDocument).generateObject();
    }
    return _doc as Record<string, unknown>;
  }, [_doc]);

  const { dictFields } = useMVCollection(); // MVCompass: DICT data from context
  const onViewSource = useContext(ProgramEditorContext); // MVCompass: program editor

  if (isMGData(rawDoc)) {
    return (
      <DocumentViewToggle
        document={rawDoc as { _id: string; [key: string]: any }}
        dictFields={dictFields}
        onViewSource={
          onViewSource ? () => onViewSource(String(rawDoc._id)) : undefined
        }
      />
    );
  }
  // MVCompass: end multivalue check

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
      />
    );
  }

  return (
    <ReadonlyDocument
      doc={doc}
      copyToClipboard={copyToClipboard}
      onUpdateQuery={onUpdateQuery}
      query={query}
    />
  );
};

export default React.memo(Document);
