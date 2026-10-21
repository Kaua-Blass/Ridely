import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthCard from '../../components/AuthCard/AuthCard';
import { useEnvio } from '../../lib/useEnvio';
import { redefinir } from './api';

export default function RedefinirSenha() {
  const token = useSearchParams()[0].get('token') ?? '';
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const { erro, ok, enviando, executar } = useEnvio();
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => {
      if (senha !== confirmar) throw new Error('A confirmação da senha não confere.');
      return (await redefinir(token, senha)).mensagem;
    });
  };

  return (
    <AuthCard titulo="Nova senha" subtitulo="Escolha uma senha com pelo menos 8 caracteres.">
      {!token ? <p className="erro">Link inválido. Peça um novo em “Esqueci minha senha”.</p> : ok ? (
        <p className="sucesso" role="status">{ok}</p>
      ) : (
        <form onSubmit={enviar}>
          <label htmlFor="senha">Nova senha</label>
          <input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" minLength={8} required />
          <label htmlFor="conf">Confirmar nova senha</label>
          <input id="conf" type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" required />
          {erro && <p role="alert" className="erro">{erro}</p>}
          <p><button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar nova senha'}</button></p>
        </form>
      )}
      <p><Link to="/login">Ir para o login</Link></p>
    </AuthCard>
  );
}
