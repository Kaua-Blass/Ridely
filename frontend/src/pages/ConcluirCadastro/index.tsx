import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthCard from '../../components/AuthCard/AuthCard';
import { useEnvio } from '../../lib/useEnvio';
import { concluir } from './api';

/** Aberta pelo link do e-mail de convite enviado pela presidência. */
export default function ConcluirCadastro() {
  const token = useSearchParams()[0].get('token') ?? '';
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [telefone, setTelefone] = useState('');
  const { erro, ok, enviando, executar } = useEnvio();
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => {
      if (senha !== confirmar) throw new Error('A confirmação da senha não confere.');
      return (await concluir(token, senha, telefone || undefined)).mensagem;
    });
  };

  return (
    <AuthCard titulo="Concluir cadastro" subtitulo="Você foi convidado(a). Crie sua senha para acessar o Ridely.">
      {!token ? <p className="erro">Link inválido. Peça um novo convite à presidência.</p> : ok ? (
        <><p className="sucesso" role="status">{ok}</p><p><Link to="/login">Entrar</Link></p></>
      ) : (
        <form onSubmit={enviar}>
          <label htmlFor="tel">Telefone (opcional)</label>
          <input id="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          <label htmlFor="senha">Senha (mínimo 8 caracteres)</label>
          <input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" minLength={8} required />
          <label htmlFor="conf">Confirmar senha</label>
          <input id="conf" type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" required />
          {erro && <p role="alert" className="erro">{erro}</p>}
          <p><button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Concluir cadastro'}</button></p>
        </form>
      )}
    </AuthCard>
  );
}
