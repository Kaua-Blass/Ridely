import { useEffect, useState } from 'react';
import { brl } from '../../lib/formatar';
import { resumo, ResumoGeral } from './api';

export default function VisaoGeral({ versao }: { versao: number }) {
  const [r, setR] = useState<ResumoGeral | null>(null);
  useEffect(() => { resumo().then(setR); }, [versao]);
  if (!r) return <p>Carregando…</p>;
  return (
    <>
      <div className="grade" style={{ marginBottom: 16 }}>
        <div className="card" style={{ margin: 0 }}><b style={{ fontSize: 22 }}>{brl(r.saldoTotal)}</b><br /><span className="sub">saldo consolidado (as transferências entre contas não somam)</span></div>
        <div className="card" style={{ margin: 0 }}><b style={{ fontSize: 22 }}>{brl(r.receitasDoMes)}</b><br /><span className="sub">receitas neste mês</span></div>
        <div className="card" style={{ margin: 0 }}><b style={{ fontSize: 22 }}>{brl(r.despesasDoMes)}</b><br /><span className="sub">despesas neste mês</span></div>
      </div>
      <div className="grade">
        {r.contas.filter((c) => c.ativa).map((c) => (
          <div key={c.id} className="card" style={{ margin: 0 }}>
            <span className="sub">{c.nome} · {c.tipo === 'caixa' ? 'Caixa' : c.banco}</span><br /><b style={{ fontSize: 20 }}>{brl(c.saldo)}</b><br />
            <span className="sub">saldo inicial {brl(c.saldoInicial)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
