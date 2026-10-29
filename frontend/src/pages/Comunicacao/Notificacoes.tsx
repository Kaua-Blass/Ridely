import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { atualizarSino, marcarLida, marcarTodasLidas, notificacoes } from './api';
import styles from './Comunicacao.module.css';
import type { Notificacao, PaginaNotificacoes } from './types';

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

export default function Notificacoes() {
  const navegar = useNavigate();
  const [dados, setDados] = useState<PaginaNotificacoes | null>(null);
  const [pagina, setPagina] = useState(1);
  const [soNovas, setSoNovas] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(() => notificacoes(pagina, soNovas).then(setDados).catch((e) => setErro(e.message)), [pagina, soNovas]);
  useEffect(() => { carregar(); }, [carregar]);

  const abrir = async (n: Notificacao) => {
    try { if (!n.lida) { await marcarLida(n.id); atualizarSino(); } } catch { /* abrir o link importa mais que marcar */ }
    if (n.link) navegar(n.link); else carregar();
  };
  const todas = async () => { try { await marcarTodasLidas(); atualizarSino(); carregar(); } catch (e) { setErro((e as Error).message); } };
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1;

  return (
    <div className="card">
      <div className={styles.topo}>
        <h2>Minhas notificações {dados ? <small>({dados.naoLidas} {dados.naoLidas === 1 ? 'nova' : 'novas'})</small> : null}</h2>
        <div className={styles.acoes} style={{ marginTop: 0 }}>
          <label className="opcao" style={{ margin: 0 }}><input type="checkbox" checked={soNovas} onChange={(e) => { setSoNovas(e.target.checked); setPagina(1); }} /> Só as novas</label>
          <button className="btn sec peq" disabled={!dados?.naoLidas} onClick={todas}>Marcar todas como lidas</button>
        </div>
      </div>
      {erro && <p role="alert" className="erro">{erro}</p>}
      {dados && dados.itens.length === 0 && <p className={styles.vazio}>{soNovas ? 'Nenhuma notificação nova.' : 'Você ainda não recebeu notificações.'}</p>}
      {dados?.itens.map((n) => (
        <button key={n.id} className={`${styles.notif} ${n.lida ? '' : styles.nova}`} onClick={() => abrir(n)}>
          <b>{n.titulo}</b>
          <span>{n.mensagem}</span>
          <small>{quando(n.criadaEm)}</small>
        </button>
      ))}
      {dados && paginas > 1 && (
        <div className={styles.paginacao}>
          <button className="btn sec peq" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anteriores</button>
          <span>Página {pagina} de {paginas}</span>
          <button className="btn sec peq" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Próximas</button>
        </div>
      )}
    </div>
  );
}
