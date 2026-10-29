import { useCallback, useEffect, useState } from 'react';
import Abas from '../../components/Abas/Abas';
import { useAuth } from '../../lib/auth';
import { podeEscrever } from '../../lib/permissoes';
import { visao, Visao } from './api';
import Instituicoes from './Instituicoes';
import Motoristas from './Motoristas';
import Rotas from './Rotas';
import Veiculos from './Veiculos';
import styles from './VeiculosRotas.module.css';

const ABAS = ['Veículos', 'Rotas', 'Instituições', 'Motoristas'];

/** Tela: Veículos e rotas. Cadastro de veículos, rotas (paradas e instituições), instituições e motoristas.
 *  API: backend/src/modules/veiculos-rotas */
export default function VeiculosRotas() {
  const { usuario } = useAuth();
  const [aba, setAba] = useState(ABAS[0]);
  const [dados, setDados] = useState<Visao | null>(null);
  const recarregar = useCallback(async () => { setDados(await visao()); }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  if (!dados || !usuario) return <p>Carregando…</p>;
  const props = { dados, recarregar, pode: podeEscrever('veiculos-rotas', usuario.perfil) };

  return (
    <section>
      <h1 className={styles.titulo}>Veículos e rotas</h1>
      <p className={styles.sub}>Veículos ficam em uma rota; a rota define as paradas e as instituições atendidas.</p>
      <Abas abas={ABAS} ativa={aba} aoMudar={setAba} />
      {aba === ABAS[0] && <Veiculos {...props} />}
      {aba === ABAS[1] && <Rotas {...props} />}
      {aba === ABAS[2] && <Instituicoes {...props} />}
      {aba === ABAS[3] && <Motoristas {...props} />}
    </section>
  );
}
