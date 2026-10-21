import { useEffect, useState } from 'react';
import { useEnvio } from '../../lib/useEnvio';
import { decidir, Solicitacao, solicitacoes } from './api';
import styles from './Administracao.module.css';

/** Tela: Administração. Por enquanto: aprovação de pedidos de cadastro.
 *  API: backend/src/modules/administracao */
export default function Administracao() {
  const [lista, setLista] = useState<Solicitacao[]>([]);
  const { erro, ok, executar } = useEnvio();
  const carregar = () => solicitacoes().then(setLista);
  useEffect(() => { carregar(); }, []);
  const decide = (id: number, aprovar: boolean) => executar(async () => { const r = await decidir(id, aprovar); await carregar(); return r.mensagem; });

  return (
    <section>
      <h1 className={styles.titulo}>Administração</h1>
      <p className="sub">Pedidos de cadastro aguardando a presidência.</p>
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      <div className="card">
        {lista.length === 0 ? <p>Nenhum pedido pendente.</p> : (
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>E-mail confirmado</th><th /></tr></thead>
            <tbody>{lista.map((s) => (
              <tr key={s.id}>
                <td>{s.dados.nome}</td><td>{s.dados.email}</td><td>{s.dados.telefone ?? '—'}</td>
                <td><span className={`tag ${s.emailVerificado ? 'ok' : 'amb'}`}>{s.emailVerificado ? 'Sim' : 'Não'}</span></td>
                <td><button className="btn peq" onClick={() => decide(s.id, true)}>Aprovar</button> <button className="btn sec peq" onClick={() => decide(s.id, false)}>Rejeitar</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </section>
  );
}
