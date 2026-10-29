import { useSearchParams } from 'react-router-dom';
import Abas from '../../components/Abas/Abas';
import { useAuth } from '../../lib/auth';
import { podeEscrever } from '../../lib/permissoes';
import styles from './Comunicacao.module.css';
import Comunicados from './Comunicados';
import Notificacoes from './Notificacoes';
import Rotinas from './Rotinas';

const ABAS = ['Comunicados', 'Notificações'];
const ABA_ROTINAS = 'Rotinas automáticas';

/** Tela: Comunicação. Comunicados com anexo, notificações do painel e rotinas automáticas.
 *  Publicam presidente, vice e tesoureiro (este só Cobrança e Aviso). A aba vem da URL (?aba=), usada pelos links das notificações e pelo sino.
 *  API: backend/src/modules/comunicacao */
export default function Comunicacao() {
  const { usuario } = useAuth();
  const [params, setParams] = useSearchParams();
  const gerente = podeEscrever('comunicacao', usuario!.perfil);
  const abas = gerente ? [...ABAS, ABA_ROTINAS] : ABAS;
  const pedida = params.get('aba') ?? '';
  const aba = abas.includes(pedida) ? pedida : abas[0];
  return (
    <section>
      <h1 className={styles.titulo}>Comunicação</h1>
      <p className={styles.sub}>Comunicados da associação, suas notificações e os avisos automáticos de vencimento, atraso e contrato.</p>
      <Abas abas={abas} ativa={aba} aoMudar={(a) => setParams({ aba: a })} />
      {aba === 'Comunicados' && <Comunicados gerente={gerente} />}
      {aba === 'Notificações' && <Notificacoes />}
      {aba === ABA_ROTINAS && <Rotinas />}
    </section>
  );
}
