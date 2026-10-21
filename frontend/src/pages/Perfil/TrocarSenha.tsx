import { FormEvent, useState } from 'react';
import { useEnvio } from '../../lib/useEnvio';
import { trocarSenha } from './api';

export default function TrocarSenha() {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const { erro, ok, enviando, executar } = useEnvio();
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => {
      if (nova !== confirmar) throw new Error('A confirmação da nova senha não confere.');
      const r = await trocarSenha(atual, nova);
      setAtual(''); setNova(''); setConfirmar('');
      return r.mensagem;
    });
  };
  return (
    <form className="card" onSubmit={enviar}>
      <h2>Alterar senha</h2>
      <div className="grade">
        <div><label htmlFor="sa">Senha atual</label><input id="sa" type="password" value={atual} onChange={(e) => setAtual(e.target.value)} autoComplete="current-password" required /></div>
        <div><label htmlFor="sn">Nova senha (mínimo 8 caracteres)</label><input id="sn" type="password" value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password" minLength={8} required /></div>
        <div><label htmlFor="sc">Confirmar nova senha</label><input id="sc" type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" required /></div>
      </div>
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      <p><button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Alterar senha'}</button></p>
    </form>
  );
}
