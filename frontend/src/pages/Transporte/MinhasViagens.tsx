import { useCallback, useEffect, useState } from 'react';
import { dataBr, diasTexto } from '../../lib/formatar';
import { useEnvio } from '../../lib/useEnvio';
import { cancelar, Minhas, minhas as carregarMinhas, StatusReserva } from './api';
import ReservaForm from './ReservaForm';

const ROTULO: Record<StatusReserva, string> = { confirmada: 'Confirmada', espera: 'Lista de espera', embarcou: 'Embarcou', faltou: 'Não compareceu', cancelada: 'Cancelada' };
const COR: Record<StatusReserva, string> = { confirmada: 'ok', espera: 'amb', embarcou: 'ok', faltou: 'amb', cancelada: '' };
const diaSemana = (iso: string) => diasTexto([new Date(`${iso}T12:00:00Z`).getUTCDay()]);

export default function MinhasViagens({ onMudou }: { onMudou: () => void }) {
  const [m, setM] = useState<Minhas | null>(null);
  const [reservando, setReservando] = useState<string | null>(null);
  const { erro, ok, executar } = useEnvio();
  const carregar = useCallback(async () => { setM(await carregarMinhas()); }, []);
  useEffect(() => { carregar(); }, [carregar]);
  if (!m) return <p>Carregando…</p>;

  const depois = async (msg: string) => { setReservando(null); await carregar(); onMudou(); executar(async () => msg); };
  const cancela = (id: number, data: string) => {
    if (window.confirm(`Cancelar a viagem de ${dataBr(data)}?`)) executar(async () => { const r = await cancelar(id); await carregar(); onMudou(); return r.mensagem; });
  };

  return (
    <>
      <p className="sub">Reserve ou cancele até as {m.horaLimite}h do próprio dia da viagem. Só vale para os dias do seu contrato. Se a van estiver lotada, você entra na lista de espera e a vaga é confirmada sozinha quando alguém cancelar.</p>
      {reservando && <ReservaForm data={reservando} padrao={m.padrao} aoConcluir={depois} aoCancelar={() => setReservando(null)} />}
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      <div className="card">
        <h2>Próximos dias</h2>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Dia</th><th>Situação</th><th>Rota e veículo</th><th>Vagas</th><th /></tr></thead>
            <tbody>{m.dias.map((d) => (
              <tr key={d.data}>
                <td>{dataBr(d.data)} <span className="sub">{diaSemana(d.data)}</span></td>
                <td>{d.reserva
                  ? <><span className={`tag ${COR[d.reserva.status]}`}>{ROTULO[d.reserva.status]}</span>{d.reserva.posicao && <> <span className="sub">posição {d.reserva.posicao}</span></>}</>
                  : !d.permitido ? <span className="sub">{d.motivo}</span> : d.prazoAberto ? <span className="tag">Sem reserva</span> : <span className="sub">Prazo encerrado</span>}</td>
                <td>{d.reserva ? `${d.reserva.rota}${d.reserva.veiculo ? ` · ${d.reserva.veiculo}` : ''}` : '—'}</td>
                <td>{!d.reserva && d.permitido && d.vagas != null ? (d.vagas > 0 ? `${d.vagas} livre(s)` : 'Lotada: lista de espera') : '—'}</td>
                <td>
                  {d.reserva && (d.reserva.status === 'confirmada' || d.reserva.status === 'espera') && d.prazoAberto && <button className="btn sec peq" onClick={() => cancela(d.reserva!.id, d.data)}>Cancelar</button>}
                  {!d.reserva && d.permitido && d.prazoAberto && <button className="btn peq" onClick={() => setReservando(d.data)}>Reservar</button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h2>Histórico (últimos 60 dias)</h2>
        {m.historico.length === 0 ? <p>Nenhuma viagem no período.</p> : (
          <table>
            <thead><tr><th>Dia</th><th>Rota</th><th>Situação</th></tr></thead>
            <tbody>{m.historico.map((h) => <tr key={h.id}><td>{dataBr(h.data)}</td><td>{h.rota}</td><td><span className={`tag ${COR[h.status]}`}>{ROTULO[h.status]}</span></td></tr>)}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
