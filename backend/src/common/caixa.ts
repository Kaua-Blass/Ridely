import { BadRequestException } from '@nestjs/common';
import type { PoolClient } from 'pg';

export const arred = (v: number) => Math.round(v * 100) / 100;
export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ');

/** Trava a conta até o fim da transação: duas saídas ao mesmo tempo não gastam o mesmo saldo. */
export async function travarConta(c: PoolClient, id: number) {
  const conta = (await c.query('select * from conta_financeira where id=$1 for update', [id])).rows[0];
  if (!conta) throw new BadRequestException('Conta inválida.');
  if (!conta.ativa) throw new BadRequestException(`A conta ${conta.nome} está inativa. Reative-a para movimentar.`);
  return conta as { id: number; nome: string; tipo: string };
}

/** Saldo = saldo inicial + entradas − saídas (calculado das movimentações, nunca guardado). */
export async function saldoConta(c: PoolClient, id: number): Promise<number> {
  const r = (await c.query(
    'select cf.saldo_inicial + coalesce(sum(m.sinal * m.valor), 0) as saldo from conta_financeira cf left join movimentacao m on m.conta_id = cf.id where cf.id = $1 group by cf.id', [id])).rows[0];
  return Number(r.saldo);
}

export async function exigirSaldo(c: PoolClient, conta: { id: number; nome: string }, valor: number) {
  const saldo = await saldoConta(c, conta.id);
  if (arred(valor) > arred(saldo)) throw new BadRequestException(`Saldo insuficiente em ${conta.nome}: disponível ${brl(saldo)}.`);
}

export interface Lancamento {
  contaId: number; data: string; tipo: 'receita' | 'despesa' | 'transferencia_entrada' | 'transferencia_saida' | 'estorno';
  sinal: 1 | -1; categoria: string; historico: string; valor: number; criadoPor: number;
  pagamentoId?: number | null; transferenciaId?: string | null; associadoId?: number | null; estornaId?: number | null; observacao?: string | null;
}
export async function lancar(c: PoolClient, l: Lancamento): Promise<number> {
  const r = await c.query(
    `insert into movimentacao(conta_id, data, tipo, sinal, categoria, historico, valor, pagamento_id, transferencia_id, associado_id, estorna_id, observacao, criado_por)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
    [l.contaId, l.data, l.tipo, l.sinal, l.categoria, l.historico, arred(l.valor), l.pagamentoId ?? null, l.transferenciaId ?? null, l.associadoId ?? null, l.estornaId ?? null, l.observacao ?? null, l.criadoPor]);
  return r.rows[0].id;
}
