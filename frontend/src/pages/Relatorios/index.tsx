import styles from './Relatorios.module.css';

/** Tela: Relatórios. Inadimplência, fluxo de caixa e contratos a vencer.
 *  Referência visual: docs/prototipo/tcc-sistema.html
 *  API: backend/src/modules/relatorios */
export default function Relatorios() {
  return (
    <section>
      <h1 className={styles.titulo}>Relatórios</h1>
      <p className={styles.sub}>Inadimplência, fluxo de caixa e contratos a vencer.</p>
    </section>
  );
}
