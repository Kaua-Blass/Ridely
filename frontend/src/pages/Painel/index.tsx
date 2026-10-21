import styles from './Painel.module.css';

/** Tela: Painel. Indicadores por perfil e alertas de lotação.
 *  Referência visual: docs/prototipo/tcc-sistema.html
 *  API: backend/src/modules/painel */
export default function Painel() {
  return (
    <section>
      <h1 className={styles.titulo}>Painel</h1>
      <p className={styles.sub}>Indicadores por perfil e alertas de lotação.</p>
    </section>
  );
}
