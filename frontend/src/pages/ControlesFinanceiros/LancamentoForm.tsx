import { FormEvent, useEffect, useState } from 'react';
import { brl, hojeIso } from '../../lib/formatar';
import { useEnvio } from '../../lib/useEnvio';
import { categorias, Conta, contas as listarContas, lancar } from './api';

/** Receita ou despesa manual. Mensalidade não entra aqui: ela entra pela baixa, na tela Financeiro. */
export default function LancamentoForm({ tipo, aoConcluir, aoCancelar }: { tipo: 'receita' | 'despesa'; aoConcluir: (m: string) => void; aoCancelar: () => void }) {
  const [cats, setCats] = useState<string[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [f, setF] = useState({ data: hojeIso(), categoria: '', descricao: '', valor: '', contaId: '', observacao: '' });
  const { erro, enviando, executar } = useEnvio();
  useEffect(() => { categorias().then((c) => setCats(tipo === 'receita' ? c.receitas : c.despesas)); listarContas().then((l) => setContas(l.filter((c) => c.ativa))); }, [tipo]);
  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => {
      const r = await lancar(tipo, { data: f.data, categoria: f.categoria, descricao: f.descricao, valor: Number(f.valor), contaId: Number(f.contaId), observacao: f.observacao || undefined });
      aoConcluir(r.mensagem);
    });
  };

  return (
    <form className="card" onSubmit={enviar}>
      <h2>{tipo === 'receita' ? 'Nova receita' : 'Nova despesa'}</h2>
      <div className="grade">
        <div><label htmlFor="ld">Data</label><input id="ld" type="date" max={hojeIso()} {...campo('data')} required /></div>
        <div><label htmlFor="lc">Categoria</label><select id="lc" {...campo('categoria')} required><option value="">Escolha…</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label htmlFor="lv">Valor (R$)</label><input id="lv" type="number" step="0.01" min="0.01" {...campo('valor')} required /></div>
        <div><label htmlFor="lt">{tipo === 'receita' ? 'Conta de destino' : 'Conta de origem'}</label>
          <select id="lt" {...campo('contaId')} required><option value="">Escolha…</option>{contas.map((c) => <option key={c.id} value={c.id}>{c.nome} ({brl(c.saldo)})</option>)}</select></div>
        <div><label htmlFor="ls">Descrição</label><input id="ls" {...campo('descricao')} maxLength={200} required /></div>
        <div><label htmlFor="lo">Observação (opcional)</label><input id="lo" {...campo('observacao')} maxLength={300} /></div>
      </div>
      {tipo === 'despesa' && <p className="sub" style={{ margin: '12px 0 0' }}>Despesa sem saldo suficiente na conta é recusada.</p>}
      {erro && <p role="alert" className="erro">{erro}</p>}
      <p><button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Registrar'}</button> <button type="button" className="btn sec" onClick={aoCancelar}>Cancelar</button></p>
    </form>
  );
}
