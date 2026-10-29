import { FormEvent, useState } from 'react';
import { useEnvio } from '../../lib/useEnvio';
import { trocarEmail } from './api';

export default function TrocarEmail({ emailAtual }: { emailAtual: string }) {
  const [novo, setNovo] = useState('');
  const [senha, setSenha] = useState('');
  const { erro, ok, enviando, executar } = useEnvio();
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => { const r = await trocarEmail(novo, senha); setNovo(''); setSenha(''); return r.mensagem; });
  };
  return (
    <form className="card" onSubmit={enviar}>
      <h2>E-mail</h2>
      <p className="sub" style={{ margin: 0 }}>E-mail atual: <b>{emailAtual}</b>. O novo endereço só vale depois de confirmado pelo link que enviamos para ele.</p>
      <div className="grade">
        <div><label htmlFor="ne">Novo e-mail</label><input id="ne" type="email" value={novo} onChange={(e) => setNovo(e.target.value)} required /></div>
        <div><label htmlFor="se">Senha atual</label><input id="se" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required /></div>
      </div>
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      <p><button className="btn" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar link de confirmação'}</button></p>
    </form>
  );
}
