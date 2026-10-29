import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { brl, dataBr } from '../../lib/formatar';
import { contratosAVencer, fluxoCaixa, inadimplencia, Tipo, urlExportar } from './api';
import styles from './Relatorios.module.css';
import type { ContratosAVencer, FluxoCaixa, Inadimplencia } from './types';

const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const primeiroDoAno = () => `${hoje().slice(0, 4)}-01-01`;
const mesRotulo = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;

/** Botões PDF e CSV de um relatório. */
function Exportar({ tipo, de, ate }: { tipo: Tipo; de?: string; ate?: string }) {
  return (
    <span className={styles.exportar}>
      <a className="btn sec peq" href={urlExportar(tipo, 'pdf', de, ate)}>Baixar PDF</a>
      <a className="btn sec peq" href={urlExportar(tipo, 'csv', de, ate)}>Baixar planilha (CSV)</a>
    </span>
  );
}

/** Tela: Relatórios. Inadimplência, fluxo de caixa e contratos a vencer, com exportação. API: backend/src/modules/relatorios */
export default function Relatorios() {
  const { usuario } = useAuth();
  const [inad, setInad] = useState<Inadimplencia | null>(null);
  const [fluxo, setFluxo] = useState<FluxoCaixa | null>(null);
  const [contr, setContr] = useState<ContratosAVencer | null>(null);
  const [de, setDe] = useState(primeiroDoAno());
  const [ate, setAte] = useState(hoje());
  const [erro, setErro] = useState('');
  const [erroFluxo, setErroFluxo] = useState('');

  useEffect(() => {
    inadimplencia().then(setInad).catch((e) => setErro(e.message));
    contratosAVencer().then(setContr).catch((e) => setErro(e.message));
  }, []);
  useEffect(() => {
    setErroFluxo('');
    fluxoCaixa(de, ate).then(setFluxo).catch((e) => { setFluxo(null); setErroFluxo(e.message); });
  }, [de, ate]);

  return (
    <section>
      <h1 className={styles.titulo}>Relatórios</h1>
      <p className={styles.sub}>Visível para presidente, vice, tesoureiro e conselheiro. Cada relatório pode ser baixado em PDF ou em planilha.</p>
      {erro && <p role="alert" className="erro">{erro}</p>}

      <div className="card">
        <div className={styles.cabecalho}>
          <h2>Inadimplência</h2>
          <Exportar tipo="inadimplencia" />
        </div>
        {inad && <p className="sub">Em aberto: <b>{brl(inad.total)}</b> · {inad.associados} associado(s) · {inad.meses} mensalidade(s)</p>}
        {inad && inad.itens.length === 0 && <p className="sub">Nenhuma mensalidade em atraso.</p>}
        {inad && inad.itens.length > 0 && (
          <table>
            <thead><tr><th>Associado</th><th>Meses</th><th>Referências</th><th>Mais antigo</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
            <tbody>
              {inad.itens.map((r) => (
                <tr key={r.id}><td>{r.nome}</td><td>{r.meses}</td><td>{r.referencias}</td><td>{dataBr(r.maisAntigo)}</td><td style={{ textAlign: 'right' }}>{brl(r.valor)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className={styles.cabecalho}>
          <h2>Fluxo de caixa</h2>
          <Exportar tipo="fluxo" de={de} ate={ate} />
        </div>
        <div className={styles.periodo}>
          <label>De <input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
          <label>Até <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
        </div>
        <p className="sub">Regime de caixa. Transferências entre contas não entram como receita nem despesa.</p>
        {erroFluxo && <p role="alert" className="erro">{erroFluxo}</p>}
        {fluxo && (
          <>
            <p className="sub">Saldo inicial <b>{brl(fluxo.saldoInicial)}</b> · saldo final <b>{brl(fluxo.totais.saldoFinal)}</b></p>
            {fluxo.meses.length === 0 ? <p className="sub">Sem movimentações no período.</p> : (
              <table>
                <thead><tr><th>Mês</th><th style={{ textAlign: 'right' }}>Receitas</th><th style={{ textAlign: 'right' }}>Despesas</th><th style={{ textAlign: 'right' }}>Saldo do mês</th></tr></thead>
                <tbody>
                  {fluxo.meses.map((m) => (
                    <tr key={m.mes}><td>{mesRotulo(m.mes)}</td><td style={{ textAlign: 'right' }}>{brl(m.receitas)}</td><td style={{ textAlign: 'right' }}>{brl(m.despesas)}</td><td style={{ textAlign: 'right' }}>{brl(m.saldo)}</td></tr>
                  ))}
                  <tr><td><b>Total</b></td><td style={{ textAlign: 'right' }}><b>{brl(fluxo.totais.receitas)}</b></td><td style={{ textAlign: 'right' }}><b>{brl(fluxo.totais.despesas)}</b></td><td style={{ textAlign: 'right' }}><b>{brl(fluxo.totais.saldo)}</b></td></tr>
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div className={styles.cabecalho}>
          <h2>Contratos a vencer</h2>
          <Exportar tipo="contratos" />
        </div>
        {contr && <p className="sub">Contratos que terminam nos próximos {contr.prazoDias} dias.</p>}
        {contr && contr.itens.length === 0 && <p className="sub">Nenhum contrato nesse prazo.</p>}
        {contr && contr.itens.length > 0 && (
          <table>
            <thead><tr><th>Associado</th><th>Início</th><th>Término</th><th>Dias para vencer</th><th style={{ textAlign: 'right' }}>Valor por dia</th></tr></thead>
            <tbody>
              {contr.itens.map((r) => (
                <tr key={r.id}><td>{r.associado}</td><td>{dataBr(r.inicio)}</td><td>{dataBr(r.fim)}</td><td>{r.diasParaVencer}</td><td style={{ textAlign: 'right' }}>{brl(r.valorPorDia)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {usuario?.perfil === 'conselheiro' && <p className="sub">Você está com acesso de consulta: os relatórios não alteram dados.</p>}
    </section>
  );
}
