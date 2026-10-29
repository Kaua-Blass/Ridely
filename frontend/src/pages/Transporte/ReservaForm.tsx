import { FormEvent, useEffect, useState } from 'react';
import { dataBr } from '../../lib/formatar';
import { useEnvio } from '../../lib/useEnvio';
import { rotas as listarRotas, Rota } from '../Associados/api';
import { Instituicao, instituicoes as listarInstituicoes } from '../Cadastro/api';
import { reservar } from './api';

/** A rota é escolhida sozinha: a primeira que atende a instituição e passa pelo ponto de embarque. */
export default function ReservaForm({ data, padrao, aoConcluir, aoCancelar }: { data: string; padrao: { instituicaoId: number | null; pontoEmbarque: string | null } | null; aoConcluir: (m: string) => void; aoCancelar: () => void }) {
  const [insts, setInsts] = useState<Instituicao[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [instituicaoId, setInst] = useState(String(padrao?.instituicaoId ?? ''));
  const [ponto, setPonto] = useState(padrao?.pontoEmbarque ?? '');
  const { erro, enviando, executar } = useEnvio();
  useEffect(() => { listarInstituicoes().then(setInsts); listarRotas().then(setRotas); }, []);

  const doInst = rotas.filter((r) => r.instituicoes.includes(Number(instituicaoId)));
  const pontos = [...new Set(doInst.flatMap((r) => r.paradas))];
  const rota = doInst.find((r) => r.paradas.includes(ponto));

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => { const r = await reservar({ data, instituicaoId: Number(instituicaoId), pontoEmbarque: ponto }); aoConcluir(r.mensagem); });
  };

  return (
    <form className="card" onSubmit={enviar}>
      <h2>Reservar viagem de {dataBr(data)}</h2>
      <div className="grade">
        <div><label htmlFor="ri">Instituição de destino</label>
          <select id="ri" value={instituicaoId} onChange={(e) => { setInst(e.target.value); setPonto(''); }} required><option value="">Escolha…</option>{insts.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}</select></div>
        <div><label htmlFor="rp">Ponto de embarque</label>
          <select id="rp" value={ponto} onChange={(e) => setPonto(e.target.value)} required disabled={!instituicaoId}><option value="">Escolha…</option>{pontos.map((p) => <option key={p}>{p}</option>)}</select></div>
      </div>
      <p className="sub" style={{ margin: '12px 0 0' }}>{rota ? <>Rota: <b>{rota.nome}</b></> : 'A rota é escolhida pela instituição e pelo ponto de embarque.'}</p>
      {erro && <p role="alert" className="erro">{erro}</p>}
      <p><button className="btn" disabled={enviando || !rota}>{enviando ? 'Reservando…' : 'Confirmar reserva'}</button> <button type="button" className="btn sec" onClick={aoCancelar}>Cancelar</button></p>
    </form>
  );
}
