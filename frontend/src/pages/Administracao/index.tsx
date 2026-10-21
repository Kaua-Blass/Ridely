import { useState } from 'react';
import Abas from '../../components/Abas/Abas';
import Auditoria from './Auditoria';
import Parametros from './Parametros';
import Solicitacoes from './Solicitacoes';
import Usuarios from './Usuarios';
import styles from './Administracao.module.css';

const ABAS = ['Solicitações', 'Usuários e perfis', 'Parâmetros', 'Auditoria'];

/** Tela: Administração (só o presidente). API: backend/src/modules/administracao */
export default function Administracao() {
  const [aba, setAba] = useState(ABAS[0]);
  return (
    <section>
      <h1 className={styles.titulo}>Administração</h1>
      <p className={styles.sub}>Aprovações, acessos, valores e histórico de operações.</p>
      <Abas abas={ABAS} ativa={aba} aoMudar={setAba} />
      {aba === ABAS[0] && <Solicitacoes />}
      {aba === ABAS[1] && <Usuarios />}
      {aba === ABAS[2] && <Parametros />}
      {aba === ABAS[3] && <Auditoria />}
    </section>
  );
}
