import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthCard from '../../components/AuthCard/AuthCard';
import { useEnvio } from '../../lib/useEnvio';
import { cadastrar, Instituicao, instituicoes } from './api';

export default function Cadastro() {
  const [f, setF] = useState({ nome: '', email: '', cpf: '', telefone: '', instituicaoId: '', senha: '', confirmar: '' });
  const [lista, setLista] = useState<Instituicao[]>([]);
  const { erro, ok, enviando, executar } = useEnvio();
  useEffect(() => { instituicoes().then(setLista).catch(() => setLista([])); }, []);
  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => {
      if (f.senha !== f.confirmar) throw new Error('A confirmação da senha não confere.');
      const r = await cadastrar({ nome: f.nome, email: f.email, cpf: f.cpf || undefined, telefone: f.telefone || undefined, instituicaoId: Number(f.instituicaoId), senha: f.senha });
      return r.mensagem;
    });
  };

  return (
    <AuthCard titulo="Criar conta" subtitulo="Sua conta passa pela aprovação da presidência antes de liberar o acesso.">
      {ok ? <><p className="sucesso" role="status">{ok}</p><p><Link to="/login">Voltar ao login</Link></p></> : (
        <form onSubmit={enviar}>
          <label htmlFor="nome">Nome completo</label><input id="nome" {...campo('nome')} required />
          <label htmlFor="email">E-mail</label><input id="email" type="email" {...campo('email')} required />
          <label htmlFor="cpf">CPF (opcional)</label><input id="cpf" {...campo('cpf')} />
          <label htmlFor="tel">Telefone (opcional)</label><input id="tel" {...campo('telefone')} />
          <label htmlFor="inst">Instituição</label>
          <select id="inst" {...campo('instituicaoId')} required>
            <option value="">Escolha…</option>
            {lista.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select>
          <label htmlFor="senha">Senha (mínimo 8 caracteres)</label><input id="senha" type="password" {...campo('senha')} autoComplete="new-password" minLength={8} required />
          <label htmlFor="conf">Confirmar senha</label><input id="conf" type="password" {...campo('confirmar')} autoComplete="new-password" required />
          {erro && <p role="alert" className="erro">{erro}</p>}
          <p><button className="btn" disabled={enviando}>{enviando ? 'Enviando…' : 'Solicitar cadastro'}</button></p>
          <p>Já tem conta? <Link to="/login">Entrar</Link></p>
        </form>
      )}
    </AuthCard>
  );
}
