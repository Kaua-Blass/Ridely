import { FormEvent, useCallback, useEffect, useState } from 'react';
import { brl, dataBr } from '../../lib/formatar';
import { useEnvio } from '../../lib/useEnvio';
import { Conta, contas as listarContas, estornar, FiltroMov, Movimentacao, movimentacoes, PaginaMov } from './api';
import LancamentoForm from './LancamentoForm';
import TransferenciaForm from './TransferenciaForm';

const TIPO: Record<Movimentacao['tipo'], string> = { receita: 'Receita', despesa: 'Despesa', transferencia_entrada: 'Transferência (entrada)', transferencia_saida: 'Transferência (saída)', estorno: 'Estorno' };

export default function Movimentacoes({ escreve, versao, aoMudar }: { escreve: boolean; versao: number; aoMudar: () => void }) {
  const [pagina, setPagina] = useState<PaginaMov | null>(null);
  const [contas, setContas] = useState<Conta[]>([]);
  const [filtro, setFiltro] = useState<FiltroMov>({ pagina: 1 });
  const [form, setForm] = useState<FiltroMov>({});
  const [painel, setPainel] = useState<'receita' | 'despesa' | 'transferencia' | null>(null);
  const { erro, ok, executar } = useEnvio();
  const carregar = useCallback(async () => { setPagina(await movimentacoes(filtro)); }, [filtro]);
  useEffect(() => { carregar(); }, [carregar, versao]);
  useEffect(() => { listarContas().then(setContas); }, [versao]);

  const depois = (m: string) => { setPainel(null); aoMudar(); executar(async () => m); };
  const filtrar = (e: FormEvent) => { e.preventDefault(); setFiltro({ ...form, pagina: 1 }); };
  const paginas = pagina ? Math.max(1, Math.ceil(pagina.total / pagina.porPagina)) : 1;
  const estornarMov = (m: Movimentacao) => {
    const motivo = window.prompt('Motivo do estorno:')?.trim();
    if (motivo) executar(async () => { const r = await estornar(m.id, motivo); aoMudar(); return r.mensagem; });
  };

  return (
    <>
      {escreve && !painel && (
        <p><button className="btn" onClick={() => setPainel('receita')}>Nova receita</button>{' '}<button className="btn" onClick={() => setPainel('despesa')}>Nova despesa</button>{' '}<button className="btn sec" onClick={() => setPainel('transferencia')}>Transferir entre contas</button></p>
      )}
      {painel === 'transferencia' && <TransferenciaForm aoConcluir={depois} aoCancelar={() => setPainel(null)} />}
      {(painel === 'receita' || painel === 'despesa') && <LancamentoForm tipo={painel} aoConcluir={depois} aoCancelar={() => setPainel(null)} />}
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      <div className="card">
        <form onSubmit={filtrar} className="grade">
          <div><label htmlFor="mc">Conta</label><select id="mc" value={form.contaId ?? ''} onChange={(e) => setForm({ ...form, contaId: e.target.value })}><option value="">Todas</option>{contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
          <div><label htmlFor="mt">Tipo</label><select id="mt" value={form.tipo ?? ''} onChange={(e) => setForm({ ...form, tipo: e.target.value })}><option value="">Todos</option><option value="receita">Receita</option><option value="despesa">Despesa</option><option value="transferencia">Transferência</option><option value="estorno">Estorno</option></select></div>
          <div><label htmlFor="md">De</label><input id="md" type="date" value={form.de ?? ''} onChange={(e) => setForm({ ...form, de: e.target.value })} /></div>
          <div><label htmlFor="ma">Até</label><input id="ma" type="date" value={form.ate ?? ''} onChange={(e) => setForm({ ...form, ate: e.target.value })} /></div>
          <div><label htmlFor="mb">Buscar no histórico ou associado</label><input id="mb" value={form.busca ?? ''} onChange={(e) => setForm({ ...form, busca: e.target.value })} /></div>
          <div><label htmlFor="mo">Ordem</label><select id="mo" value={form.ordem ?? 'desc'} onChange={(e) => setForm({ ...form, ordem: e.target.value })}><option value="desc">Mais recentes primeiro</option><option value="asc">Mais antigas primeiro</option></select></div>
        </form>
        <p><button className="btn" onClick={filtrar}>Filtrar</button> <button className="btn sec" onClick={() => { setForm({}); setFiltro({ pagina: 1 }); }}>Limpar</button></p>
        {pagina && (
          <>
            <p className="sub">{pagina.total} movimentação(ões) · receitas {brl(pagina.receitas)} · despesas {brl(pagina.despesas)} (transferências não entram)</p>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Data</th><th>Conta</th><th>Tipo</th><th>Histórico</th><th>Entrada</th><th>Saída</th><th>Saldo da conta</th><th /></tr></thead>
                <tbody>{pagina.itens.map((m) => (
                  <tr key={m.id}>
                    <td>{dataBr(m.data)}</td><td>{m.conta}</td>
                    <td><span className={`tag ${m.tipo === 'despesa' || m.tipo === 'estorno' ? 'amb' : m.tipo === 'receita' ? 'ok' : ''}`}>{TIPO[m.tipo]}</span></td>
                    <td>{m.historico}{m.associado && <><br /><span className="sub">{m.associado}</span></>}{m.estornada && <><br /><span className="sub">estornada</span></>}</td>
                    <td>{m.sinal === 1 ? brl(m.valor) : ''}</td><td>{m.sinal === -1 ? brl(m.valor) : ''}</td><td>{brl(m.saldoApos)}</td>
                    <td>{escreve && m.tipo !== 'estorno' && !m.estornada && !m.pagamentoId && <button className="btn sec peq" onClick={() => estornarMov(m)}>Estornar</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {pagina.itens.length === 0 && <p>Nenhuma movimentação encontrada.</p>}
            <p style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
              <button className="btn sec peq" disabled={pagina.pagina <= 1} onClick={() => setFiltro({ ...filtro, pagina: pagina.pagina - 1 })}>Anterior</button>
              Página {pagina.pagina} de {paginas}
              <button className="btn sec peq" disabled={pagina.pagina >= paginas} onClick={() => setFiltro({ ...filtro, pagina: pagina.pagina + 1 })}>Próxima</button>
            </p>
          </>
        )}
      </div>
    </>
  );
}
