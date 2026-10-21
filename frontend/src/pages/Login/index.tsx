import styles from './Login.module.css';

/** Tela: Entrar. E-mail e senha, convite e criação de conta.
 *  Referência visual: docs/prototipo/tcc-sistema.html
 *  API: backend/src/modules/auth */
export default function Login() {
  return (
    <section>
      <h1 className={styles.titulo}>Entrar</h1>
      <p className={styles.sub}>E-mail e senha, convite e criação de conta.</p>
    </section>
  );
}
