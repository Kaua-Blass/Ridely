import { FormEvent, useEffect, useState } from 'react';
import { brl, hojeIso } from '../../lib/formatar';
import { useEnvio } from '../../lib/useEnvio';
import { Conta, contas as listarContas, transferir } from './api';

/** Move dinheiro entre contas. Não é receita nem despesa. */
export default function TransferenciaForm({ aoConcluir, aoCancelar }: { aoConcluir: (m: string) => void; aoCancelar: () => void }) {
  const [contas, setContas] = useState<Conta[]>([]);
  const [f, setF] = useState({ data: hojeIso(), origemId: '', destinoId: '', valor: '', historico: '' });
  const { erro, enviando, executar } = useEnvio();
  useEffect(() => { listarContas().then((l) => setContas(l.filter((c) => c.ativa))); }, []);
  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => {
      if (f.origemId === f.destinoId) throw new Error('A conta de origem e a de destino devem ser diferentes.');
      const r = await transferir({ data: f.data, origemId: Number(f.origemId), destinoId: Number(f.destinoId), valor: Number(f.valor), historico: f.historico });
      aoConcluir(r.mensagem);
    });
  };

  return (
    <form className="card" onSubmit={enviar}>
      <h2>Transferência entre contas</h2>
      <div className="grade">
        <div><label htmlFor="td">Data</label><input id="td" type="date" max={hojeIso()} {...campo('data')} required /></div>
        <div><label htmlFor="to">Conta de origem</label>
          <select id="to" {...campo('origemId')} required><option value="">Escolha…</option>{contas.map((c) => <option key={c.id} value={c.id}>{c.nome} ({brl(c.saldo)})</option>)}</select></div>
        <div><label htmlFor="tt">Conta de destino</label>
          <select id="tt" {...campo('destinoId')} required><option value="">Escolha…</option>{contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
        <div><label htmlFor="tv">Valor (R$)</label><input id="tv" type="number" step="0.01" min="0.01" {...campo('valor')} required /></div>
        <div><label htmlFor="th">Justificativa</label><input id="th" {...campo('historico')} maxLength={200} required /></div>
      </div>
      <p className="sub" style={{ margin: '12px 0 0' }}>A saída e a entrada são gravadas juntas. Transferência sem saldo na origem é recusada.</p>
      {erro && <p role="alert" className="erro">{erro}</p>}
      <p><button className="btn" disabled={enviando}>{enviando ? 'Transferindo…' : 'Transferir'}</button> <button type="button" className="btn sec" onClick={aoCancelar}>Cancelar</button></p>
    </form>
  );
}
