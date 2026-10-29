import { useCallback, useEffect, useState } from 'react';
import { dataBr, hojeIso } from '../../lib/formatar';
import { useEnvio } from '../../lib/useEnvio';
import { Lista, lista as carregarLista, marcar, moverVeiculo, Passageiro, StatusReserva } from './api';

const ROTULO: Record<StatusReserva, string> = { confirmada: 'Confirmado', espera: 'Lista de espera', embarcou: 'Embarcou', faltou: 'Não compareceu', cancelada: 'Cancelada' };

/** Lista para o motorista e a equipe: por veículo, na ordem das paradas. O motorista vê só o próprio veículo. */
export default function ListaPassageiros({ equipe, versao, onMudou }: { equipe: boolean; versao: number; onMudou: () => void }) {
  const [data, setData] = useState(hojeIso());
  const [rotaId, setRotaId] = useState<number | undefined>();
  const [l, setL] = useState<Lista | null>(null);
  const { erro, ok, executar } = useEnvio();
  const carregar = useCallback(async () => {
    try { const r = await carregarLista(data, rotaId); setL(r); if (rotaId == null) setRotaId(r.rota.id); } catch (e) { setL(null); executar(async () => { throw e; }); }
  }, [data, rotaId, executar]);
  useEffect(() => { carregar(); }, [carregar, versao]);

  const agir = (fn: () => Promise<{ mensagem: string }>) => executar(async () => { const r = await fn(); await carregar(); onMudou(); return r.mensagem; });
  const futuro = data > hojeIso();

  const linhaPassageiro = (p: Passageiro, veiculoId?: number) => (
    <tr key={p.id}>
      <td>{p.associado}</td><td>{p.instituicao ?? '—'}</td><td>{p.ponto ?? '—'}</td>
      <td><span className={`tag ${p.status === 'embarcou' ? 'ok' : p.status === 'faltou' ? 'amb' : ''}`}>{ROTULO[p.status]}</span></td>
      <td>
        {p.status !== 'espera' && <>
          {p.status !== 'embarcou' && <button className="btn peq" disabled={futuro} onClick={() => agir(() => marcar(p.id, 'embarcou'))}>Embarcou</button>}{' '}
          {p.status !== 'faltou' && <button className="btn sec peq" disabled={futuro} onClick={() => agir(() => marcar(p.id, 'faltou'))}>Faltou</button>}{' '}
          {p.status !== 'confirmada' && <button className="btn sec peq" onClick={() => agir(() => marcar(p.id, 'confirmada'))}>Desfazer</button>}
        </>}
        {equipe && l && l.veiculos.length > 1 && p.status !== 'espera' && (
          <select aria-label={`Veículo de ${p.associado}`} value={veiculoId ?? ''} style={{ width: 'auto', marginLeft: 6 }} onChange={(e) => e.target.value && agir(() => moverVeiculo(p.id, Number(e.target.value)))}>
            <option value="">Mover para…</option>{l.veiculos.filter((v) => v.id !== veiculoId).map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        )}
      </td>
    </tr>
  );
  const tabela = (ps: Passageiro[], veiculoId?: number) => ps.length === 0 ? <p className="sub">Nenhum passageiro.</p> : (
    <div style={{ overflowX: 'auto' }}>
      <table><thead><tr><th>Estudante</th><th>Instituição</th><th>Ponto de embarque</th><th>Situação</th><th /></tr></thead><tbody>{ps.map((p) => linhaPassageiro(p, veiculoId))}</tbody></table>
    </div>
  );

  return (
    <>
      <div className="card">
        <div className="grade">
          <div><label htmlFor="ld">Data da viagem</label><input id="ld" type="date" value={data} onChange={(e) => { setData(e.target.value); }} /></div>
          <div><label htmlFor="lr">Rota</label><select id="lr" value={rotaId ?? ''} onChange={(e) => setRotaId(Number(e.target.value))}>{l?.rotas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></div>
        </div>
        <p><button className="btn sec" onClick={() => window.print()}>Imprimir</button></p>
        {futuro && <p className="sub">Embarque e falta só podem ser marcados no dia da viagem.</p>}
      </div>
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      {l && (
        <>
          <h2>{l.rota.nome} · {dataBr(l.data)}{l.capacidade != null && <> · {l.confirmadas} de {l.capacidade} lugares</>}</h2>
          {l.veiculos.length === 0 && <div className="card">Nenhum veículo desta rota está vinculado a você.</div>}
          {l.veiculos.map((v) => (
            <div className="card" key={v.id}>
              <h2>{v.nome} · {v.placa} <span className="sub">({v.passageiros.length}/{v.capacidade}){v.motorista ? ` · ${v.motorista}` : ''}</span></h2>
              {tabela(v.passageiros, v.id)}
            </div>
          ))}
          {l.semVeiculo && l.semVeiculo.length > 0 && <div className="card"><h2>Sem veículo definido</h2>{tabela(l.semVeiculo)}</div>}
          {l.espera && l.espera.length > 0 && (
            <div className="card">
              <h2>Lista de espera</h2>
              <p className="sub">Na ordem de chegada. Entram sozinhos quando alguém cancela ou quando um veículo é incluído.</p>
              <ol style={{ margin: 0, paddingLeft: 20 }}>{l.espera.map((p) => <li key={p.id}>{p.associado} <span className="sub">· {p.ponto}</span></li>)}</ol>
            </div>
          )}
          {l.canceladas ? <p className="sub">{l.canceladas} reserva(s) cancelada(s) neste dia.</p> : null}
        </>
      )}
    </>
  );
}
