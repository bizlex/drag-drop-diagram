import { useState } from 'react';

import { createDocumentFromText, defaultDomainDependencies, resetDocumentFromText } from './domain/diagram/operations';
import type { DiagramDocument } from './domain/diagram/types';
import { DiagramCanvas } from './features/canvas/DiagramCanvas';
import { SourceTextPanel } from './features/source-text/SourceTextPanel';
import styles from './App.module.css';

function App() {
  const [document, setDocument] = useState<DiagramDocument | null>(null);
  const [draftSourceText, setDraftSourceText] = useState('');
  const [error, setError] = useState('');

  function create() {
    const result = createDocumentFromText(
      { title: 'Untitled diagram', sourceText: draftSourceText, canvas: { width: 900, height: 600, background: '#ffffff' } },
      defaultDomainDependencies,
    );
    if (result.ok) { setDocument(result.value); setError(''); }
    else setError(result.error.message);
  }

  function reset() {
    if (!document) return;
    const result = resetDocumentFromText(document, { sourceText: draftSourceText }, defaultDomainDependencies);
    if (result.ok) { setDocument(result.value); setError(''); }
    else setError(result.error.message);
  }

  return (
    <main className={styles.appShell}>
      <header className={styles.header}><h1 id="application-title">Drag &amp; Drop Diagram</h1></header>
      <div className={styles.layout}>
        <SourceTextPanel document={document} draftSourceText={draftSourceText} onDraftChange={setDraftSourceText} onCreate={create} onReset={reset} />
        <section className={styles.workspace} aria-labelledby="workspace-title">
          <h2 id="workspace-title">Diagram workspace</h2>
          <DiagramCanvas document={document} />
          {error && <p role="alert">{error}</p>}
        </section>
      </div>
    </main>
  );
}

export default App;
