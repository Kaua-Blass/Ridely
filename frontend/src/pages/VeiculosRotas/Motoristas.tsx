import { FormEvent, useState } from 'react';
import DataTable from '../../components/DataTable/DataTable';
import { useEnvio } from '../../lib/useEnvio';
import { convidarMotorista, MotoristaAdm, reenviarMotorista, Visao } from './api';

interface Props { dados: Visao; pode: boolean; recarregar: () => Promise<void> }

/** Motorista não é associado: recebe um convite por e-mail e cria a própria senha. */
export default function Motoristas({ dados, pode, recarregar }: Props) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const { erro, ok, enviando, executar } = useEnvio();

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => { const r = await convidarMotorista(nome, email); await recarregar(); setNome(''); setEmail(''); setAberto(false); return r.mensagem; });
  };
  const veiculoDe = (id: number) => dados.veiculos.find((v) => v.motoristaId === id)?.nome ?? '—';

  return (
    <>
      {pode && !aberto && <p><button className="btn" onClick={() => setAberto(true)}>Convidar motorista</button></p>}
      {aberto && (
        <form className="card" onSubmit={enviar}>
          <h2>Convidar motorista</h2>
          <div className="grade">
            <div><label htmlFor="mn">Nome completo</label><input id="mn" value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
            <div><label htmlFor="me">E-mail</label><input id="me" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          </div>
          <p><button className="btn" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar convite'}</button> <button type="button" className="btn sec" onClick={() => setAberto(false)}>Cancelar</button></p>
        </form>
      )}
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      <div className="card">
        <p className="sub">O motorista vê a lista de passageiros e marca embarques. Para bloquear ou liberar o acesso, use Administração, em Usuários e perfis.</p>
        <DataTable<MotoristaAdm> itens={dados.motoristas} colunas={[
          { titulo: 'Nome', ordenar: (m) => m.nome, celula: (m) => m.nome },
          { titulo: 'E-mail', ordenar: (m) => m.email, celula: (m) => m.email },
          { titulo: 'Veículo', celula: (m) => veiculoDe(m.id) },
          { titulo: 'Situação', ordenar: (m) => (m.pendente ? 1 : m.ativo ? 0 : 2), celula: (m) => <span className={`tag ${m.ativo ? 'ok' : 'amb'}`}>{m.pendente ? 'Convite enviado' : m.ativo ? 'Ativo' : 'Bloqueado'}</span> },
          { titulo: '', celula: (m) => pode && m.pendente ? <button className="btn sec peq" onClick={() => executar(async () => { const r = await reenviarMotorista(m.id); return r.mensagem; })}>Reenviar convite</button> : null },
        ]} />
      </div>
    </>
  );
}
