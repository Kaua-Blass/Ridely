import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { executarRotina, rotinas } from './api';
import styles from './Comunicacao.module.css';
import type { SituacaoRotinas } from './types';

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
const ROTULO_BOTAO: Record<string, string> = { 'cobranca-atrasados': 'Notificar atrasados agora' };

export default function Rotinas() {
  const { usuario } = useAuth();
  const [dados, setDados] = useState<SituacaoRotinas | null>(null);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [rodando, setRodando] = useState('');

  const carregar = useCallback(() => rotinas().then(setDados).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);

  const rodar = async (id: string) => {
    setRodando(id); setErro('');
    try { const r = await executarRotina(id); setMsg((m) => ({ ...m, [id]: r.mensagem })); await carregar(); }
    catch (e) { setMsg((m) => ({ ...m, [id]: '' })); setErro((e as Error).message); }
    finally { setRodando(''); }
  };

  if (!dados) return <div className="card">{erro ? <p role="alert" className="erro">{erro}</p> : 'Carregando…'}</div>;
  const p = dados.parametros;
  return (
    <div className="card">
      <h2>Rotinas automáticas</h2>
      <p className="sub">Agendamento: {dados.agendamento}. Cada pessoa é avisada uma única vez por motivo: rodar de novo não repete aviso.</p>
      {!dados.smtpConfigurado && (
        <p className={styles.aviso}>O envio de e-mail não está configurado (<code>SMTP_URL</code> vazio): as notificações aparecem no painel, mas os e-mails só são escritos no log do servidor.</p>
      )}
      <p className="sub">
        Em vigor: lembrete {p.lembreteVencimentoDias > 0 ? `${p.lembreteVencimentoDias} dia(s) antes do vencimento` : 'desligado'}; cobrança {p.cobrancaIntervaloDias > 0 ? `a cada ${p.cobrancaIntervaloDias} dia(s) de atraso` : 'desligada'}; contratos avisados {p.alertaRenovacaoDias} dia(s) antes do fim.{' '}
        {usuario?.perfil === 'presidente' ? <Link to="/administracao">Alterar em Administração › Parâmetros.</Link> : 'Quem altera é o presidente, em Administração › Parâmetros.'}
      </p>
      {erro && <p role="alert" className="erro">{erro}</p>}
      <table>
        <thead><tr><th>Rotina</th><th>Última execução</th><th /></tr></thead>
        <tbody>
          {dados.rotinas.map((r) => (
            <tr key={r.id}>
              <td><b>{r.nome}</b><br /><span className={styles.entregas}>{r.descricao}</span></td>
              <td>
                {r.ultima ? (
                  <>{quando(r.ultima.iniciadaEm)} ({r.ultima.origem === 'agendada' ? 'automática' : 'manual'})<br />
                    {r.ultima.erro ? <span className={styles.falha}>Falhou: {r.ultima.erro}</span> : <span className={styles.entregas}>{r.ultima.criadas} feita(s), {r.ultima.ignoradas} já enviada(s)/pendente(s)</span>}</>
                ) : <span className={styles.entregas}>Ainda não executada</span>}
                {msg[r.id] && <><br /><span role="status" className="sucesso">{msg[r.id]}</span></>}
              </td>
              <td><button className="btn sec peq" disabled={!!rodando} onClick={() => rodar(r.id)}>{rodando === r.id ? 'Executando…' : ROTULO_BOTAO[r.id] ?? 'Executar agora'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
