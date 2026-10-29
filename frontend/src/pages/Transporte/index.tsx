import { useCallback, useEffect, useState } from 'react';
import Abas from '../../components/Abas/Abas';
import { useAuth } from '../../lib/auth';
import { dataBr } from '../../lib/formatar';
import { Alerta, alertas as carregarAlertas } from './api';
import ListaPassageiros from './ListaPassageiros';
import MinhasViagens from './MinhasViagens';
import Painel from './Painel';
import styles from './Transporte.module.css';

const EQUIPE = ['presidente', 'vice-presidente', 'auxiliar'];

/** Tela: Transporte. Reservas, lista de espera, lista de passageiros por veículo e lotação.
 *  API: backend/src/modules/transporte */
export default function Transporte() {
  const { usuario } = useAuth();
  const [versao, setVersao] = useState(0);
  const [avisos, setAvisos] = useState<Alerta[]>([]);
  const equipe = !!usuario && EQUIPE.includes(usuario.perfil);
  const motorista = usuario?.perfil === 'motorista';
  const reserva = !!usuario?.associadoId && !motorista;

  const abas = [...(reserva ? ['Minhas viagens'] : []), ...(equipe || motorista ? ['Lista de passageiros'] : []), ...(equipe ? ['Painel'] : [])];
  const [aba, setAba] = useState(abas[0]);
  const carregarAvisos = useCallback(() => { if (equipe) carregarAlertas().then(setAvisos).catch(() => setAvisos([])); }, [equipe]);
  useEffect(() => { carregarAvisos(); }, [carregarAvisos, versao]);
  if (!usuario) return null;
  const mudou = () => setVersao((v) => v + 1);

  return (
    <section>
      <h1 className={styles.titulo}>Transporte</h1>
      <p className={styles.sub}>A rota é definida pela instituição e pelo ponto de embarque. O veículo é distribuído automaticamente e a equipe pode mover passageiros.</p>
      {avisos.length > 0 && (
        <div className="card" role="status" style={{ borderColor: 'var(--alerta)' }}>
          <h2>Atenção: lotação</h2>
          {avisos.map((a) => (
            <p key={`${a.data}-${a.rotaId}`} style={{ margin: '4px 0' }}>
              <b>{a.rota}</b> em {dataBr(a.data)}: {a.confirmadas} de {a.capacidade} lugares{a.espera ? `, ${a.espera} na lista de espera` : ''}.
            </p>
          ))}
          <p className="sub" style={{ margin: '8px 0 0' }}>Se for recorrente, inclua outro veículo em Veículos e rotas: a lista de espera é confirmada sozinha.</p>
        </div>
      )}
      <Abas abas={abas} ativa={aba} aoMudar={setAba} />
      {aba === 'Minhas viagens' && <MinhasViagens onMudou={mudou} />}
      {aba === 'Lista de passageiros' && <ListaPassageiros equipe={equipe} versao={versao} onMudou={mudou} />}
      {aba === 'Painel' && <Painel versao={versao} />}
    </section>
  );
}
