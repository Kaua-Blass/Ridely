import { FormEvent, useState } from 'react';
import SeletorDias from '../../components/SeletorDias/SeletorDias';
import { brl, hojeIso } from '../../lib/formatar';
import { useEnvio } from '../../lib/useEnvio';
import { aditivar, ContratoItem } from './api';

/** Aditivo: muda dias, valor por dia e/ou término a partir de uma data. A mensalidade do mês da mudança é proporcional. */
export default function AditivoForm({ contrato, aoConcluir, aoCancelar }: { contrato: ContratoItem; aoConcluir: () => void; aoCancelar: () => void }) {
  const [desde, setDesde] = useState(hojeIso());
  const [mudarDias, setMudarDias] = useState(false);
  const [dias, setDias] = useState<number[]>(contrato.diasAtuais);
  const [valor, setValor] = useState('');
  const [fim, setFim] = useState('');
  const [obs, setObs] = useState('');
  const { erro, enviando, executar } = useEnvio();

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => {
      if (mudarDias && !dias.length) throw new Error('Escolha ao menos um dia da semana.');
      await aditivar(contrato.id, { vigenciaAPartir: desde, novosDias: mudarDias ? dias : undefined, novoValorPorDia: valor ? Number(valor) : undefined, novoFim: fim || undefined, observacao: obs || undefined });
      aoConcluir();
    });
  };

  return (
    <form className="card" onSubmit={enviar}>
      <h2>Novo aditivo · {contrato.associado}</h2>
      <p className="sub">Hoje: {contrato.diasAtuais.length} dia(s) por semana a {brl(contrato.valorDiaAtual)} por dia. Preencha só o que muda.</p>
      <div className="grade">
        <div><label htmlFor="ad">Vale a partir de</label><input id="ad" type="date" min={hojeIso()} value={desde} onChange={(e) => setDesde(e.target.value)} required /></div>
        <div><label htmlFor="av">Novo valor por dia (R$)</label><input id="av" type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
        <div><label htmlFor="af">Novo término (prorrogar ou encurtar)</label><input id="af" type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
      </div>
      <label className="opcao"><input type="checkbox" checked={mudarDias} onChange={(e) => setMudarDias(e.target.checked)} />Mudar os dias de transporte</label>
      {mudarDias && <SeletorDias valor={dias} aoMudar={setDias} />}
      <label htmlFor="ao">Observação (opcional)</label><input id="ao" value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} />
      {erro && <p role="alert" className="erro">{erro}</p>}
      <p><button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Registrar aditivo'}</button> <button type="button" className="btn sec" onClick={aoCancelar}>Cancelar</button></p>
    </form>
  );
}
