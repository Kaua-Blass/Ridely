import styles from './Comunicacao.module.css';

/** Tela: Comunicação. Avisos, notícias e anexos.
 *  Referência visual: docs/prototipo/tcc-sistema.html
 *  API: backend/src/modules/comunicacao */
export default function Comunicacao() {
  return (
    <section>
      <h1 className={styles.titulo}>Comunicação</h1>
      <p className={styles.sub}>Avisos, notícias e anexos.</p>
    </section>
  );
}
