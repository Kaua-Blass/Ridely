import { FormEvent, useEffect, useState } from 'react';
import { useEnvio } from '../../lib/useEnvio';
import { parametros, salvarParametros } from './api';

export default function Parametros() {
  const [valor, setValor] = useState('');
  const [multa, setMulta] = useState('');
  const { erro, ok, enviando, executar } = useEnvio();
  useEffect(() => { parametros().then((p) => { setValor(String(p.valorPorDia)); setMulta(String(p.multaPercentual)); }); }, []);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => (await salvarParametros({ valorPorDia: Number(valor), multaPercentual: Number(multa) })).mensagem);
  };

  return (
    <form className="card" onSubmit={enviar}>
      <h2>Parâmetros</h2>
      <p className="sub">Mensalidade = dias contratados por semana × valor por dia. A multa é aplicada uma vez sobre a mensalidade em atraso, sem juros. Mudanças valem para as próximas mensalidades.</p>
      <div className="grade">
        <div><label htmlFor="v">Valor por dia contratado (R$)</label><input id="v" type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} required /></div>
        <div><label htmlFor="m">Multa por atraso (%)</label><input id="m" type="number" step="0.01" min="0" max="100" value={multa} onChange={(e) => setMulta(e.target.value)} required /></div>
      </div>
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      <p><button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar parâmetros'}</button></p>
    </form>
  );
}
