import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { brl, dataBr, diasTexto, hojeIso } from '../../lib/formatar';
import { useEnvio } from '../../lib/useEnvio';
import { ContratoDetalhe, detalhe, encerrar, enviarPdf, previa, Previa, removerPdf, urlPdf } from './api';

interface Props { id: number; escreve: boolean; ehAssociado: boolean; aoMudar: () => void; aoFechar: () => void; aoSolicitar: (c: ContratoDetalhe) => void }

export default function Detalhe({ id, escreve, ehAssociado, aoMudar, aoFechar, aoSolicitar }: Props) {
  const [c, setC] = useState<ContratoDetalhe | null>(null);
  const [mes, setMes] = useState(hojeIso().slice(0, 7));
  const [p, setP] = useState<Previa | null>(null);
  const [fimEm, setFimEm] = useState(hojeIso());
  const { erro, ok, executar } = useEnvio();
  const carregar = useCallback(() => detalhe(id).then(setC), [id]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { previa(id, mes).then(setP).catch(() => setP(null)); }, [id, mes, c]);
  if (!c) return <p>Carregando…</p>;

  const depois = async (m: string) => { await carregar(); aoMudar(); return m; };
  const subir = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (f) executar(async () => { if (f.size > 10 * 1024 * 1024) throw new Error('O PDF deve ter até 10 MB.'); return depois((await enviarPdf(id, f)).mensagem); });
  };
  const podeAnexar = escreve || (ehAssociado && !c.temPdf);

  return (
    <div className="card">
      <div className="linha">
        <h2 style={{ margin: 0 }}>Contrato de {c.associado}</h2>
        <button className="btn sec peq" onClick={aoFechar}>Fechar</button>
      </div>
      <p>{dataBr(c.inicio)} a {dataBr(c.fim)} · {diasTexto(c.diasAtuais)} · {brl(c.valorDiaAtual)} por dia · mensalidade cheia <b>{brl(c.mensalidadeAtual)}</b></p>
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}

      <h2 style={{ marginTop: 16 }}>Documento (PDF)</h2>
      <p>
        {c.temPdf ? <a href={urlPdf(c.id)}>Baixar {c.pdfNome}</a> : 'Nenhum PDF anexado.'}{' '}
        {podeAnexar && (
          <label className="btn sec peq" style={{ margin: 0, display: 'inline-block', cursor: 'pointer' }}>
            {c.temPdf ? 'Substituir' : 'Anexar PDF'}<input type="file" accept="application/pdf" hidden onChange={subir} />
          </label>
        )}{' '}
        {escreve && c.temPdf && <button className="btn sec peq" onClick={() => executar(async () => depois((await removerPdf(id)).mensagem))}>Remover</button>}
      </p>

      <h2 style={{ marginTop: 16 }}>Mensalidade proporcional</h2>
      <p className="sub" style={{ margin: '0 0 8px' }}>Início, término e aditivos no meio do mês valem só pelos dias de cada versão do contrato.</p>
      <div className="grade" style={{ maxWidth: 420 }}>
        <div><label htmlFor="pm">Mês</label><input id="pm" type="month" value={mes} onChange={(e) => setMes(e.target.value)} /></div>
      </div>
      {p && (p.segmentos.length === 0 ? <p>O contrato não está em vigor nesse mês.</p> : (
        <table style={{ marginTop: 8 }}>
          <thead><tr><th>Período</th><th>Dias por semana</th><th>Valor por dia</th><th>Proporção</th><th>Valor</th></tr></thead>
          <tbody>
            {p.segmentos.map((s) => <tr key={s.de}><td>{dataBr(s.de)} a {dataBr(s.ate)}</td><td>{diasTexto(s.dias)}</td><td>{brl(s.valorDia)}</td><td>{s.diasNoSegmento}/{s.diasNoMes}</td><td>{brl(s.valor)}</td></tr>)}
            <tr><td colSpan={4}><b>Total do mês</b></td><td><b>{brl(p.total)}</b></td></tr>
          </tbody>
        </table>
      ))}

      <h2 style={{ marginTop: 16 }}>Histórico de aditivos</h2>
      {c.aditivosLista.length === 0 ? <p>Sem aditivos.</p> : (
        <table>
          <thead><tr><th>Vale desde</th><th>O que mudou</th><th>Registrado por</th></tr></thead>
          <tbody>{c.aditivosLista.map((a) => (
            <tr key={a.id}>
              <td>{dataBr(a.vigenciaAPartir)}</td>
              <td>{[a.novosDias && `dias: ${diasTexto(a.novosDias)}`, a.novoValorPorDia && `valor por dia: ${brl(Number(a.novoValorPorDia))}`, a.novoFim && `término: ${dataBr(a.novoFim)}`].filter(Boolean).join(' · ')}{a.observacao && <><br /><span className="sub">{a.observacao}</span></>}</td>
              <td>{a.criadoPor ?? '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      )}

      {ehAssociado && c.status === 'vigente' && <p><button className="btn" onClick={() => aoSolicitar(c)}>Solicitar alteração de dias</button></p>}
      {escreve && c.status === 'vigente' && (
        <div style={{ marginTop: 16 }}>
          <h2>Encerrar contrato</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" min={hojeIso()} max={c.fim} value={fimEm} onChange={(e) => setFimEm(e.target.value)} style={{ width: 'auto' }} aria-label="Data de encerramento" />
            <button className="btn sec" onClick={() => window.confirm(`Encerrar o contrato de ${c.associado} em ${dataBr(fimEm)}?`) && executar(async () => depois((await encerrar(id, fimEm)).mensagem))}>Encerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
