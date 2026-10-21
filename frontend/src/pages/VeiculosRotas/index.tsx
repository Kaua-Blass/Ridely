import styles from './VeiculosRotas.module.css';

/** Tela: Veículos e rotas. Veículos, rotas, paradas e instituições atendidas.
 *  Referência visual: docs/prototipo/tcc-sistema.html
 *  API: backend/src/modules/veiculos-rotas */
export default function VeiculosRotas() {
  return (
    <section>
      <h1 className={styles.titulo}>Veículos e rotas</h1>
      <p className={styles.sub}>Veículos, rotas, paradas e instituições atendidas.</p>
    </section>
  );
}
