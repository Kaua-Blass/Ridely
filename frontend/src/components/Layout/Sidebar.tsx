import { NavLink } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { ACESSO } from '../../lib/permissoes';
import styles from './Sidebar.module.css';

const ITENS: Record<string, [string, string]> = {
  painel: ['/', 'Painel'], associados: ['/associados', 'Associados'], 'veiculos-rotas': ['/veiculos-rotas', 'Veículos e rotas'],
  financeiro: ['/financeiro', 'Financeiro'], 'controles-financeiros': ['/controles-financeiros', 'Controles financeiros'],
  contratos: ['/contratos', 'Contratos'], transporte: ['/transporte', 'Transporte'], comunicacao: ['/comunicacao', 'Comunicação'],
  relatorios: ['/relatorios', 'Relatórios'], administracao: ['/administracao', 'Administração'], perfil: ['/perfil', 'Meu perfil'],
};

export default function Sidebar() {
  const { usuario, sair } = useAuth();
  if (!usuario) return null;
  return (
    <aside className={styles.menu}>
      <div className={styles.logo}>TCC · Transporte Escolar</div>
      <nav>
        {ACESSO[usuario.perfil].map((t) => (
          <NavLink key={t} to={ITENS[t][0]} className={({ isActive }) => (isActive ? styles.ativo : '')}>{ITENS[t][1]}</NavLink>
        ))}
      </nav>
      <div className={styles.rodape}>
        <b>{usuario.nome}</b>
        <span>Perfil: {usuario.perfil}</span>
        <button onClick={sair}>Sair</button>
      </div>
    </aside>
  );
}
