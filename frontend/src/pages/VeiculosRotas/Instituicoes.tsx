import { FormEvent, useState } from 'react';
import DataTable from '../../components/DataTable/DataTable';
import { useEnvio } from '../../lib/useEnvio';
import { atualizarInstituicao, criarInstituicao, InstituicaoAdm, removerInstituicao, Visao } from './api';

interface Props { dados: Visao; pode: boolean; recarregar: () => Promise<void> }

export default function Instituicoes({ dados, pode, recarregar }: Props) {
  const [editando, setEditando] = useState<InstituicaoAdm | 'nova' | null>(null);
  const [nome, setNome] = useState('');
  const { erro, ok, enviando, executar } = useEnvio();
  const i = editando && editando !== 'nova' ? editando : null;

  const abrir = (x: InstituicaoAdm | 'nova') => { setEditando(x); setNome(x === 'nova' ? '' : x.nome); };
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => { const r = i ? await atualizarInstituicao(i.id, nome) : await criarInstituicao(nome); await recarregar(); setEditando(null); return r.mensagem; });
  };
  const remover = (x: InstituicaoAdm) => {
    if (!window.confirm(`Remover a instituição ${x.nome}?`)) return;
    executar(async () => { const r = await removerInstituicao(x.id); await recarregar(); return r.mensagem; });
  };

  return (
    <>
      {pode && !editando && <p><button className="btn" onClick={() => abrir('nova')}>Incluir instituição</button></p>}
      {editando && (
        <form className="card" onSubmit={enviar}>
          <h2>{i ? 'Alterar instituição' : 'Incluir instituição'}</h2>
          <label htmlFor="in">Nome</label><input id="in" value={nome} onChange={(e) => setNome(e.target.value)} required />
          <p><button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</button> <button type="button" className="btn sec" onClick={() => setEditando(null)}>Cancelar</button></p>
        </form>
      )}
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      <div className="card">
        <p className="sub">Para uma instituição ser escolhida por associados, ela precisa estar em ao menos uma rota.</p>
        <DataTable<InstituicaoAdm> itens={dados.instituicoes} colunas={[
          { titulo: 'Instituição', ordenar: (x) => x.nome, celula: (x) => x.nome },
          { titulo: 'Rotas', celula: (x) => dados.rotas.filter((r) => r.instituicoes.includes(x.id)).map((r) => r.nome).join(', ') || '—' },
          { titulo: 'Associados', ordenar: (x) => x.associados, celula: (x) => x.associados },
          { titulo: '', celula: (x) => !pode ? null : <><button className="btn sec peq" onClick={() => abrir(x)}>Alterar</button>{' '}<button className="btn sec peq" onClick={() => remover(x)}>Remover</button></> },
        ]} />
      </div>
    </>
  );
}
