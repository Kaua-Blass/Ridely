import { FormEvent, useState } from 'react';
import { useEnvio } from '../../lib/useEnvio';
import { atualizarRota, criarRota, removerRota, RotaAdm, Visao } from './api';

interface Props { dados: Visao; pode: boolean; recarregar: () => Promise<void> }

/** Lista de paradas em ordem: o motorista passa por elas na sequência. */
function EditorParadas({ valor, aoMudar }: { valor: string[]; aoMudar: (v: string[]) => void }) {
  const mudar = (i: number, t: string) => aoMudar(valor.map((p, k) => (k === i ? t : p)));
  const mover = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= valor.length) return;
    const n = [...valor];
    [n[i], n[j]] = [n[j], n[i]];
    aoMudar(n);
  };
  return (
    <div>
      {valor.map((p, i) => (
        <div key={i} className="paradas-linha">
          <span style={{ width: 22 }}>{i + 1}.</span>
          <input value={p} onChange={(e) => mudar(i, e.target.value)} aria-label={`Parada ${i + 1}`} />
          <button type="button" className="btn sec peq" onClick={() => mover(i, -1)} aria-label="Subir parada">↑</button>
          <button type="button" className="btn sec peq" onClick={() => mover(i, 1)} aria-label="Descer parada">↓</button>
          <button type="button" className="btn sec peq" onClick={() => aoMudar(valor.filter((_, k) => k !== i))} aria-label="Remover parada">✕</button>
        </div>
      ))}
      <button type="button" className="btn sec peq" onClick={() => aoMudar([...valor, ''])}>+ Parada</button>
    </div>
  );
}

export default function Rotas({ dados, pode, recarregar }: Props) {
  const [editando, setEditando] = useState<RotaAdm | 'nova' | null>(null);
  const { erro, ok, enviando, executar } = useEnvio();
  const r = editando && editando !== 'nova' ? editando : null;
  const [f, setF] = useState({ nome: '', descricao: '', paradas: [''], instituicoes: [] as number[] });
  const nomeInst = (id: number) => dados.instituicoes.find((i) => i.id === id)?.nome ?? '?';

  const abrir = (x: RotaAdm | 'nova') => {
    setEditando(x);
    setF(x === 'nova' ? { nome: '', descricao: '', paradas: [''], instituicoes: [] } : { nome: x.nome, descricao: x.descricao ?? '', paradas: [...x.paradas], instituicoes: [...x.instituicoes] });
  };
  const alternar = (id: number) => setF({ ...f, instituicoes: f.instituicoes.includes(id) ? f.instituicoes.filter((i) => i !== id) : [...f.instituicoes, id] });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const d = { nome: f.nome, descricao: f.descricao || undefined, paradas: f.paradas.map((p) => p.trim()).filter(Boolean), instituicoes: f.instituicoes };
    executar(async () => {
      const res = r ? await atualizarRota(r.id, d) : await criarRota(d);
      await recarregar();
      setEditando(null);
      return res.mensagem;
    });
  };
  const remover = (x: RotaAdm) => {
    if (!window.confirm(`Remover a rota ${x.nome}?`)) return;
    executar(async () => { const res = await removerRota(x.id); await recarregar(); return res.mensagem; });
  };

  return (
    <>
      {pode && !editando && <p><button className="btn" onClick={() => abrir('nova')}>Incluir rota</button></p>}
      {editando && (
        <form className="card" onSubmit={enviar}>
          <h2>{r ? 'Alterar rota' : 'Incluir rota'}</h2>
          <div className="grade">
            <div><label htmlFor="rn">Nome</label><input id="rn" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required /></div>
            <div><label htmlFor="rd">Descrição (opcional)</label><input id="rd" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></div>
          </div>
          <label>Paradas na cidade, na ordem em que o veículo passa</label>
          <EditorParadas valor={f.paradas} aoMudar={(paradas) => setF({ ...f, paradas })} />
          <label>Instituições atendidas</label>
          {dados.instituicoes.map((i) => (
            <label key={i.id} className="opcao"><input type="checkbox" checked={f.instituicoes.includes(i.id)} onChange={() => alternar(i.id)} />{i.nome}</label>
          ))}
          {r && <p className="sub" style={{ margin: '12px 0 0' }}>Se uma parada ou instituição sair da rota, os associados afetados são ajustados automaticamente e você é avisado.</p>}
          <p><button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</button> <button type="button" className="btn sec" onClick={() => setEditando(null)}>Cancelar</button></p>
        </form>
      )}
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      <div className="cols" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {dados.rotas.map((x) => (
          <div key={x.id} className="card" style={{ margin: 0 }}>
            <h2>{x.nome}</h2>
            {x.descricao && <p className="sub">{x.descricao}</p>}
            <p><b>Paradas:</b> {x.paradas.map((p, i) => `${i + 1}. ${p}`).join(' → ')}</p>
            <p><b>Instituições:</b> {x.instituicoes.map(nomeInst).join(', ') || '—'}</p>
            <p className="sub" style={{ margin: 0 }}>{x.veiculos} veículo(s) · {x.capacidade} lugares · {x.associados} associado(s)</p>
            {pode && <p><button className="btn sec peq" onClick={() => abrir(x)}>Alterar</button> <button className="btn sec peq" onClick={() => remover(x)}>Remover</button></p>}
          </div>
        ))}
      </div>
    </>
  );
}
