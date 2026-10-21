import { FormEvent, useEffect, useState } from 'react';
import { useEnvio } from '../../lib/useEnvio';
import { Instituicao, instituicoes } from '../Cadastro/api';
import { atualizar, PerfilCompleto } from './api';

export default function DadosPessoais({ perfil, aoSalvar }: { perfil: PerfilCompleto; aoSalvar: () => Promise<void> }) {
  const [f, setF] = useState({ nome: perfil.nome, telefone: perfil.telefone ?? '', endereco: perfil.endereco ?? '', contatoEmergencia: perfil.contatoEmergencia ?? '', instituicaoId: String(perfil.instituicaoId ?? '') });
  const [lista, setLista] = useState<Instituicao[]>([]);
  const { erro, ok, enviando, executar } = useEnvio();
  useEffect(() => { instituicoes().then(setLista); }, []);
  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => {
      const r = await atualizar({ nome: f.nome, telefone: f.telefone, endereco: f.endereco, contatoEmergencia: f.contatoEmergencia, instituicaoId: f.instituicaoId ? Number(f.instituicaoId) : undefined });
      await aoSalvar();
      return r.mensagem;
    });
  };

  return (
    <form className="card" onSubmit={enviar}>
      <h2>Dados pessoais</h2>
      <div className="grade">
        <div><label htmlFor="nome">Nome completo</label><input id="nome" {...campo('nome')} required /></div>
        <div><label htmlFor="tel">Telefone</label><input id="tel" {...campo('telefone')} /></div>
        <div><label htmlFor="end">Endereço</label><input id="end" {...campo('endereco')} /></div>
        <div><label htmlFor="em">Contato de emergência</label><input id="em" {...campo('contatoEmergencia')} /></div>
        {perfil.associadoId && (
          <div><label htmlFor="inst">Instituição</label>
            <select id="inst" {...campo('instituicaoId')}>{lista.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}</select></div>
        )}
      </div>
      {perfil.associadoId && <p className="sub" style={{ margin: '12px 0 0' }}>Trocar a instituição muda a sua rota; o ponto de embarque é definido pela presidência.</p>}
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      <p><button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar dados'}</button></p>
    </form>
  );
}
