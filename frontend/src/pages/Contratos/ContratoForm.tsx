import { FormEvent, useEffect, useState } from 'react';
import SeletorDias from '../../components/SeletorDias/SeletorDias';
import { hojeIso } from '../../lib/formatar';
import { useEnvio } from '../../lib/useEnvio';
import { Associado, listar as listarAssociados } from '../Associados/api';
import { ContratoItem, criar, editar } from './api';

/** Novo contrato ou correção de um contrato ainda sem aditivos nem mensalidades. */
export default function ContratoForm({ contrato, aoConcluir, aoCancelar }: { contrato?: ContratoItem; aoConcluir: () => void; aoCancelar: () => void }) {
  const [associados, setAssociados] = useState<Associado[]>([]);
  const [f, setF] = useState({ associadoId: String(contrato?.associadoId ?? ''), inicio: contrato?.inicio ?? hojeIso(), fim: contrato?.fim ?? '', valorPorDia: contrato ? String(contrato.valorDiaAtual) : '' });
  const [dias, setDias] = useState<number[]>(contrato?.diasAtuais ?? [1, 2, 3, 4, 5]);
  const { erro, enviando, executar } = useEnvio();
  useEffect(() => { if (!contrato) listarAssociados().then((l) => setAssociados(l.filter((a) => a.situacao === 'ativo'))); }, [contrato]);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => {
      if (!dias.length) throw new Error('Escolha ao menos um dia da semana.');
      const base = { inicio: f.inicio, fim: f.fim, diasSemana: dias, valorPorDia: f.valorPorDia ? Number(f.valorPorDia) : undefined };
      if (contrato) await editar(contrato.id, base); else await criar({ ...base, associadoId: Number(f.associadoId) });
      aoConcluir();
    });
  };

  return (
    <form className="card" onSubmit={enviar}>
      <h2>{contrato ? `Corrigir contrato de ${contrato.associado}` : 'Novo contrato'}</h2>
      <div className="grade">
        {!contrato && (
          <div><label htmlFor="ca">Associado</label>
            <select id="ca" value={f.associadoId} onChange={(e) => setF({ ...f, associadoId: e.target.value })} required>
              <option value="">Escolha…</option>{associados.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></div>
        )}
        <div><label htmlFor="ci">Início</label><input id="ci" type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} required /></div>
        <div><label htmlFor="cf">Término</label><input id="cf" type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} required /></div>
        <div><label htmlFor="cv">Valor por dia (R$) — vazio usa o valor padrão</label><input id="cv" type="number" step="0.01" min="0" value={f.valorPorDia} onChange={(e) => setF({ ...f, valorPorDia: e.target.value })} /></div>
      </div>
      <label>Dias de transporte</label>
      <SeletorDias valor={dias} aoMudar={setDias} />
      <p className="sub" style={{ margin: '12px 0 0' }}>Mensalidade = dias por semana × valor por dia. Depois de criado, mudanças são feitas por aditivo.</p>
      {erro && <p role="alert" className="erro">{erro}</p>}
      <p><button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</button> <button type="button" className="btn sec" onClick={aoCancelar}>Cancelar</button></p>
    </form>
  );
}
