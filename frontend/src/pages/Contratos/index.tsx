import styles from './Contratos.module.css';

/** Tela: Contratos. Vigência, dias contratados, aditivos e PDF.
 *  Referência visual: docs/prototipo/tcc-sistema.html
 *  API: backend/src/modules/contratos */
export default function Contratos() {
  return (
    <section>
      <h1 className={styles.titulo}>Contratos</h1>
      <p className={styles.sub}>Vigência, dias contratados, aditivos e PDF.</p>
    </section>
  );
}
