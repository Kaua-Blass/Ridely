import styles from './Transporte.module.css';

/** Tela: Transporte. Reservas, lista de passageiros e lotação.
 *  Referência visual: docs/prototipo/tcc-sistema.html
 *  API: backend/src/modules/transporte */
export default function Transporte() {
  return (
    <section>
      <h1 className={styles.titulo}>Transporte</h1>
      <p className={styles.sub}>Reservas, lista de passageiros e lotação.</p>
    </section>
  );
}
