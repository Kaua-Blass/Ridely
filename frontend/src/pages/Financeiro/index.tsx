import styles from './Financeiro.module.css';

/** Tela: Financeiro. Mensalidades, baixas e multa por atraso.
 *  Referência visual: docs/prototipo/tcc-sistema.html
 *  API: backend/src/modules/financeiro */
export default function Financeiro() {
  return (
    <section>
      <h1 className={styles.titulo}>Financeiro</h1>
      <p className={styles.sub}>Mensalidades, baixas e multa por atraso.</p>
    </section>
  );
}
