import { useEffect, useState } from 'react';
import DataTable from '../../components/DataTable/DataTable';
import { useAuth } from '../../lib/auth';
import { podeEscrever } from '../../lib/permissoes';
import { useEnvio } from '../../lib/useEnvio';
import { Associado, listar, reenviar } from './api';
import ConviteForm from './ConviteForm';
import styles from './Associados.module.css';

/** Tela: Associados. Lista, busca e convites por e-mail.
 *  API: backend/src/modules/associados */
export default function Associados() {
  const { usuario } = useAuth();
  const [lista, setLista] = useState<Associado[]>([]);
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const { erro, ok, executar } = useEnvio();
  const carregar = () => listar().then(setLista);
  useEffect(() => { carregar(); }, []);

  const pode = !!usuario && podeEscrever('associados', usuario.perfil);
  const filtrados = lista.filter((a) => a.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <section>
      <div className="linha">
        <div><h1 className={styles.titulo}>Associados</h1><p className="sub" style={{ margin: 0 }}>Novos associados recebem um convite por e-mail e criam a própria senha.</p></div>
        {pode && <button className="btn" onClick={() => setAberto(!aberto)}>{aberto ? 'Fechar' : 'Convidar associado'}</button>}
      </div>
      {aberto && <ConviteForm aoConcluir={carregar} />}
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
            <>
              <span className={`tag ${a.situacao === 'ativo' ? 'ok' : 'amb'}`}>{a.situacao === 'convite' ? 'Convite enviado' : a.situacao === 'ativo' ? 'Ativo' : 'Inativo'}</span>
              {pode && a.situacao === 'convite' && <> <button className="btn sec peq" onClick={() => executar(async () => { const r = await reenviar(a.id); return r.mensagem; })}>Reenviar</button></>}
            </>
          ) },
        ]} />
      </div>
    </section>
  );
}
