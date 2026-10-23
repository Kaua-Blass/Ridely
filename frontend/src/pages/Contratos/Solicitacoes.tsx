import { FormEvent, useEffect, useState } from 'react';
import SeletorDias from '../../components/SeletorDias/SeletorDias';
import { dataBr, diasTexto, hojeIso } from '../../lib/formatar';
import { useEnvio } from '../../lib/useEnvio';
import { ContratoItem, decidir, Solicitacao, solicitacoes, solicitar } from './api';

interface Props { escreve: boolean; ehAssociado: boolean; contratos: ContratoItem[]; alvo: ContratoItem | null; aoMudar: () => void; aoFecharAlvo: () => void }

const ROTULO = { pendente: 'Pendente', aprovada: 'Aprovada', rejeitada: 'Rejeitada' } as const;

export default function Solicitacoes({ escreve, ehAssociado, contratos, alvo, aoMudar, aoFecharAlvo }: Props) {
  const [lista, setLista] = useState<Solicitacao[]>([]);
  const [dias, setDias] = useState<number[]>(alvo?.diasAtuais ?? []);
  const [desde, setDesde] = useState(hojeIso());
  const [obs, setObs] = useState('');
  const { erro, ok, enviando, executar } = useEnvio();
  const carregar = () => solicitacoes().then(setLista);
  useEffect(() => { carregar(); }, []);
  useEffect(() => { if (alvo) setDias(alvo.diasAtuais); }, [alvo]);
  const nomeContrato = (id: number) => contratos.find((c) => c.id === id)?.associado ?? `#${id}`;

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!alvo) return;
    executar(async () => {
      if (!dias.length) throw new Error('Escolha ao menos um dia da semana.');
      const r = await solicitar({ contratoId: alvo.id, novosDias: dias, vigenciaAPartir: desde, observacao: obs || undefined });
      await carregar(); aoMudar(); aoFecharAlvo(); setObs('');
      return r.mensagem;
    });
  };
  const decide = (s: Solicitacao, aprovar: boolean) => {
    const motivo = aprovar ? undefined : window.prompt('Motivo da rejeição (opcional):') ?? undefined;
    executar(async () => { const r = await decidir(s.id, aprovar, motivo); await carregar(); aoMudar(); return r.mensagem; });
  };

  return (
    <>
      {ehAssociado && alvo && (
        <form className="card" onSubmit={enviar}>
          <h2>Solicitar alteração de dias · contrato até {dataBr(alvo.fim)}</h2>
          <p className="sub">Hoje: {diasTexto(alvo.diasAtuais)}. O contrato só muda depois que a associação aprovar.</p>
          <label>Novos dias de transporte</label>
          <SeletorDias valor={dias} aoMudar={setDias} />
          <div className="grade">
            <div><label htmlFor="sd">Valer a partir de</label><input id="sd" type="date" min={hojeIso()} max={alvo.fim} value={desde} onChange={(e) => setDesde(e.target.value)} required /></div>
            <div><label htmlFor="so">Observação (opcional)</label><input id="so" value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} /></div>
          </div>
          <p><button className="btn" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar solicitação'}</button> <button type="button" className="btn sec" onClick={aoFecharAlvo}>Cancelar</button></p>
        </form>
      )}
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      <div className="card">
        <h2>{escreve ? 'Solicitações pendentes' : 'Minhas solicitações'}</h2>
        {lista.length === 0 ? <p>Nenhuma solicitação.</p> : (
          <table>
            <thead><tr><th>Associado</th><th>Novos dias</th><th>A partir de</th><th>Observação</th><th>Situação</th><th /></tr></thead>
            <tbody>{lista.map((s) => (
              <tr key={s.id}>
                <td>{s.associado}<br /><span className="sub">{nomeContrato(s.dados.contratoId)}</span></td>
                <td>{diasTexto(s.dados.novosDias)}</td><td>{dataBr(s.dados.vigenciaAPartir)}</td><td>{s.dados.observacao ?? '—'}{s.dados.motivo ? <><br /><span className="sub">Motivo: {s.dados.motivo}</span></> : null}</td>
                <td><span className={`tag ${s.status === 'aprovada' ? 'ok' : 'amb'}`}>{ROTULO[s.status]}</span></td>
                <td>{escreve && s.status === 'pendente' && <><button className="btn peq" onClick={() => decide(s, true)}>Aprovar</button> <button className="btn sec peq" onClick={() => decide(s, false)}>Rejeitar</button></>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
