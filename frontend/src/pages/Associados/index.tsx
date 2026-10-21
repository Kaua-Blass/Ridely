import { useEffect, useState } from 'react';
import DataTable from '../../components/DataTable/DataTable';
import { useAuth } from '../../lib/auth';
import { podeEscrever } from '../../lib/permissoes';
import { useEnvio } from '../../lib/useEnvio';
import { Associado, listar, mudarSituacao, reenviar } from './api';
import ConviteForm from './ConviteForm';
import EditarForm from './EditarForm';
import styles from './Associados.module.css';

/** Tela: Associados. Lista, busca, convites, edição e situação.
 *  API: backend/src/modules/associados */
export default function Associados() {
  const { usuario } = useAuth();
  const [lista, setLista] = useState<Associado[]>([]);
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Associado | null>(null);
  const { erro, ok, executar } = useEnvio();
  const carregar = () => listar().then(setLista);
  useEffect(() => { carregar(); }, []);

  const pode = !!usuario && podeEscrever('associados', usuario.perfil);
  const filtrados = lista.filter((a) => a.nome.toLowerCase().includes(busca.toLowerCase()));
  const agir = (fn: () => Promise<{ mensagem: string }>) => executar(async () => { const r = await fn(); await carregar(); return r.mensagem; });

  return (
    <section>
      <div className="linha">
        <div><h1 className={styles.titulo}>Associados</h1><p className="sub" style={{ margin: 0 }}>Novos associados recebem um convite por e-mail e criam a própria senha.</p></div>
        {pode && <button className="btn" onClick={() => { setAberto(!aberto); setEditando(null); }}>{aberto ? 'Fechar' : 'Convidar associado'}</button>}
      </div>
      {aberto && <ConviteForm aoConcluir={carregar} />}
      {editando && <EditarForm key={editando.id} associado={editando} aoConcluir={() => { setEditando(null); carregar(); }} aoCancelar={() => setEditando(null)} />}
      <div className="card">
        <input placeholder="Buscar associado" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ marginBottom: 12 }} />
        {erro && <p role="alert" className="erro">{erro}</p>}
        {ok && <p role="status" className="sucesso">{ok}</p>}
        <DataTable<Associado> itens={filtrados} colunas={[
          { titulo: 'Nome', ordenar: (a) => a.nome, celula: (a) => a.nome },
          { titulo: 'Cargo', ordenar: (a) => a.cargo, celula: (a) => a.cargo },
          { titulo: 'Instituição', ordenar: (a) => a.instituicao ?? '', celula: (a) => a.instituicao ?? '—' },
          { titulo: 'Rota', ordenar: (a) => a.rota ?? '', celula: (a) => a.rota ?? '—' },
          { titulo: 'Cadastro', ordenar: (a) => a.situacao, celula: (a) => (
            <span className={`tag ${a.situacao === 'ativo' ? 'ok' : 'amb'}`}>{a.situacao === 'convite' ? 'Convite enviado' : a.situacao === 'ativo' ? 'Ativo' : 'Inativo'}</span>
          ) },
          { titulo: '', celula: (a) => !pode ? null : (
            <>
              {a.situacao === 'convite'
                ? <button className="btn sec peq" onClick={() => agir(() => reenviar(a.id))}>Reenviar convite</button>
                : <>
                    <button className="btn sec peq" onClick={() => { setEditando(a); setAberto(false); }}>Editar</button>{' '}
                    <button className="btn sec peq" onClick={() => agir(() => mudarSituacao(a.id, a.situacao !== 'ativo'))}>{a.situacao === 'ativo' ? 'Inativar' : 'Reativar'}</button>
                  </>}
            </>
          ) },
        ]} />
      </div>
    </section>
  );
}
