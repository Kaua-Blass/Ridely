import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { CARGO_PARA_PERFIL } from '../../lib/permissoes';
import { useEnvio } from '../../lib/useEnvio';
import { instituicoes, Instituicao } from '../Cadastro/api';
import { convidar } from './api';

const CARGOS = [['associado', 'Associado'], ['presidente', 'Presidente'], ['vice-presidente', 'Vice-presidente'], ['tesoureiro', 'Tesoureiro'], ['conselheiro', 'Conselheiro'], ['auxiliar', 'Auxiliar']];

/** Convite por e-mail: a pessoa recebe um link para criar a própria senha. */
export default function ConviteForm({ aoConcluir }: { aoConcluir: () => void }) {
  const { usuario } = useAuth();
  const soPresidenteDefinePerfil = usuario?.perfil !== 'presidente';
  const [f, setF] = useState({ nome: '', email: '', cargo: 'associado', perfil: 'associado', instituicaoId: '' });
  const [lista, setLista] = useState<Instituicao[]>([]);
  const { erro, ok, enviando, executar } = useEnvio();
  useEffect(() => { instituicoes().then(setLista); }, []);

  const trocarCargo = (cargo: string) => setF({ ...f, cargo, perfil: soPresidenteDefinePerfil ? 'associado' : CARGO_PARA_PERFIL[CARGOS.find((c) => c[0] === cargo)![1]] });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => {
      const r = await convidar({ ...f, instituicaoId: Number(f.instituicaoId) });
      setF({ nome: '', email: '', cargo: 'associado', perfil: 'associado', instituicaoId: '' });
      aoConcluir();
      return r.mensagem;
    });
  };

  return (
    <form className="card" onSubmit={enviar}>
      <h2>Convidar associado</h2>
      <div className="grade">
        <div><label htmlFor="n">Nome completo</label><input id="n" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required /></div>
        <div><label htmlFor="e">E-mail do convite</label><input id="e" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></div>
        <div><label htmlFor="c">Cargo</label>
          <select id="c" value={f.cargo} onChange={(e) => trocarCargo(e.target.value)}>{CARGOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
        <div><label htmlFor="p">Perfil de acesso</label>
          <select id="p" value={f.perfil} disabled={soPresidenteDefinePerfil} onChange={(e) => setF({ ...f, perfil: e.target.value })}>{CARGOS.map(([v]) => <option key={v} value={v}>{v}</option>)}</select></div>
        <div><label htmlFor="i">Instituição</label>
          <select id="i" value={f.instituicaoId} onChange={(e) => setF({ ...f, instituicaoId: e.target.value })} required>
            <option value="">Escolha…</option>{lista.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}</select></div>
      </div>
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      <p><button className="btn" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar convite'}</button></p>
    </form>
  );
}
