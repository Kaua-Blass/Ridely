import { useCallback, useEffect, useState } from 'react';
import Abas from '../../components/Abas/Abas';
import DataTable from '../../components/DataTable/DataTable';
import { useAuth } from '../../lib/auth';
import { brl, dataBr, diasTexto } from '../../lib/formatar';
import { podeEscrever } from '../../lib/permissoes';
import AditivoForm from './AditivoForm';
import { ContratoItem, listar, Situacao } from './api';
import ContratoForm from './ContratoForm';
import Detalhe from './Detalhe';
import Solicitacoes from './Solicitacoes';
import styles from './Contratos.module.css';

const ROTULO: Record<Situacao, string> = { agendado: 'Agendado', vigente: 'Vigente', a_renovar: 'A renovar', vencido: 'Vencido', encerrado: 'Encerrado' };
const COR: Record<Situacao, string> = { agendado: '', vigente: 'ok', a_renovar: 'amb', vencido: 'amb', encerrado: '' };

/** Tela: Contratos. Vigência, dias contratados, aditivos, PDF e solicitações de alteração.
 *  API: backend/src/modules/contratos */
export default function Contratos() {
  const { usuario } = useAuth();
  const [lista, setLista] = useState<ContratoItem[] | null>(null);
  const [aba, setAba] = useState('Contratos');
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('');
  const [painel, setPainel] = useState<{ tipo: 'novo' | 'corrigir' | 'aditivo'; contrato?: ContratoItem } | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const [alvoSolicitacao, setAlvoSolicitacao] = useState<ContratoItem | null>(null);
  const carregar = useCallback(async () => { setLista(await listar()); }, []);
  useEffect(() => { carregar(); }, [carregar]);
  if (!lista || !usuario) return <p>Carregando…</p>;

  const escreve = podeEscrever('contratos', usuario.perfil);
  const ehAssociado = usuario.perfil === 'associado';
  const avisos = lista.filter((c) => c.situacao === 'a_renovar' || c.situacao === 'vencido');
  const filtrados = lista.filter((c) => c.associado.toLowerCase().includes(busca.toLowerCase()) && (!situacao || c.situacao === situacao));
  const abas = ['Contratos', ehAssociado ? 'Minhas solicitações' : 'Solicitações'];
  const depois = () => { setPainel(null); carregar(); };

  return (
    <section>
      <div className="linha">
        <div><h1 className={styles.titulo}>Contratos</h1><p className="sub" style={{ margin: 0 }}>Vigência, dias contratados, aditivos e documento em PDF.</p></div>
        {escreve && aba === abas[0] && !painel && <button className="btn" onClick={() => setPainel({ tipo: 'novo' })}>Novo contrato</button>}
      </div>

      {avisos.length > 0 && (
        <div className="card" role="status" style={{ borderColor: 'var(--alerta)' }}>
          <h2>Atenção: renovação</h2>
          {avisos.map((c) => (
            <p key={c.id} style={{ margin: '4px 0' }}>
              {ehAssociado ? 'Seu contrato' : <b>{c.associado}</b>}{' '}
              {c.situacao === 'vencido' ? <>venceu em {dataBr(c.fim)}</> : <>vence em {dataBr(c.fim)} ({c.diasParaVencer} dia{c.diasParaVencer === 1 ? '' : 's'})</>}.
              {escreve && <> <button className="btn sec peq" onClick={() => setPainel({ tipo: 'aditivo', contrato: c })}>Prorrogar</button></>}
            </p>
          ))}
        </div>
      )}

      <Abas abas={abas} ativa={aba} aoMudar={setAba} />

      {aba === abas[0] ? (
        <>
          {painel?.tipo === 'novo' && <ContratoForm aoConcluir={depois} aoCancelar={() => setPainel(null)} />}
          {painel?.tipo === 'corrigir' && painel.contrato && <ContratoForm contrato={painel.contrato} aoConcluir={depois} aoCancelar={() => setPainel(null)} />}
          {painel?.tipo === 'aditivo' && painel.contrato && <AditivoForm contrato={painel.contrato} aoConcluir={() => { depois(); setAberto(painel.contrato!.id); }} aoCancelar={() => setPainel(null)} />}
          {aberto && <Detalhe key={aberto} id={aberto} escreve={escreve} ehAssociado={ehAssociado} aoMudar={carregar} aoFechar={() => setAberto(null)}
            aoSolicitar={(c) => { setAlvoSolicitacao(c); setAba(abas[1]); }} />}
          <div className="card">
            <div className="grade" style={{ marginBottom: 8 }}>
              {!ehAssociado && <div><label htmlFor="b">Buscar associado</label><input id="b" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>}
              <div><label htmlFor="s">Situação</label>
                <select id="s" value={situacao} onChange={(e) => setSituacao(e.target.value)}><option value="">Todas</option>{(Object.keys(ROTULO) as Situacao[]).map((s) => <option key={s} value={s}>{ROTULO[s]}</option>)}</select></div>
            </div>
            <DataTable<ContratoItem> itens={filtrados} colunas={[
              { titulo: 'Associado', ordenar: (c) => c.associado, celula: (c) => c.associado },
              { titulo: 'Vigência', ordenar: (c) => c.fim, celula: (c) => `${dataBr(c.inicio)} a ${dataBr(c.fim)}` },
              { titulo: 'Dias', ordenar: (c) => c.diasAtuais.length, celula: (c) => diasTexto(c.diasAtuais) },
              { titulo: 'Mensalidade', ordenar: (c) => c.mensalidadeAtual, celula: (c) => brl(c.mensalidadeAtual) },
              { titulo: 'Aditivos', ordenar: (c) => c.aditivos, celula: (c) => c.aditivos },
              { titulo: 'Situação', ordenar: (c) => c.diasParaVencer, celula: (c) => <span className={`tag ${COR[c.situacao]}`}>{ROTULO[c.situacao]}</span> },
              { titulo: 'PDF', celula: (c) => (c.temPdf ? 'Anexado' : '—') },
              { titulo: '', celula: (c) => (
                <>
                  <button className="btn sec peq" onClick={() => { setAberto(c.id); setPainel(null); }}>Detalhes</button>
                  {escreve && c.status === 'vigente' && <>{' '}<button className="btn sec peq" onClick={() => setPainel({ tipo: 'aditivo', contrato: c })}>Aditivo</button></>}
                  {escreve && c.podeEditarDireto && <>{' '}<button className="btn sec peq" onClick={() => setPainel({ tipo: 'corrigir', contrato: c })}>Corrigir</button></>}
                </>
              ) },
            ]} />
          </div>
        </>
      ) : (
        <Solicitacoes escreve={escreve} ehAssociado={ehAssociado} contratos={lista} alvo={alvoSolicitacao} aoMudar={carregar} aoFecharAlvo={() => setAlvoSolicitacao(null)} />
      )}
    </section>
  );
}
