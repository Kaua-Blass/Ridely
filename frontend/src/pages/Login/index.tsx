import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthCard from '../../components/AuthCard/AuthCard';
import { useAuth } from '../../lib/auth';
import { useEnvio } from '../../lib/useEnvio';

export default function Login() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const { erro, enviando, executar } = useEnvio();

  const enviar = (e: FormEvent) => { e.preventDefault(); executar(() => entrar(email, senha)); };

  return (
    <AuthCard titulo="Entrar" subtitulo="Acesse com seu e-mail e senha.">
      <form onSubmit={enviar}>
        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        <label htmlFor="senha">Senha</label>
        <input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
        {erro && <p role="alert" className="erro">{erro}</p>}
        <p><button className="btn" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button></p>
      </form>
      <p><Link to="/esqueci-senha">Esqueci minha senha</Link></p>
      <p>Ainda não tem conta? <Link to="/cadastro">Criar conta</Link></p>
    </AuthCard>
  );
}
