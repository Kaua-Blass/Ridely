import { FormEvent, useEffect, useState } from 'react';
import { useEnvio } from '../../lib/useEnvio';
import { parametros, salvarParametros } from './api';

export default function Parametros() {
  const [valor, setValor] = useState('');
  const [multa, setMulta] = useState('');
  const [alerta, setAlerta] = useState('');
  const { erro, ok, enviando, executar } = useEnvio();
  useEffect(() => { parametros().then((p) => { setValor(String(p.valorPorDia)); setMulta(String(p.multaPercentual)); setAlerta(String(p.alertaRenovacaoDias)); }); }, []);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => (await salvarParametros({ valorPorDia: Number(valor), multaPercentual: Number(multa), alertaRenovacaoDias: Number(alerta) })).mensagem);
  };

  return (
    <form className="card" onSubmit={enviar}>
      <h2>Parâmetros</h2>
      <p className="sub">Mensalidade = dias contratados por semana × valor por dia, proporcional quando o contrato começa, termina ou muda no meio do mês. O valor por dia é gravado em cada contrato na hora em que ele é criado: mudar aqui vale para novos contratos, e os existentes mantêm o valor deles (mudar um contrato existente é feito por aditivo). A multa é aplicada uma vez sobre a mensalidade em atraso, sem juros.</p>
      <div className="grade">
        <div><label htmlFor="v">Valor padrão por dia contratado (R$)</label><input id="v" type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} required /></div>
        <div><label htmlFor="m">Multa por atraso (%)</label><input id="m" type="number" step="0.01" min="0" max="100" value={multa} onChange={(e) => setMulta(e.target.value)} required /></div>
        <div><label htmlFor="a">Alerta de renovação (dias antes do término)</label><input id="a" type="number" min="1" max="365" value={alerta} onChange={(e) => setAlerta(e.target.value)} required /></div>
      </div>
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      <p><button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar parâmetros'}</button></p>
    </form>
  );
}
