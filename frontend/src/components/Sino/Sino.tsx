import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { resumoNotificacoes } from '../../pages/Comunicacao/api';
import styles from './Sino.module.css';

/** Contador de notificações não lidas no menu. Atualiza a cada minuto, ao voltar para a aba e quando a tela de notificações marca algo como lido. */
export default function Sino() {
  const [n, setN] = useState(0);
  const atualizar = useCallback(() => { resumoNotificacoes().then((r) => setN(r.naoLidas)).catch(() => undefined); }, []);
  useEffect(() => {
    atualizar();
    const t = setInterval(atualizar, 60_000);
    window.addEventListener('ridely:notificacoes', atualizar);
    window.addEventListener('focus', atualizar);
    return () => { clearInterval(t); window.removeEventListener('ridely:notificacoes', atualizar); window.removeEventListener('focus', atualizar); };
  }, [atualizar]);
  return (
    <NavLink to="/comunicacao?aba=Notificações" className={styles.sino} aria-label={n ? `${n} notificações novas` : 'Notificações'} title="Notificações">
      <span aria-hidden="true">🔔</span>
      {n > 0 && <b className={styles.contador}>{n > 99 ? '99+' : n}</b>}
    </NavLink>
  );
}
