import { useEffect, useState } from 'react';
import { dataBr } from '../../lib/formatar';
import { LinhaPainel, painel } from './api';

/** Lotação dos próximos 15 dias. Lotada ou com fila de espera pede atenção: talvez falte um veículo. */
export default function Painel({ versao }: { versao: number }) {
  const [l, setL] = useState<LinhaPainel[] | null>(null);
  useEffect(() => { painel().then(setL); }, [versao]);
  if (!l) return <p>Carregando…</p>;
  return (
    <div className="card">
      <h2>Lotação por dia e rota</h2>
      {l.length === 0 ? <p>Ainda não há reservas nos próximos dias.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Dia</th><th>Rota</th><th>Confirmados</th><th>Capacidade</th><th>Vagas</th><th>Lista de espera</th><th>Cancelados</th><th>Embarcaram</th><th>Faltaram</th><th /></tr></thead>
            <tbody>{l.map((x) => (
              <tr key={`${x.data}-${x.rotaId}`}>
                <td>{dataBr(x.data)}</td><td>{x.rota}</td><td>{x.confirmadas}</td><td>{x.capacidade}</td><td>{x.vagas}</td><td>{x.espera}</td><td>{x.canceladas}</td><td>{x.embarcaram}</td><td>{x.faltaram}</td>
                <td>{x.precisaDeVeiculo ? <span className="tag amb">Fila: considere outro veículo</span> : x.lotada ? <span className="tag amb">Lotada</span> : <span className="tag ok">Ok</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
