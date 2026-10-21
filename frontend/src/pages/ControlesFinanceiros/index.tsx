import styles from './ControlesFinanceiros.module.css';

/** Tela: Controles financeiros. Cadastro de contas, receitas, despesas e transferências.
 *  Referência visual: docs/prototipo/tcc-sistema.html
 *  API: backend/src/modules/controles-financeiros */
export default function ControlesFinanceiros() {
  return (
    <section>
      <h1 className={styles.titulo}>Controles financeiros</h1>
      <p className={styles.sub}>Cadastro de contas, receitas, despesas e transferências.</p>
    </section>
  );
}
