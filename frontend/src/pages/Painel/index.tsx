import { useAuth } from '../../lib/auth';
import styles from './Painel.module.css';

/** Tela: Painel. Indicadores por perfil e alertas de lotação (virão com os módulos de financeiro e transporte). */
export default function Painel() {
  const { usuario } = useAuth();
  return (
    <section>
      <h1 className={styles.titulo}>Olá, {usuario?.nome.split(' ')[0]}</h1>
      <p className={styles.sub}>Perfil de acesso: {usuario?.perfil}. Os indicadores chegam junto com o financeiro e o transporte.</p>
    </section>
  );
}
