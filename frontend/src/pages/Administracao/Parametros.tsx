import { FormEvent, useEffect, useState } from 'react';
import { useEnvio } from '../../lib/useEnvio';
import { parametros, salvarParametros } from './api';

export default function Parametros() {
  const [f, setF] = useState({ valor: '', multa: '', alerta: '', hora: '', lembrete: '', cobranca: '' });
  const { erro, ok, enviando, executar } = useEnvio();
  useEffect(() => { parametros().then((p) => setF({ valor: String(p.valorPorDia), multa: String(p.multaPercentual), alerta: String(p.alertaRenovacaoDias), hora: String(p.horaLimiteReserva), lembrete: String(p.lembreteVencimentoDias), cobranca: String(p.cobrancaIntervaloDias) })); }, []);
  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => (await salvarParametros({ valorPorDia: Number(f.valor), multaPercentual: Number(f.multa), alertaRenovacaoDias: Number(f.alerta), horaLimiteReserva: Number(f.hora), lembreteVencimentoDias: Number(f.lembrete), cobrancaIntervaloDias: Number(f.cobranca) })).mensagem);
  };

  return (
    <form className="card" onSubmit={enviar}>
      <h2>Parâmetros</h2>
      <p className="sub">Mensalidade = dias contratados por semana × valor por dia, proporcional quando o contrato começa, termina ou muda no meio do mês. O valor por dia é gravado em cada contrato na hora em que ele é criado: mudar aqui vale para novos contratos, e os existentes mantêm o valor deles. A multa é aplicada uma vez sobre a mensalidade em atraso, sem juros. Todas as mensalidades vencem no dia 10.</p>
      <div className="grade">
        <div><label htmlFor="v">Valor padrão por dia contratado (R$)</label><input id="v" type="number" step="0.01" min="0" {...campo('valor')} required /></div>
        <div><label htmlFor="m">Multa por atraso (%)</label><input id="m" type="number" step="0.01" min="0" max="100" {...campo('multa')} required /></div>
        <div><label htmlFor="a">Alerta de renovação (dias antes do término)</label><input id="a" type="number" min="1" max="365" {...campo('alerta')} required /></div>
        <div><label htmlFor="h">Reservar e cancelar viagem até as (hora do dia da viagem)</label><input id="h" type="number" min="0" max="23" {...campo('hora')} required /></div>
        <div><label htmlFor="l">Lembrete de vencimento (dias antes; 0 desliga)</label><input id="l" type="number" min="0" max="30" {...campo('lembrete')} required /></div>
        <div><label htmlFor="c">Cobrança de atrasados (a cada quantos dias; 0 desliga)</label><input id="c" type="number" min="0" max="90" {...campo('cobranca')} required /></div>
      </div>
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      <p><button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar parâmetros'}</button></p>
    </form>
  );
}
