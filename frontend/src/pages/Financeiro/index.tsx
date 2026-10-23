import { FormEvent, useCallback, useEffect, useState } from 'react';
import DataTable from '../../components/DataTable/DataTable';
import { useAuth } from '../../lib/auth';
import { brl, dataBr, formaNome, hojeIso, refBr } from '../../lib/formatar';
import { podeEscrever } from '../../lib/permissoes';
import { useEnvio } from '../../lib/useEnvio';
import { cancelar, estornar, Filtro, gerar, ListaMensalidades, MensalidadeItem, mensalidades, reativar, Resumo, resumo, StatusMens, urlRecibo } from './api';
import BaixaForm from './BaixaForm';
import styles from './Financeiro.module.css';

const ROTULO: Record<StatusMens, string> = { baixado: 'Baixado', em_aberto: 'Em aberto', atrasado: 'Atrasado', cancelada: 'Cancelada' };
const COR: Record<StatusMens, string> = { baixado: 'ok', em_aberto: '', atrasado: 'amb', cancelada: '' };

/** Tela: Financeiro. Mensalidades, baixas, estornos e recibos.
 *  API: backend/src/modules/financeiro */
export default function Financeiro() {
  const { usuario } = useAuth();
  const [dados, setDados] = useState<ListaMensalidades | null>(null);
  const [res, setRes] = useState<Resumo | null>(null);
  const [filtro, setFiltro] = useState<Filtro>({});
  const [form, setForm] = useState<Filtro>({});
  const [baixando, setBaixando] = useState<MensalidadeItem | null>(null);
  const [mesGerar, setMesGerar] = useState(hojeIso().slice(0, 7));
  const { erro, ok, enviando, executar } = useEnvio();

  const carregar = useCallback(async () => { const [d, r] = await Promise.all([mensalidades(filtro), resumo()]); setDados(d); setRes(r); }, [filtro]);
  useEffect(() => { carregar(); }, [carregar]);
  if (!usuario || !dados) return <p>Carregando…</p>;

  const escreve = podeEscrever('financeiro', usuario.perfil);
  const ehAssociado = usuario.perfil === 'associado';
  const agir = (fn: () => Promise<{ mensagem: string }>) => executar(async () => { const r = await fn(); await carregar(); return r.mensagem; });
  const filtrar = (e: FormEvent) => { e.preventDefault(); setFiltro(form); };
  const motivo = (p: string) => window.prompt(p)?.trim() || null;

  return (
    <section>
      <h1 className={styles.titulo}>Financeiro</h1>
      <p className={styles.sub}>{ehAssociado ? 'Suas mensalidades e recibos.' : 'Mensalidades vencem todo dia 10. Atraso: multa única de ' + dados.multaPercentual + '%, sem juros.'}</p>

      {res && (
        <div className="grade" style={{ marginBottom: 16 }}>
          <div className="card" style={{ margin: 0 }}><b>{brl(res.abertas.valor)}</b><br /><span className="sub">{res.abertas.qtd} em aberto</span></div>
          <div className="card" style={{ margin: 0 }}><b>{brl(res.atrasadas.valor + res.atrasadas.multa)}</b><br /><span className="sub">{res.atrasadas.qtd} atrasada(s), com multa de {brl(res.atrasadas.multa)}</span></div>
          <div className="card" style={{ margin: 0 }}><b>{brl(res.recebidasNoMes.valor)}</b><br /><span className="sub">{res.recebidasNoMes.qtd} recebida(s) neste mês</span></div>
        </div>
      )}

      {escreve && (
        <form className="card" onSubmit={(e) => { e.preventDefault(); agir(() => gerar(mesGerar)); }}>
          <h2>Gerar mensalidades</h2>
          <p className="sub" style={{ margin: '0 0 8px' }}>Para quem tem contrato no mês. O valor é proporcional ao contrato (início, fim e aditivos no meio do mês). Não duplica.</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
            <div><label htmlFor="g">Mês</label><input id="g" type="month" value={mesGerar} onChange={(e) => setMesGerar(e.target.value)} required style={{ width: 'auto' }} /></div>
            <button className="btn" disabled={enviando}>Gerar mensalidades</button>
          </div>
        </form>
      )}

      {baixando && <BaixaForm item={baixando} multaPercentual={dados.multaPercentual} aoCancelar={() => setBaixando(null)} aoConcluir={async (m) => { setBaixando(null); await carregar(); executar(async () => m); }} />}
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}

      <div className="card">
        <form onSubmit={filtrar} className="grade" style={{ marginBottom: 8 }}>
          {!ehAssociado && <div><label htmlFor="fb">Associado</label><input id="fb" value={form.busca ?? ''} onChange={(e) => setForm({ ...form, busca: e.target.value })} /></div>}
          <div><label htmlFor="fr">Referência</label><input id="fr" type="month" value={form.referencia ?? ''} onChange={(e) => setForm({ ...form, referencia: e.target.value })} /></div>
          <div><label htmlFor="fs">Situação</label>
            <select id="fs" value={form.status ?? ''} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="">Todas</option>{(Object.keys(ROTULO) as StatusMens[]).map((s) => <option key={s} value={s}>{ROTULO[s]}</option>)}</select></div>
          <div><label htmlFor="fd">Vencimento de</label><input id="fd" type="date" value={form.de ?? ''} onChange={(e) => setForm({ ...form, de: e.target.value })} /></div>
          <div><label htmlFor="fa">até</label><input id="fa" type="date" value={form.ate ?? ''} onChange={(e) => setForm({ ...form, ate: e.target.value })} /></div>
        </form>
        <p><button className="btn" onClick={filtrar}>Filtrar</button> <button className="btn sec" onClick={() => { setForm({}); setFiltro({}); }}>Limpar</button></p>
        {dados.total > dados.limite && <p className="sub">Mostrando {dados.limite} de {dados.total}. Refine os filtros para ver o restante.</p>}
        <DataTable<MensalidadeItem> porPagina={25} itens={dados.itens} colunas={[
          ...(ehAssociado ? [] : [{ titulo: 'Associado', ordenar: (m: MensalidadeItem) => m.associado, celula: (m: MensalidadeItem) => m.associado }]),
          { titulo: 'Referência', ordenar: (m) => m.referencia, celula: (m) => refBr(m.referencia) },
          { titulo: 'Vencimento', ordenar: (m) => m.vencimento, celula: (m) => dataBr(m.vencimento) },
          { titulo: 'Valor', ordenar: (m) => m.valor, celula: (m) => brl(m.valor) },
          { titulo: 'Multa', ordenar: (m) => m.multaDevida, celula: (m) => (m.multaDevida ? brl(m.multaDevida) : '—') },
          { titulo: 'Situação', ordenar: (m) => m.status, celula: (m) => (
            <>
              <span className={`tag ${COR[m.status]}`}>{ROTULO[m.status]}</span>
              {m.status === 'baixado' && m.pagoEm && <><br /><span className="sub">{dataBr(m.pagoEm)} · {formaNome(m.forma)} · {m.conta}</span></>}
              {m.status === 'cancelada' && m.canceladaMotivo && <><br /><span className="sub">{m.canceladaMotivo.replace(/^auto: /, '')}</span></>}
            </>
          ) },
          { titulo: '', celula: (m) => (
            <>
              {m.pagamentoId && <a className="btn sec peq" style={{ textDecoration: 'none', display: 'inline-block' }} href={urlRecibo(m.pagamentoId)} target="_blank" rel="noreferrer">Recibo</a>}
              {escreve && (m.status === 'em_aberto' || m.status === 'atrasado') && <>{' '}<button className="btn peq" onClick={() => setBaixando(m)}>Dar baixa</button>{' '}
                <button className="btn sec peq" onClick={() => { const t = motivo('Motivo do cancelamento:'); if (t) agir(() => cancelar(m.id, t)); }}>Cancelar</button></>}
              {escreve && m.status === 'baixado' && m.pagamentoId && <>{' '}<button className="btn sec peq" onClick={() => { const t = motivo('Motivo do estorno da baixa:'); if (t) agir(() => estornar(m.pagamentoId!, t)); }}>Estornar</button></>}
              {escreve && m.status === 'cancelada' && <button className="btn sec peq" onClick={() => agir(() => reativar(m.id))}>Reativar</button>}
            </>
          ) },
        ]} />
      </div>
    </section>
  );
}
