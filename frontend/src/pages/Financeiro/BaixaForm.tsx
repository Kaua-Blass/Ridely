import { FormEvent, useEffect, useState } from 'react';
import { brl, FORMAS, hojeIso, refBr } from '../../lib/formatar';
import { useEnvio } from '../../lib/useEnvio';
import { baixar, ContaResumo, contasAtivas, MensalidadeItem } from './api';

/** Baixa de mensalidade. A multa (única, sem juros) vale se o pagamento é depois do vencimento. */
export default function BaixaForm({ item, multaPercentual, aoConcluir, aoCancelar }: { item: MensalidadeItem; multaPercentual: number; aoConcluir: (m: string) => void; aoCancelar: () => void }) {
  const [contas, setContas] = useState<ContaResumo[]>([]);
  const [f, setF] = useState({ data: hojeIso(), forma: 'pix', contaId: '', dispensar: false, motivo: '' });
  const { erro, enviando, executar } = useEnvio();
  useEffect(() => { contasAtivas().then((l) => { setContas(l); if (l.length === 1) setF((x) => ({ ...x, contaId: String(l[0].id) })); }); }, []);

  const multaCheia = f.data > item.vencimento ? Math.round(item.valor * multaPercentual) / 100 : 0;
  const multa = f.dispensar ? 0 : multaCheia;
  const total = Math.round((item.valor + multa) * 100) / 100;

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => {
      const r = await baixar(item.id, { data: f.data, forma: f.forma, contaId: Number(f.contaId), dispensarMulta: f.dispensar && multaCheia > 0, motivo: f.motivo || undefined });
      aoConcluir(r.mensagem);
    });
  };

  return (
    <form className="card" onSubmit={enviar}>
      <h2>Baixa · {item.associado} · {refBr(item.referencia)}</h2>
      <div className="grade">
        <div><label htmlFor="bd">Data do pagamento</label><input id="bd" type="date" max={hojeIso()} value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} required /></div>
        <div><label htmlFor="bf">Forma de pagamento</label><select id="bf" value={f.forma} onChange={(e) => setF({ ...f, forma: e.target.value })}>{FORMAS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></div>
        <div><label htmlFor="bc">Conta de recebimento</label>
          <select id="bc" value={f.contaId} onChange={(e) => setF({ ...f, contaId: e.target.value })} required><option value="">Escolha…</option>{contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
      </div>
      <p style={{ margin: '12px 0 0' }}>Mensalidade {brl(item.valor)} + multa {brl(multa)} = <b>{brl(total)}</b></p>
      {multaCheia > 0 && (
        <>
          <label className="opcao"><input type="checkbox" checked={f.dispensar} onChange={(e) => setF({ ...f, dispensar: e.target.checked })} />Dispensar a multa de {brl(multaCheia)}</label>
          {f.dispensar && <><label htmlFor="bm">Motivo da dispensa</label><input id="bm" value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} maxLength={300} required /></>}
        </>
      )}
      {erro && <p role="alert" className="erro">{erro}</p>}
      <p><button className="btn" disabled={enviando}>{enviando ? 'Registrando…' : 'Confirmar baixa'}</button> <button type="button" className="btn sec" onClick={aoCancelar}>Cancelar</button></p>
    </form>
  );
}
