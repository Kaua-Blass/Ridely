import { FormEvent, useEffect, useState } from 'react';
import { useEnvio } from '../../lib/useEnvio';
import { Instituicao, instituicoes } from '../Cadastro/api';
import { Associado, editar, Rota, rotas } from './api';

const CARGOS = [['associado', 'Associado'], ['presidente', 'Presidente'], ['vice-presidente', 'Vice-presidente'], ['tesoureiro', 'Tesoureiro'], ['conselheiro', 'Conselheiro'], ['auxiliar', 'Auxiliar']];

/** Edição de um associado. A rota só oferece as que atendem a instituição escolhida. */
export default function EditarForm({ associado: a, aoConcluir, aoCancelar }: { associado: Associado; aoConcluir: () => void; aoCancelar: () => void }) {
  const [f, setF] = useState({ nome: a.nome, telefone: a.telefone ?? '', cpf: '', cargo: a.cargoCodigo, instituicaoId: String(a.instituicaoId ?? ''), rotaId: String(a.rotaId ?? ''), pontoEmbarque: a.pontoEmbarque ?? '' });
  const [insts, setInsts] = useState<Instituicao[]>([]);
  const [todasRotas, setTodasRotas] = useState<Rota[]>([]);
  const { erro, ok, enviando, executar } = useEnvio();
  useEffect(() => { instituicoes().then(setInsts); rotas().then(setTodasRotas); }, []);

  const rotasDaInst = todasRotas.filter((r) => r.instituicoes.includes(Number(f.instituicaoId)));
  const paradas = todasRotas.find((r) => r.id === Number(f.rotaId))?.paradas ?? [];
  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => {
      const r = await editar(a.id, { nome: f.nome, telefone: f.telefone || undefined, cpf: f.cpf || undefined, cargo: f.cargo, instituicaoId: Number(f.instituicaoId), rotaId: f.rotaId ? Number(f.rotaId) : undefined, pontoEmbarque: f.pontoEmbarque || undefined });
      aoConcluir();
      return r.mensagem;
    });
  };

  return (
    <form className="card" onSubmit={enviar}>
      <h2>Editar associado</h2>
      <div className="grade">
        <div><label htmlFor="en">Nome completo</label><input id="en" {...campo('nome')} required /></div>
        <div><label htmlFor="et">Telefone</label><input id="et" {...campo('telefone')} /></div>
        <div><label htmlFor="ecpf">CPF (deixe vazio para manter)</label><input id="ecpf" {...campo('cpf')} /></div>
        <div><label htmlFor="ec">Cargo</label><select id="ec" {...campo('cargo')}>{CARGOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
        <div><label htmlFor="ei">Instituição</label>
          <select id="ei" value={f.instituicaoId} onChange={(e) => setF({ ...f, instituicaoId: e.target.value, rotaId: '', pontoEmbarque: '' })} required>
            <option value="">Escolha…</option>{insts.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}</select></div>
        <div><label htmlFor="er">Rota</label>
          <select id="er" value={f.rotaId} onChange={(e) => setF({ ...f, rotaId: e.target.value, pontoEmbarque: '' })}>
            <option value="">Automática</option>{rotasDaInst.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></div>
        <div><label htmlFor="ep">Ponto de embarque</label>
          <select id="ep" {...campo('pontoEmbarque')} disabled={!f.rotaId}>
            <option value="">Não definido</option>{paradas.map((p) => <option key={p}>{p}</option>)}</select></div>
      </div>
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      <p><button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</button> <button type="button" className="btn sec" onClick={aoCancelar}>Cancelar</button></p>
    </form>
  );
}
