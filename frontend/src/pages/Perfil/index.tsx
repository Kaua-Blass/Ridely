import { useAuth } from '../../lib/auth';
import styles from './Perfil.module.css';

/** Tela: Meu perfil. Por enquanto só consulta; edição, foto e troca de senha são o próximo passo. */
export default function Perfil() {
  const { usuario } = useAuth();
  if (!usuario) return null;
  return (
    <section>
      <h1 className={styles.titulo}>Meu perfil</h1>
      <p className={styles.sub}>Seus dados de acesso.</p>
      <div className="card">
        <p><b>Nome:</b> {usuario.nome}</p>
        <p><b>E-mail:</b> {usuario.email}</p>
        <p><b>Telefone:</b> {usuario.telefone ?? '—'}</p>
        <p><b>Perfil de acesso:</b> {usuario.perfil}</p>
      </div>
    </section>
  );
}
