import styles from './Associados.module.css';

/** Tela: Associados. Cadastro, convites por e-mail e cargos.
 *  Referência visual: docs/prototipo/tcc-sistema.html
 *  API: backend/src/modules/associados */
export default function Associados() {
  return (
    <section>
      <h1 className={styles.titulo}>Associados</h1>
      <p className={styles.sub}>Cadastro, convites por e-mail e cargos.</p>
    </section>
  );
}
