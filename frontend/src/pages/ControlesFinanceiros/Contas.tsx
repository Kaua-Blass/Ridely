import { FormEvent, useEffect, useState } from 'react';
import DataTable from '../../components/DataTable/DataTable';
import { brl } from '../../lib/formatar';
import { useEnvio } from '../../lib/useEnvio';
import { atualizarConta, Conta, contas as listarContas, criarConta, removerConta, situacaoConta } from './api';

const VAZIO = { nome: '', tipo: 'banco', banco: '', agencia: '', numero: '', digito: '', tipoConta: 'corrente', chavePix: '', titular: '', observacoes: '', saldoInicial: '0' };

/** Cadastro de contas. Com movimentação: não remove, só inativa (e só com saldo zerado). */
export default function Contas({ escreve, versao, aoMudar }: { escreve: boolean; versao: number; aoMudar: () => void }) {
  const [lista, setLista] = useState<Conta[]>([]);
  const [editando, setEditando] = useState<Conta | 'nova' | null>(null);
  const [f, setF] = useState(VAZIO);
  const { erro, ok, enviando, executar } = useEnvio();
  const carregar = () => listarContas().then(setLista);
  useEffect(() => { carregar(); }, [versao]);
  const c = editando && editando !== 'nova' ? editando : null;

  const abrir = (x: Conta | 'nova') => {
    setEditando(x);
    setF(x === 'nova' ? VAZIO : { nome: x.nome, tipo: x.tipo, banco: x.banco ?? '', agencia: x.agencia ?? '', numero: x.numero ?? '', digito: x.digito ?? '', tipoConta: x.tipoConta ?? 'corrente', chavePix: x.chavePix ?? '', titular: x.titular ?? '', observacoes: x.observacoes ?? '', saldoInicial: String(x.saldoInicial) });
  };
  const campo = (k: keyof typeof VAZIO) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });
  const banco = f.tipo === 'banco';

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => {
      const d = { nome: f.nome, tipo: f.tipo, banco: f.banco || undefined, agencia: f.agencia || undefined, numero: f.numero || undefined, digito: f.digito || undefined, tipoConta: banco ? f.tipoConta : undefined, chavePix: f.chavePix || undefined, titular: f.titular || undefined, observacoes: f.observacoes || undefined };
      const r = c ? await atualizarConta(c.id, d) : await criarConta({ ...d, saldoInicial: Number(f.saldoInicial || 0) });
      await carregar(); aoMudar(); setEditando(null);
      return r.mensagem;
    });
  };
  const agir = (fn: () => Promise<{ mensagem: string }>) => executar(async () => { const r = await fn(); await carregar(); aoMudar(); return r.mensagem; });

  return (
    <>
      {escreve && !editando && <p><button className="btn" onClick={() => abrir('nova')}>Incluir conta</button></p>}
      {editando && (
        <form className="card" onSubmit={enviar}>
          <h2>{c ? 'Alterar conta' : 'Incluir conta'}</h2>
          <div className="grade">
            <div><label htmlFor="cn">Nome da conta</label><input id="cn" {...campo('nome')} required /></div>
            <div><label htmlFor="ct">Tipo</label><select id="ct" {...campo('tipo')} disabled={!!c && c.movimentacoes > 0}><option value="banco">Conta bancária</option><option value="caixa">Caixa (dinheiro físico)</option></select></div>
            {banco && <>
              <div><label htmlFor="cb">Nome do banco</label><input id="cb" {...campo('banco')} required /></div>
              <div><label htmlFor="ca">Número da agência</label><input id="ca" {...campo('agencia')} /></div>
              <div><label htmlFor="cu">Número da conta</label><input id="cu" {...campo('numero')} required /></div>
              <div><label htmlFor="cd">Dígito</label><input id="cd" {...campo('digito')} maxLength={5} /></div>
              <div><label htmlFor="cc">Tipo de conta</label><select id="cc" {...campo('tipoConta')}><option value="corrente">Corrente</option><option value="poupanca">Poupança</option><option value="pagamento">Pagamento</option></select></div>
              <div><label htmlFor="cx">Chave Pix</label><input id="cx" {...campo('chavePix')} /></div>
              <div><label htmlFor="ci">Titular</label><input id="ci" {...campo('titular')} /></div>
            </>}
            {!c && <div><label htmlFor="cs">Saldo inicial (R$)</label><input id="cs" type="number" step="0.01" min="0" {...campo('saldoInicial')} /></div>}
            <div><label htmlFor="co">Observações</label><input id="co" {...campo('observacoes')} maxLength={300} /></div>
          </div>
          {c && <p className="sub" style={{ margin: '12px 0 0' }}>O saldo inicial não muda depois que a conta é criada; ajustes são feitos por lançamentos.</p>}
          {erro && <p role="alert" className="erro">{erro}</p>}
          <p><button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</button> <button type="button" className="btn sec" onClick={() => setEditando(null)}>Cancelar</button></p>
        </form>
      )}
      {!editando && erro && <p role="alert" className="erro">{erro}</p>}
      {!editando && ok && <p role="status" className="sucesso">{ok}</p>}
      <div className="card">
        <DataTable<Conta> itens={lista} colunas={[
          { titulo: 'Conta', ordenar: (x) => x.nome, celula: (x) => x.nome },
          { titulo: 'Tipo', ordenar: (x) => x.tipo, celula: (x) => (x.tipo === 'caixa' ? 'Caixa' : `${x.banco ?? ''}${x.tipoConta ? ` · ${x.tipoConta}` : ''}`) },
          { titulo: 'Agência / conta', celula: (x) => (x.tipo === 'banco' ? `${x.agencia ?? '—'} / ${x.numero ?? '—'}${x.digito ? `-${x.digito}` : ''}` : '—') },
          { titulo: 'Saldo', ordenar: (x) => x.saldo, celula: (x) => brl(x.saldo) },
          { titulo: 'Movim.', ordenar: (x) => x.movimentacoes, celula: (x) => x.movimentacoes },
          { titulo: 'Situação', ordenar: (x) => (x.ativa ? 0 : 1), celula: (x) => <span className={`tag ${x.ativa ? 'ok' : 'amb'}`}>{x.ativa ? 'Ativa' : 'Inativa'}</span> },
          { titulo: '', celula: (x) => !escreve ? null : (
            <>
              <button className="btn sec peq" onClick={() => abrir(x)}>Alterar</button>{' '}
              <button className="btn sec peq" onClick={() => agir(() => situacaoConta(x.id, !x.ativa))}>{x.ativa ? 'Inativar' : 'Reativar'}</button>{' '}
              <button className="btn sec peq" onClick={() => window.confirm(`Remover a conta ${x.nome}?`) && agir(() => removerConta(x.id))}>Remover</button>
            </>
          ) },
        ]} />
      </div>
    </>
  );
}
