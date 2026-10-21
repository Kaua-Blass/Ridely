import styles from './Perfil.module.css';

/** Tela: Meu perfil. Dados pessoais, foto, instituição e troca de senha.
 *  Referência visual: docs/prototipo/tcc-sistema.html
 *  API: backend/src/modules/perfil */
export default function Perfil() {
  return (
    <section>
      <h1 className={styles.titulo}>Meu perfil</h1>
      <p className={styles.sub}>Dados pessoais, foto, instituição e troca de senha.</p>
    </section>
  );
}
