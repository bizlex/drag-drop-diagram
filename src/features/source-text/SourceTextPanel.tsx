import { useState } from 'react';

import { selectAvailableTokens } from '../../domain/diagram/selectors';
import type { DiagramDocument } from '../../domain/diagram/types';
import styles from './SourceTextPanel.module.css';

interface SourceTextPanelProps {
  document: DiagramDocument | null;
  draftSourceText: string;
  onDraftChange: (value: string) => void;
  onCreate: () => void;
  onReset: () => void;
}

export function SourceTextPanel({
  document,
  draftSourceText,
  onDraftChange,
  onCreate,
  onReset,
}: SourceTextPanelProps) {
  const [editing, setEditing] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const availableTokens = document ? selectAvailableTokens(document) : [];

  function createOrReset() {
    if (!/\S/u.test(draftSourceText)) {
      setValidationMessage('Enter at least one non-whitespace character.');
      return;
    }
    setValidationMessage('');
    if (document && document.elements.length > 0 && editing) {
      setConfirmingReset(true);
      return;
    }
    if (document && editing) {
      onReset();
      setEditing(false);
      return;
    }
    onCreate();
  }

  function cancelEditing() {
    onDraftChange(document?.sourceText ?? '');
    setEditing(false);
    setConfirmingReset(false);
    setValidationMessage('');
  }

  return (
    <section className={styles.panel} aria-labelledby="source-panel-title">
      <h2 id="source-panel-title">Source text</h2>
      <label htmlFor="source-text">Source text input</label>
      <textarea
        id="source-text"
        value={document && !editing ? document.sourceText : draftSourceText}
        onChange={(event) => onDraftChange(event.target.value)}
        readOnly={Boolean(document && !editing)}
        aria-describedby={validationMessage ? 'source-text-error' : undefined}
        dir="auto"
        rows={7}
      />
      {validationMessage && (
        <p id="source-text-error" role="alert" className={styles.error}>
          {validationMessage}
        </p>
      )}
      {!document && <button onClick={createOrReset}>Create diagram</button>}
      {document && !editing && (
        <button onClick={() => setEditing(true)}>Edit source</button>
      )}
      {document && editing && !confirmingReset && (
        <div className={styles.actions}>
          <button onClick={createOrReset}>Apply source text</button>
          <button type="button" onClick={cancelEditing}>Cancel</button>
        </div>
      )}
      {confirmingReset && (
        <div className={styles.confirmation} role="alert">
          <p>Changing the source text will delete the existing diagram elements.</p>
          <div className={styles.actions}>
            <button onClick={() => { onReset(); setEditing(false); setConfirmingReset(false); }}>
              Confirm reset
            </button>
            <button type="button" onClick={() => setConfirmingReset(false)}>Cancel</button>
          </div>
        </div>
      )}
      {document && (
        <div aria-labelledby="tokens-title">
          <h3 id="tokens-title">Available tokens</h3>
          {availableTokens.length > 0 ? (
            <ol className={styles.tokens}>
              {availableTokens.map((token) => <li key={token.id} data-token-id={token.id}>{token.text}</li>)}
            </ol>
          ) : <p>No unplaced tokens.</p>}
          <p className={styles.tokenSummary}>
            {document.tokens.length - availableTokens.length} placed / {document.tokens.length} total
          </p>
        </div>
      )}
    </section>
  );
}
