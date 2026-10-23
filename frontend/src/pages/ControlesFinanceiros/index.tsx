import { useState } from 'react';
import Abas from '../../components/Abas/Abas';
import { useAuth } from '../../lib/auth';
import { podeEscrever } from '../../lib/permissoes';
import Contas from './Contas';
import Movimentacoes from './Movimentacoes';
import VisaoGeral from './VisaoGeral';
import styles from './ControlesFinanceiros.module.css';

const ABAS = ['Visão geral', 'Movimentações', 'Contas'];

/** Tela: Controles financeiros. Caixa e bancos: saldos, receitas, despesas, transferências e estornos.
 *  API: backend/src/modules/controles-financeiros */
export default function ControlesFinanceiros() {
  const { usuario } = useAuth();
  const [aba, setAba] = useState(ABAS[0]);
  const [versao, setVersao] = useState(0); // muda a cada operação, para as outras abas recarregarem
  if (!usuario) return null;
  const escreve = podeEscrever('controles-financeiros', usuario.perfil);
  const mudou = () => setVersao((v) => v + 1);
  return (
    <section>
      <h1 className={styles.titulo}>Controles financeiros</h1>
      <p className={styles.sub}>Regime de caixa: o saldo vem das movimentações. Nada é apagado: correções entram como estorno.</p>
      <Abas abas={ABAS} ativa={aba} aoMudar={setAba} />
      {aba === ABAS[0] && <VisaoGeral versao={versao} />}
      {aba === ABAS[1] && <Movimentacoes escreve={escreve} versao={versao} aoMudar={mudou} />}
      {aba === ABAS[2] && <Contas escreve={escreve} versao={versao} aoMudar={mudou} />}
    </section>
  );
}
