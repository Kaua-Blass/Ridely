import { useEffect, useState } from 'react';
import DataTable from '../../components/DataTable/DataTable';
import { useAuth } from '../../lib/auth';
import { PERFIS } from '../../lib/permissoes';
import { useEnvio } from '../../lib/useEnvio';
import { atualizarUsuario, UsuarioAdm, usuarios } from './api';

/** Cargo é o título na associação; perfil é o que a pessoa pode fazer no sistema. */
export default function Usuarios() {
  const { usuario } = useAuth();
  const [lista, setLista] = useState<UsuarioAdm[]>([]);
  const { erro, ok, executar } = useEnvio();
  const carregar = () => usuarios().then(setLista);
  useEffect(() => { carregar(); }, []);
  const mudar = (id: number, d: { perfil?: string; ativo?: boolean }) => executar(async () => { const r = await atualizarUsuario(id, d); await carregar(); return r.mensagem; });
  const quando = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR') : 'Nunca');

  return (
    <div className="card">
      <h2>Usuários e perfis</h2>
      <p className="sub">A mudança de perfil vale na hora. Bloquear o acesso derruba as sessões abertas. Você não altera o próprio acesso.</p>
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      <DataTable<UsuarioAdm> itens={lista} colunas={[
        { titulo: 'Nome', ordenar: (u) => u.nome, celula: (u) => u.nome },
        { titulo: 'E-mail', ordenar: (u) => u.email, celula: (u) => u.email },
        { titulo: 'Cargo', ordenar: (u) => u.cargo ?? '', celula: (u) => u.cargo ?? '—' },
        { titulo: 'Perfil de acesso', ordenar: (u) => u.perfil, celula: (u) => (
          <select value={u.perfil} disabled={u.id === usuario?.id} aria-label={`Perfil de ${u.nome}`} onChange={(e) => mudar(u.id, { perfil: e.target.value })}>
            {PERFIS.map((p) => <option key={p}>{p}</option>)}
          </select>
        ) },
        { titulo: 'Acesso', ordenar: (u) => (u.ativo ? 0 : 1), celula: (u) => (
          <>
            <span className={`tag ${u.ativo ? 'ok' : 'amb'}`}>{u.ativo ? 'Liberado' : 'Bloqueado'}</span>{' '}
            {u.id !== usuario?.id && <button className="btn sec peq" onClick={() => mudar(u.id, { ativo: !u.ativo })}>{u.ativo ? 'Bloquear' : 'Liberar'}</button>}
          </>
        ) },
        { titulo: 'Último acesso', ordenar: (u) => u.ultimoAcesso ?? '', celula: (u) => quando(u.ultimoAcesso) },
      ]} />
    </div>
  );
}
