import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { css, cx } from '@leafygreen-ui/emotion';
import { palette } from '@leafygreen-ui/palette';
import { spacing } from '@leafygreen-ui/tokens';
import { useDarkMode, Icon } from '@mongodb-js/compass-components';
import type { BridgeClient } from './bridge-client';
import type { DictField } from './mgdata';

// ── Types ──────────────────────────────────────────────────────────

export interface DictEditorProps {
  database: string;
  collection: string;
  bridgeClient: BridgeClient | null;
  onClose: () => void;
  onSave?: () => void;
}

interface FormState {
  itemId: string;
  type: 'A' | 'S' | 'D';
  attributeNumber: number;
  header: string;
  conversion: string;
  correlative: string;
  justification: 'L' | 'R' | 'C';
  width: number;
}

interface FormErrors {
  itemId?: string;
  type?: string;
  attributeNumber?: string;
  header?: string;
  width?: string;
}

const EMPTY_FORM: FormState = {
  itemId: '',
  type: 'A',
  attributeNumber: 1,
  header: '',
  conversion: '',
  correlative: '',
  justification: 'L',
  width: 10,
};

// ── Styles ─────────────────────────────────────────────────────────

const editorContainerStyles = css({
  display: 'grid',
  gridTemplateColumns: '30% 70%',
  height: '100%',
  minHeight: '400px',
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '13px',
});

const lightEditorStyles = css({
  backgroundColor: palette.white,
  color: palette.gray.dark3,
});

const darkEditorStyles = css({
  backgroundColor: palette.gray.dark4,
  color: palette.gray.light2,
});

// ── Field list panel ───────────────────────────────────────────────

const fieldListPanelStyles = css({
  display: 'flex',
  flexDirection: 'column',
  borderRight: '1px solid',
  overflow: 'hidden',
});

const lightFieldListPanelStyles = css({
  borderRightColor: palette.gray.light2,
});

const darkFieldListPanelStyles = css({
  borderRightColor: palette.gray.dark2,
});

const fieldListHeaderStyles = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: `${spacing[200]}px ${spacing[300]}px`,
  borderBottom: '1px solid',
  fontWeight: 600,
});

const lightFieldListHeaderStyles = css({
  borderBottomColor: palette.gray.light2,
  backgroundColor: palette.gray.light3,
});

const darkFieldListHeaderStyles = css({
  borderBottomColor: palette.gray.dark2,
  backgroundColor: palette.gray.dark3,
});

const fieldListScrollStyles = css({
  flex: 1,
  overflowY: 'auto',
});

const fieldItemStyles = css({
  padding: `${spacing[100]}px ${spacing[300]}px`,
  cursor: 'pointer',
  borderBottom: '1px solid',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

const lightFieldItemStyles = css({
  borderBottomColor: palette.gray.light2,
  ':hover': {
    backgroundColor: palette.gray.light3,
  },
});

const darkFieldItemStyles = css({
  borderBottomColor: palette.gray.dark2,
  ':hover': {
    backgroundColor: palette.gray.dark3,
  },
});

const selectedFieldItemStyles = css({});

const lightSelectedFieldItemStyles = css({
  backgroundColor: palette.blue.light3,
  ':hover': {
    backgroundColor: palette.blue.light3,
  },
});

const darkSelectedFieldItemStyles = css({
  backgroundColor: palette.blue.dark3,
  ':hover': {
    backgroundColor: palette.blue.dark3,
  },
});

const fieldItemIdStyles = css({
  fontWeight: 600,
});

const fieldItemMetaStyles = css({
  fontSize: '11px',
  opacity: 0.7,
});

// ── Detail form panel ──────────────────────────────────────────────

const detailPanelStyles = css({
  display: 'flex',
  flexDirection: 'column',
  padding: spacing[400],
  overflowY: 'auto',
  gap: spacing[300],
});

const formTitleStyles = css({
  fontSize: '16px',
  fontWeight: 600,
  marginBottom: spacing[200],
});

const formRowStyles = css({
  display: 'grid',
  gridTemplateColumns: '120px 1fr',
  alignItems: 'center',
  gap: spacing[200],
});

const formLabelStyles = css({
  fontSize: '12px',
  fontWeight: 600,
  textAlign: 'right',
});

const formInputStyles = css({
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '13px',
  padding: `${spacing[100]}px ${spacing[200]}px`,
  borderRadius: '4px',
  border: '1px solid',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
  ':focus': {
    borderWidth: '2px',
    padding: `${spacing[100] - 1}px ${spacing[200] - 1}px`,
  },
});

const lightFormInputStyles = css({
  backgroundColor: palette.white,
  color: palette.gray.dark3,
  borderColor: palette.gray.light1,
  ':focus': {
    borderColor: palette.blue.base,
  },
});

const darkFormInputStyles = css({
  backgroundColor: palette.gray.dark4,
  color: palette.gray.light2,
  borderColor: palette.gray.dark2,
  ':focus': {
    borderColor: palette.blue.light1,
  },
});

const formSelectStyles = css({
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '13px',
  padding: `${spacing[100]}px ${spacing[200]}px`,
  borderRadius: '4px',
  border: '1px solid',
  outline: 'none',
  cursor: 'pointer',
});

const lightFormSelectStyles = css({
  backgroundColor: palette.white,
  color: palette.gray.dark3,
  borderColor: palette.gray.light1,
});

const darkFormSelectStyles = css({
  backgroundColor: palette.gray.dark4,
  color: palette.gray.light2,
  borderColor: palette.gray.dark2,
});

const formErrorStyles = css({
  fontSize: '11px',
  marginTop: '2px',
});

const lightFormErrorStyles = css({
  color: palette.red.base,
});

const darkFormErrorStyles = css({
  color: palette.red.light1,
});

const buttonRowStyles = css({
  display: 'flex',
  gap: spacing[200],
  marginTop: spacing[300],
});

const buttonBaseStyles = css({
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
  fontSize: '13px',
  fontWeight: 600,
  padding: `${spacing[100]}px ${spacing[300]}px`,
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
});

const saveButtonStyles = css({});

const lightSaveButtonStyles = css({
  backgroundColor: palette.green.dark1,
  color: palette.white,
  ':hover': { backgroundColor: palette.green.dark2 },
});

const darkSaveButtonStyles = css({
  backgroundColor: palette.green.base,
  color: palette.black,
  ':hover': { backgroundColor: palette.green.light1 },
});

const cancelButtonStyles = css({
  border: '1px solid',
  background: 'transparent',
});

const lightCancelButtonStyles = css({
  borderColor: palette.gray.light1,
  color: palette.gray.dark1,
  ':hover': { backgroundColor: palette.gray.light3 },
});

const darkCancelButtonStyles = css({
  borderColor: palette.gray.dark2,
  color: palette.gray.light1,
  ':hover': { backgroundColor: palette.gray.dark3 },
});

const deleteButtonStyles = css({});

const lightDeleteButtonStyles = css({
  backgroundColor: palette.red.base,
  color: palette.white,
  ':hover': { backgroundColor: palette.red.dark2 },
});

const darkDeleteButtonStyles = css({
  backgroundColor: palette.red.light1,
  color: palette.black,
  ':hover': { backgroundColor: palette.red.base },
});

const newFieldButtonStyles = css({
  fontSize: '12px',
  padding: `${spacing[100]}px ${spacing[200]}px`,
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
});

const lightNewFieldButtonStyles = css({
  backgroundColor: palette.blue.base,
  color: palette.white,
  ':hover': { backgroundColor: palette.blue.dark1 },
});

const darkNewFieldButtonStyles = css({
  backgroundColor: palette.blue.light1,
  color: palette.black,
  ':hover': { backgroundColor: palette.blue.base },
});

const previewSectionStyles = css({
  padding: spacing[300],
  borderRadius: '4px',
  border: '1px solid',
  marginTop: spacing[200],
});

const lightPreviewSectionStyles = css({
  borderColor: palette.gray.light2,
  backgroundColor: palette.gray.light3,
});

const darkPreviewSectionStyles = css({
  borderColor: palette.gray.dark2,
  backgroundColor: palette.gray.dark3,
});

const previewTitleStyles = css({
  fontSize: '12px',
  fontWeight: 600,
  marginBottom: spacing[200],
});

const previewResultStyles = css({
  fontSize: '13px',
  fontFamily: '"Source Code Pro", Menlo, Monaco, Consolas, monospace',
});

const warningBannerStyles = css({
  fontSize: '12px',
  padding: `${spacing[100]}px ${spacing[200]}px`,
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  gap: spacing[100],
});

const lightWarningBannerStyles = css({
  backgroundColor: palette.yellow.light3,
  color: palette.yellow.dark2,
  border: `1px solid ${palette.yellow.base}`,
});

const darkWarningBannerStyles = css({
  backgroundColor: palette.yellow.dark3,
  color: palette.yellow.light2,
  border: `1px solid ${palette.yellow.dark2}`,
});

const successBannerStyles = css({
  fontSize: '12px',
  padding: `${spacing[100]}px ${spacing[200]}px`,
  borderRadius: '4px',
});

const lightSuccessBannerStyles = css({
  backgroundColor: palette.green.light3,
  color: palette.green.dark2,
  border: `1px solid ${palette.green.base}`,
});

const darkSuccessBannerStyles = css({
  backgroundColor: palette.green.dark3,
  color: palette.green.light2,
  border: `1px solid ${palette.green.dark2}`,
});

const errorBannerStyles = css({
  fontSize: '12px',
  padding: `${spacing[100]}px ${spacing[200]}px`,
  borderRadius: '4px',
});

const lightErrorBannerStyles = css({
  backgroundColor: palette.red.light3,
  color: palette.red.dark2,
  border: `1px solid ${palette.red.base}`,
});

const darkErrorBannerStyles = css({
  backgroundColor: palette.red.dark3,
  color: palette.red.light2,
  border: `1px solid ${palette.red.dark2}`,
});

const loadingStyles = css({
  padding: spacing[400],
  textAlign: 'center',
  opacity: 0.7,
});

const confirmDialogStyles = css({
  position: 'fixed' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  backgroundColor: 'rgba(0,0,0,0.5)',
});

const confirmBoxStyles = css({
  padding: spacing[400],
  borderRadius: '8px',
  minWidth: '300px',
  textAlign: 'center',
});

const lightConfirmBoxStyles = css({
  backgroundColor: palette.white,
  border: `1px solid ${palette.gray.light2}`,
  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
});

const darkConfirmBoxStyles = css({
  backgroundColor: palette.gray.dark3,
  border: `1px solid ${palette.gray.dark2}`,
  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
});

const DEBOUNCE_MS = 500;

// ── Component ──────────────────────────────────────────────────────

export function DictEditor({
  database,
  collection,
  bridgeClient,
  onClose,
  onSave,
}: DictEditorProps) {
  const darkMode = useDarkMode();

  // Field list state
  const [fields, setFields] = useState<DictField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isNewField, setIsNewField] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Conversion preview
  const [previewInput, setPreviewInput] = useState('');
  const [previewOutput, setPreviewOutput] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bridgeAvailable =
    bridgeClient !== null && bridgeClient.status === 'connected';

  // Attribute number conflict check
  const attrConflict = useMemo(() => {
    if (!form.attributeNumber || form.type === 'D') return null;
    const conflict = fields.find(
      (f) =>
        f.attribute_number === form.attributeNumber &&
        f.item_id !== (isNewField ? '' : selectedItemId) &&
        (f.type === 'A' || f.type === 'S')
    );
    return conflict ? conflict.item_id : null;
  }, [form.attributeNumber, form.type, fields, selectedItemId, isNewField]);

  // ── Load fields ────────────────────────────────────────────────

  const loadFields = useCallback(async () => {
    if (!bridgeAvailable || !bridgeClient) {
      setListError('Bridge not connected');
      return;
    }
    setIsLoading(true);
    setListError(null);
    try {
      const response = await bridgeClient.request('dict.list', {
        database,
        collection,
      });
      const result = response.result as { fields?: DictField[] } | null;
      setFields(result?.fields ?? []);
    } catch (err: any) {
      setListError(err.message || 'Failed to load DICT fields');
    } finally {
      setIsLoading(false);
    }
  }, [bridgeAvailable, bridgeClient, database, collection]);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  // ── Field selection ────────────────────────────────────────────

  const selectField = useCallback((field: DictField) => {
    setSelectedItemId(field.item_id);
    setIsNewField(false);
    setForm({
      itemId: field.item_id,
      type: field.type as 'A' | 'S' | 'D',
      attributeNumber: field.attribute_number,
      header: field.header,
      conversion: field.conversion || '',
      correlative: field.correlative || '',
      justification: (field.justification || 'L') as 'L' | 'R' | 'C',
      width: field.width || 10,
    });
    setFormErrors({});
    setSaveMessage(null);
    setSaveError(null);
    setPreviewInput('');
    setPreviewOutput(null);
    setPreviewError(null);
  }, []);

  const handleNewField = useCallback(() => {
    setSelectedItemId(null);
    setIsNewField(true);
    setForm({ ...EMPTY_FORM });
    setFormErrors({});
    setSaveMessage(null);
    setSaveError(null);
    setPreviewInput('');
    setPreviewOutput(null);
    setPreviewError(null);
  }, []);

  // ── Form handlers ──────────────────────────────────────────────

  const updateForm = useCallback(
    (key: keyof FormState, value: string | number) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setFormErrors((prev) => ({ ...prev, [key]: undefined }));
      setSaveMessage(null);
      setSaveError(null);
    },
    []
  );

  // ── Validation ─────────────────────────────────────────────────

  const validateForm = useCallback((): FormErrors => {
    const errors: FormErrors = {};
    if (!form.itemId.trim()) {
      errors.itemId = 'Item ID is required';
    } else if (/\s/.test(form.itemId)) {
      errors.itemId = 'Item ID cannot contain spaces';
    }
    if (!form.header.trim()) {
      errors.header = 'Header is required';
    }
    if (form.type !== 'D') {
      if (
        !form.attributeNumber ||
        form.attributeNumber < 1 ||
        form.attributeNumber > 999
      ) {
        errors.attributeNumber = 'Attribute # must be 1-999';
      }
    }
    if (form.width < 1 || form.width > 999) {
      errors.width = 'Width must be 1-999';
    }
    return errors;
  }, [form]);

  // ── Save ───────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    if (!bridgeAvailable || !bridgeClient) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      await bridgeClient.request('dict.save', {
        database,
        collection,
        item_id: form.itemId.toUpperCase(),
        definition: {
          type: form.type,
          attribute_number: form.attributeNumber,
          header: form.header,
          conversion: form.conversion,
          correlative: form.correlative,
          justification: form.justification,
          width: form.width,
        },
      });
      setSaveMessage(`Saved ${form.itemId.toUpperCase()}`);
      setIsNewField(false);
      setSelectedItemId(form.itemId.toUpperCase());
      onSave?.();
      await loadFields();
    } catch (err: any) {
      setSaveError(err.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [
    validateForm,
    bridgeAvailable,
    bridgeClient,
    database,
    collection,
    form,
    onSave,
    loadFields,
  ]);

  // ── Delete ─────────────────────────────────────────────────────

  const handleDeleteConfirm = useCallback(async () => {
    const itemId = confirmDelete;
    if (!itemId || !bridgeAvailable || !bridgeClient) return;
    setConfirmDelete(null);

    try {
      await bridgeClient.request('dict.delete', {
        database,
        collection,
        item_id: itemId,
      });
      setSelectedItemId(null);
      setForm({ ...EMPTY_FORM });
      setIsNewField(false);
      setSaveMessage(`Deleted ${itemId}`);
      onSave?.();
      await loadFields();
    } catch (err: any) {
      setSaveError(err.message || 'Delete failed');
    }
  }, [
    confirmDelete,
    bridgeAvailable,
    bridgeClient,
    database,
    collection,
    onSave,
    loadFields,
  ]);

  // ── Conversion preview ─────────────────────────────────────────

  const runPreview = useCallback(
    async (value: string, code: string) => {
      if (!bridgeAvailable || !bridgeClient || !code.trim() || !value.trim()) {
        setPreviewOutput(null);
        setPreviewError(null);
        return;
      }
      setIsPreviewLoading(true);
      setPreviewError(null);
      try {
        const response = await bridgeClient.request('convert.oconv', {
          value,
          code,
        });
        const result = response.result as { output?: string } | null;
        setPreviewOutput(result?.output ?? null);
      } catch (err: any) {
        setPreviewError('Conversion preview unavailable');
        setPreviewOutput(null);
      } finally {
        setIsPreviewLoading(false);
      }
    },
    [bridgeAvailable, bridgeClient]
  );

  const handlePreviewInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setPreviewInput(value);
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewTimerRef.current = setTimeout(() => {
        runPreview(value, form.conversion);
      }, DEBOUNCE_MS);
    },
    [form.conversion, runPreview]
  );

  // Re-run preview when conversion code changes
  useEffect(() => {
    if (previewInput.trim() && form.conversion.trim()) {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewTimerRef.current = setTimeout(() => {
        runPreview(previewInput, form.conversion);
      }, DEBOUNCE_MS);
    } else {
      setPreviewOutput(null);
      setPreviewError(null);
    }
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [form.conversion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div
      className={cx(
        editorContainerStyles,
        darkMode ? darkEditorStyles : lightEditorStyles
      )}
      data-testid="dict-editor"
    >
      {/* Field list panel */}
      <div
        className={cx(
          fieldListPanelStyles,
          darkMode ? darkFieldListPanelStyles : lightFieldListPanelStyles
        )}
      >
        <div
          className={cx(
            fieldListHeaderStyles,
            darkMode ? darkFieldListHeaderStyles : lightFieldListHeaderStyles
          )}
        >
          <span>DICT</span>
          <button
            className={cx(
              newFieldButtonStyles,
              darkMode ? darkNewFieldButtonStyles : lightNewFieldButtonStyles
            )}
            onClick={handleNewField}
            data-testid="new-field-button"
          >
            + New
          </button>
        </div>

        <div className={fieldListScrollStyles} data-testid="field-list">
          {isLoading && (
            <div className={loadingStyles} data-testid="field-list-loading">
              Loading...
            </div>
          )}
          {listError && (
            <div
              className={cx(
                errorBannerStyles,
                darkMode ? darkErrorBannerStyles : lightErrorBannerStyles
              )}
              style={{ margin: spacing[200] }}
              data-testid="field-list-error"
            >
              {listError}
            </div>
          )}
          {!isLoading && !listError && fields.length === 0 && (
            <div className={loadingStyles} data-testid="field-list-empty">
              No DICT fields defined
            </div>
          )}
          {fields.map((field) => (
            <div
              key={field.item_id}
              className={cx(
                fieldItemStyles,
                darkMode ? darkFieldItemStyles : lightFieldItemStyles,
                selectedItemId === field.item_id && selectedFieldItemStyles,
                selectedItemId === field.item_id &&
                  (darkMode
                    ? darkSelectedFieldItemStyles
                    : lightSelectedFieldItemStyles)
              )}
              onClick={() => selectField(field)}
              data-testid={`field-item-${field.item_id}`}
            >
              <span className={fieldItemIdStyles}>{field.item_id}</span>
              <span className={fieldItemMetaStyles}>
                #{field.attribute_number} · {field.header}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail form panel */}
      <div className={detailPanelStyles} data-testid="detail-panel">
        {!selectedItemId && !isNewField ? (
          <div className={loadingStyles}>
            Select a field or click "New" to begin editing
          </div>
        ) : (
          <>
            <div className={formTitleStyles}>
              {isNewField ? 'New Field' : `Field: ${selectedItemId}`}
            </div>

            {/* Item ID */}
            <div className={formRowStyles}>
              <label className={formLabelStyles}>Item ID:</label>
              <div>
                <input
                  className={cx(
                    formInputStyles,
                    darkMode ? darkFormInputStyles : lightFormInputStyles
                  )}
                  value={form.itemId}
                  onChange={(e) =>
                    updateForm('itemId', e.target.value.toUpperCase())
                  }
                  disabled={!isNewField}
                  data-testid="form-item-id"
                />
                {formErrors.itemId && (
                  <div
                    className={cx(
                      formErrorStyles,
                      darkMode ? darkFormErrorStyles : lightFormErrorStyles
                    )}
                  >
                    {formErrors.itemId}
                  </div>
                )}
              </div>
            </div>

            {/* Type */}
            <div className={formRowStyles}>
              <label className={formLabelStyles}>Type:</label>
              <select
                className={cx(
                  formSelectStyles,
                  darkMode ? darkFormSelectStyles : lightFormSelectStyles
                )}
                value={form.type}
                onChange={(e) => updateForm('type', e.target.value)}
                data-testid="form-type"
              >
                <option value="A">A (data)</option>
                <option value="S">S (synonym)</option>
                <option value="D">D (define)</option>
              </select>
            </div>

            {/* Attribute # */}
            <div className={formRowStyles}>
              <label className={formLabelStyles}>Attribute #:</label>
              <div>
                <input
                  type="number"
                  className={cx(
                    formInputStyles,
                    darkMode ? darkFormInputStyles : lightFormInputStyles
                  )}
                  value={form.attributeNumber}
                  onChange={(e) =>
                    updateForm('attributeNumber', parseInt(e.target.value) || 0)
                  }
                  min={1}
                  max={999}
                  data-testid="form-attr-number"
                />
                {formErrors.attributeNumber && (
                  <div
                    className={cx(
                      formErrorStyles,
                      darkMode ? darkFormErrorStyles : lightFormErrorStyles
                    )}
                  >
                    {formErrors.attributeNumber}
                  </div>
                )}
                {attrConflict && (
                  <div
                    className={cx(
                      warningBannerStyles,
                      darkMode
                        ? darkWarningBannerStyles
                        : lightWarningBannerStyles
                    )}
                    style={{ marginTop: '4px' }}
                    data-testid="attr-conflict-warning"
                  >
                    <Icon glyph="Warning" size="small" />
                    Attribute #{form.attributeNumber} also used by{' '}
                    {attrConflict}
                  </div>
                )}
              </div>
            </div>

            {/* Header */}
            <div className={formRowStyles}>
              <label className={formLabelStyles}>Header:</label>
              <div>
                <input
                  className={cx(
                    formInputStyles,
                    darkMode ? darkFormInputStyles : lightFormInputStyles
                  )}
                  value={form.header}
                  onChange={(e) => updateForm('header', e.target.value)}
                  data-testid="form-header"
                />
                {formErrors.header && (
                  <div
                    className={cx(
                      formErrorStyles,
                      darkMode ? darkFormErrorStyles : lightFormErrorStyles
                    )}
                  >
                    {formErrors.header}
                  </div>
                )}
              </div>
            </div>

            {/* Conversion */}
            <div className={formRowStyles}>
              <label className={formLabelStyles}>Conversion:</label>
              <input
                className={cx(
                  formInputStyles,
                  darkMode ? darkFormInputStyles : lightFormInputStyles
                )}
                value={form.conversion}
                onChange={(e) => updateForm('conversion', e.target.value)}
                placeholder="e.g., D4-, MCU, MD2"
                data-testid="form-conversion"
              />
            </div>

            {/* Correlative */}
            <div className={formRowStyles}>
              <label className={formLabelStyles}>Correlative:</label>
              <input
                className={cx(
                  formInputStyles,
                  darkMode ? darkFormInputStyles : lightFormInputStyles
                )}
                value={form.correlative}
                onChange={(e) => updateForm('correlative', e.target.value)}
                data-testid="form-correlative"
              />
            </div>

            {/* Justification */}
            <div className={formRowStyles}>
              <label className={formLabelStyles}>Justification:</label>
              <select
                className={cx(
                  formSelectStyles,
                  darkMode ? darkFormSelectStyles : lightFormSelectStyles
                )}
                value={form.justification}
                onChange={(e) => updateForm('justification', e.target.value)}
                data-testid="form-justification"
              >
                <option value="L">L (left)</option>
                <option value="R">R (right)</option>
                <option value="C">C (center)</option>
              </select>
            </div>

            {/* Width */}
            <div className={formRowStyles}>
              <label className={formLabelStyles}>Width:</label>
              <div>
                <input
                  type="number"
                  className={cx(
                    formInputStyles,
                    darkMode ? darkFormInputStyles : lightFormInputStyles
                  )}
                  value={form.width}
                  onChange={(e) =>
                    updateForm('width', parseInt(e.target.value) || 0)
                  }
                  min={1}
                  max={999}
                  data-testid="form-width"
                />
                {formErrors.width && (
                  <div
                    className={cx(
                      formErrorStyles,
                      darkMode ? darkFormErrorStyles : lightFormErrorStyles
                    )}
                  >
                    {formErrors.width}
                  </div>
                )}
              </div>
            </div>

            {/* Conversion preview */}
            {form.conversion.trim() && (
              <div
                className={cx(
                  previewSectionStyles,
                  darkMode
                    ? darkPreviewSectionStyles
                    : lightPreviewSectionStyles
                )}
                data-testid="conversion-preview"
              >
                <div className={previewTitleStyles}>Conversion Preview</div>
                <div className={formRowStyles}>
                  <label className={formLabelStyles}>Sample:</label>
                  <input
                    className={cx(
                      formInputStyles,
                      darkMode ? darkFormInputStyles : lightFormInputStyles
                    )}
                    value={previewInput}
                    onChange={handlePreviewInputChange}
                    placeholder="Enter sample value..."
                    data-testid="preview-input"
                  />
                </div>
                {isPreviewLoading && (
                  <div
                    className={previewResultStyles}
                    data-testid="preview-loading"
                  >
                    Converting...
                  </div>
                )}
                {previewOutput !== null && (
                  <div
                    className={previewResultStyles}
                    data-testid="preview-result"
                  >
                    "{previewInput}" → "{previewOutput}" (code:{' '}
                    {form.conversion})
                  </div>
                )}
                {previewError && (
                  <div
                    className={cx(
                      formErrorStyles,
                      darkMode ? darkFormErrorStyles : lightFormErrorStyles
                    )}
                    data-testid="preview-error"
                  >
                    {previewError}
                  </div>
                )}
              </div>
            )}

            {/* Status messages */}
            {saveMessage && (
              <div
                className={cx(
                  successBannerStyles,
                  darkMode ? darkSuccessBannerStyles : lightSuccessBannerStyles
                )}
                data-testid="save-success"
              >
                {saveMessage}
              </div>
            )}
            {saveError && (
              <div
                className={cx(
                  errorBannerStyles,
                  darkMode ? darkErrorBannerStyles : lightErrorBannerStyles
                )}
                data-testid="save-error"
              >
                {saveError}
              </div>
            )}

            {/* Action buttons */}
            <div className={buttonRowStyles}>
              <button
                className={cx(
                  buttonBaseStyles,
                  saveButtonStyles,
                  darkMode ? darkSaveButtonStyles : lightSaveButtonStyles
                )}
                onClick={handleSave}
                disabled={isSaving || !bridgeAvailable}
                data-testid="save-button"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                className={cx(
                  buttonBaseStyles,
                  cancelButtonStyles,
                  darkMode ? darkCancelButtonStyles : lightCancelButtonStyles
                )}
                onClick={onClose}
                data-testid="cancel-button"
              >
                Cancel
              </button>
              {form.conversion.trim() && bridgeAvailable && (
                <button
                  className={cx(
                    buttonBaseStyles,
                    cancelButtonStyles,
                    darkMode ? darkCancelButtonStyles : lightCancelButtonStyles
                  )}
                  onClick={() => runPreview(previewInput, form.conversion)}
                  disabled={!previewInput.trim()}
                  data-testid="test-conversion-button"
                >
                  Test Conversion
                </button>
              )}
              {!isNewField && selectedItemId && (
                <button
                  className={cx(
                    buttonBaseStyles,
                    deleteButtonStyles,
                    darkMode ? darkDeleteButtonStyles : lightDeleteButtonStyles
                  )}
                  onClick={() => setConfirmDelete(selectedItemId)}
                  data-testid="delete-button"
                >
                  Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div
          className={confirmDialogStyles}
          data-testid="confirm-delete-dialog"
        >
          <div
            className={cx(
              confirmBoxStyles,
              darkMode ? darkConfirmBoxStyles : lightConfirmBoxStyles
            )}
          >
            <p style={{ marginBottom: spacing[300] }}>
              Delete field <strong>{confirmDelete}</strong>?
            </p>
            <div
              className={buttonRowStyles}
              style={{ justifyContent: 'center' }}
            >
              <button
                className={cx(
                  buttonBaseStyles,
                  deleteButtonStyles,
                  darkMode ? darkDeleteButtonStyles : lightDeleteButtonStyles
                )}
                onClick={handleDeleteConfirm}
                data-testid="confirm-delete-yes"
              >
                Delete
              </button>
              <button
                className={cx(
                  buttonBaseStyles,
                  cancelButtonStyles,
                  darkMode ? darkCancelButtonStyles : lightCancelButtonStyles
                )}
                onClick={() => setConfirmDelete(null)}
                data-testid="confirm-delete-no"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
