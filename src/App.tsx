import styles from './App.module.css';

function App() {
  return (
    <main className={styles.appShell}>
      <section className={styles.appCard} aria-labelledby="application-title">
        <h1 id="application-title">Drag &amp; Drop Diagram</h1>
        <p>The Phase 1 editor foundation is ready for the next implementation package.</p>
      </section>
    </main>
  );
}

export default App;
