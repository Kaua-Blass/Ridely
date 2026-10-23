import { FormEvent, useState } from 'react';
import DataTable from '../../components/DataTable/DataTable';
import { useEnvio } from '../../lib/useEnvio';
import { atualizarVeiculo, criarVeiculo, removerVeiculo, Visao, VeiculoAdm } from './api';

interface Props { dados: Visao; pode: boolean; recarregar: () => Promise<void> }

export default function Veiculos({ dados, pode, recarregar }: Props) {
  const [editando, setEditando] = useState<VeiculoAdm | 'novo' | null>(null);
  const { erro, ok, enviando, executar } = useEnvio();
  const v = editando && editando !== 'novo' ? editando : null;
  const [f, setF] = useState({ nome: '', placa: '', capacidade: '', rotaId: '', motoristaId: '' });

  const abrir = (x: VeiculoAdm | 'novo') => {
    setEditando(x);
    setF(x === 'novo' ? { nome: '', placa: '', capacidade: '', rotaId: '', motoristaId: '' }
      : { nome: x.nome, placa: x.placa, capacidade: String(x.capacidade), rotaId: String(x.rotaId ?? ''), motoristaId: String(x.motoristaId ?? '') });
  };
  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const d = { nome: f.nome, placa: f.placa, capacidade: Number(f.capacidade), rotaId: f.rotaId ? Number(f.rotaId) : undefined, motoristaId: f.motoristaId ? Number(f.motoristaId) : undefined };
    executar(async () => {
      const r = v ? await atualizarVeiculo(v.id, d) : await criarVeiculo(d);
      await recarregar();
      setEditando(null);
      return r.mensagem;
    });
  };
  const remover = (x: VeiculoAdm) => {
    if (!window.confirm(`Remover o veículo ${x.nome} (${x.placa})?`)) return;
    executar(async () => { const r = await removerVeiculo(x.id); await recarregar(); return r.mensagem; });
  };

  return (
    <>
      {pode && !editando && <p><button className="btn" onClick={() => abrir('novo')}>Incluir veículo</button></p>}
      {editando && (
        <form className="card" onSubmit={enviar}>
          <h2>{v ? 'Alterar veículo' : 'Incluir veículo'}</h2>
          <div className="grade">
            <div><label htmlFor="vn">Nome</label><input id="vn" {...campo('nome')} required /></div>
            <div><label htmlFor="vp">Placa</label><input id="vp" {...campo('placa')} placeholder="ABC1D23" required /></div>
            <div><label htmlFor="vc">Capacidade (lugares)</label><input id="vc" type="number" min={1} max={60} {...campo('capacidade')} required /></div>
            <div><label htmlFor="vr">Rota</label>
              <select id="vr" {...campo('rotaId')}><option value="">Sem rota</option>{dados.rotas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></div>
            <div><label htmlFor="vm">Motorista</label>
              <select id="vm" {...campo('motoristaId')}><option value="">Sem motorista</option>{dados.motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.pendente ? ' (convite pendente)' : ''}</option>)}</select></div>
          </div>
          <p><button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</button> <button type="button" className="btn sec" onClick={() => setEditando(null)}>Cancelar</button></p>
        </form>
      )}
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      <div className="card">
        <DataTable<VeiculoAdm> itens={dados.veiculos} colunas={[
          { titulo: 'Veículo', ordenar: (x) => x.nome, celula: (x) => x.nome },
          { titulo: 'Placa', ordenar: (x) => x.placa, celula: (x) => x.placa },
          { titulo: 'Capacidade', ordenar: (x) => x.capacidade, celula: (x) => `${x.capacidade} lugares` },
          { titulo: 'Rota', ordenar: (x) => x.rota ?? '', celula: (x) => x.rota ?? '—' },
          { titulo: 'Motorista', ordenar: (x) => x.motorista ?? '', celula: (x) => x.motorista ?? '—' },
          { titulo: '', celula: (x) => !pode ? null : <><button className="btn sec peq" onClick={() => abrir(x)}>Alterar</button>{' '}<button className="btn sec peq" onClick={() => remover(x)}>Remover</button></> },
        ]} />
      </div>
    </>
  );
}
