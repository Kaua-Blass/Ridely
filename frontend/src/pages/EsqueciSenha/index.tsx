import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthCard from '../../components/AuthCard/AuthCard';
import { useEnvio } from '../../lib/useEnvio';
import { pedirLink } from './api';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const { erro, ok, enviando, executar } = useEnvio();
  const enviar = (e: FormEvent) => { e.preventDefault(); executar(async () => (await pedirLink(email)).mensagem); };

  return (
    <AuthCard titulo="Esqueci minha senha" subtitulo="Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.">
      {ok ? <p className="sucesso" role="status">{ok}</p> : (
        <form onSubmit={enviar}>
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {erro && <p role="alert" className="erro">{erro}</p>}
          <p><button className="btn" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar link'}</button></p>
        </form>
      )}
      <p><Link to="/login">Voltar ao login</Link></p>
    </AuthCard>
  );
}
