import styles from './Administracao.module.css';

/** Tela: Administração. Solicitações, usuários e perfis, parâmetros e auditoria.
 *  Referência visual: docs/prototipo/tcc-sistema.html
 *  API: backend/src/modules/administracao */
export default function Administracao() {
  return (
    <section>
      <h1 className={styles.titulo}>Administração</h1>
      <p className={styles.sub}>Solicitações, usuários e perfis, parâmetros e auditoria.</p>
    </section>
  );
}
