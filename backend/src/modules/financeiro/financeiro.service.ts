import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Writable } from 'stream';
import { arred, exigirSaldo, lancar, travarConta } from '../../common/caixa';
import { dataValida, hoje } from '../../common/datas';
import { DbService } from '../../common/db.service';
import type { UsuarioPublico } from '../../common/usuario';
import { CalculoMensalidadeService } from './calculo-mensalidade.service';
import { BaixaDto, GerarDto, MensalidadesQueryDto } from './dto/financeiro.dto';
import { gerarRecibo } from './recibo';

/** Todas as mensalidades vencem no dia 10. */
export const DIA_VENCIMENTO = 10;
const LIMITE = 1000;
const esc = (s: string) => s.replace(/[\\%_]/g, '\\$&');

/** Mensalidade com situação calculada: baixada, cancelada, atrasada (vencida e não paga) ou em aberto. $1 = hoje. */
const BASE = `
  select m.id, m.associado_id, a.nome as associado, m.referencia, m.vencimento, m.valor, m.cancelada_motivo,
         p.id as pagamento_id, p.pago_em, p.valor + p.multa as pago_total, p.forma, cf.nome as conta,
         case when m.cancelada_em is not null then 'cancelada'
              when p.id is not null then 'baixado'
              when m.vencimento < $1::date then 'atrasado' else 'em_aberto' end as status
  from mensalidade m
  join associado a on a.id = m.associado_id
  left join pagamento p on p.mensalidade_id = m.id and p.estornado_em is null
  left join conta_financeira cf on cf.id = p.conta_id`;

@Injectable()
export class FinanceiroService {
  constructor(private readonly db: DbService, private readonly calculo: CalculoMensalidadeService) {}

  private async multaPercentual() {
    return Number((await this.db.um("select valor from parametro where chave='multa_percentual'"))?.valor ?? 0);
  }

  // ---------- leitura ----------
  async listar(q: MensalidadesQueryDto, quem: UsuarioPublico) {
    const pct = await this.multaPercentual();
    const p: unknown[] = [hoje()], onde: string[] = [];
    const add = (cond: string, v: unknown) => { p.push(v); onde.push(cond.replaceAll('?', `$${p.length}`)); };
    if (quem.perfil === 'associado') {
      if (!quem.associadoId) return { itens: [], total: 0, limite: LIMITE, multaPercentual: pct };
      add('t.associado_id = ?', quem.associadoId);
    } else if (q.associadoId) add('t.associado_id = ?', q.associadoId);
    if (q.busca) add('t.associado ilike ?', `%${esc(q.busca)}%`);
    if (q.referencia) add('t.referencia = ?', q.referencia);
    if (q.status) add('t.status = ?', q.status);
    if (q.de) add('t.vencimento >= ?::date', q.de);
    if (q.ate) add('t.vencimento <= ?::date', q.ate);
    const l = await this.db.query(`select t.*, count(*) over() as total from (${BASE}) t ${onde.length ? `where ${onde.join(' and ')}` : ''} order by t.vencimento desc, t.associado limit ${LIMITE}`, p);
    const itens = l.map((r) => {
      const valor = Number(r.valor), multaDevida = r.status === 'atrasado' ? arred((valor * pct) / 100) : 0;
      return {
        id: r.id, associadoId: r.associado_id, associado: r.associado, referencia: r.referencia, vencimento: r.vencimento, valor, status: r.status,
        multaDevida, totalAPagar: arred(valor + multaDevida), pagamentoId: r.pagamento_id, pagoEm: r.pago_em, pagoTotal: r.pago_total == null ? null : Number(r.pago_total),
        forma: r.forma, conta: r.conta, canceladaMotivo: r.cancelada_motivo,
      };
    });
    return { itens, total: l.length ? Number(l[0].total) : 0, limite: LIMITE, multaPercentual: pct };
  }

  async resumo(quem: UsuarioPublico) {
    const pct = await this.multaPercentual();
    const h = hoje();
    const p: unknown[] = [h, pct, `${h.slice(0, 7)}-01`];
    let onde = '';
    if (quem.perfil === 'associado') { p.push(quem.associadoId ?? 0); onde = 'where t.associado_id = $4'; }
    const r = (await this.db.um(`
      select count(*) filter (where status = 'em_aberto')::int as abertas_qtd, coalesce(sum(valor) filter (where status = 'em_aberto'), 0) as abertas_valor,
             count(*) filter (where status = 'atrasado')::int as atrasadas_qtd, coalesce(sum(valor) filter (where status = 'atrasado'), 0) as atrasadas_valor,
             coalesce(sum(round(valor * $2 / 100, 2)) filter (where status = 'atrasado'), 0) as atrasadas_multa,
             count(*) filter (where status = 'baixado' and pago_em >= $3::date)::int as pagas_qtd, coalesce(sum(pago_total) filter (where status = 'baixado' and pago_em >= $3::date), 0) as pagas_valor
      from (${BASE}) t ${onde}`, p))!;
    return {
      abertas: { qtd: r.abertas_qtd, valor: Number(r.abertas_valor) },
      atrasadas: { qtd: r.atrasadas_qtd, valor: Number(r.atrasadas_valor), multa: Number(r.atrasadas_multa) },
      recebidasNoMes: { qtd: r.pagas_qtd, valor: Number(r.pagas_valor) },
    };
  }

  // ---------- gerar ----------
  /** Gera as mensalidades do mês para quem tem contrato cobrindo parte dele. Vencimento: dia 10. Não duplica. */
  async gerar(d: GerarDto, quem: UsuarioPublico) {
    const limite = new Date(`${hoje()}T12:00:00Z`);
    limite.setUTCMonth(limite.getUTCMonth() + 12);
    if (d.referencia < '2020-01' || d.referencia > limite.toISOString().slice(0, 7)) throw new BadRequestException('Escolha um mês entre 2020 e os próximos 12 meses.');
    const [ano, mes] = d.referencia.split('-').map(Number);
    const inicioMes = `${d.referencia}-01`, fimMes = `${d.referencia}-${String(new Date(Date.UTC(ano, mes, 0)).getUTCDate()).padStart(2, '0')}`;
    const vencimento = `${d.referencia}-${String(DIA_VENCIMENTO).padStart(2, '0')}`;

    const r = await this.db.tx(async (c) => {
      const alvos = (await c.query(
        `select distinct c.associado_id from contrato c join associado a on a.id = c.associado_id
         where a.situacao = 'ativo' and c.inicio <= $2 and c.fim >= $1 ${d.associadoId ? 'and c.associado_id = $3' : ''}`,
        d.associadoId ? [inicioMes, fimMes, d.associadoId] : [inicioMes, fimMes])).rows;
      let criadas = 0, existentes = 0;
      for (const { associado_id } of alvos) {
        const { total, contratoId } = await this.calculo.valorDoMes(c, associado_id, d.referencia);
        if (total <= 0) continue;
        const ins = await c.query(
          'insert into mensalidade(associado_id, contrato_id, referencia, vencimento, valor, criado_por) values($1,$2,$3,$4,$5,$6) on conflict (associado_id, referencia) do nothing',
          [associado_id, contratoId, d.referencia, vencimento, total, quem.id]);
        if (ins.rowCount) criadas++; else existentes++;
      }
      return { criadas, existentes };
    });
    await this.db.auditar(quem.id, 'mensalidades_geradas', 'mensalidade', { referencia: d.referencia, ...r });
    const [a, m] = d.referencia.split('-').reverse();
    return { ...r, mensagem: r.criadas ? `${r.criadas} mensalidade(s) de ${a}/${m} gerada(s)${r.existentes ? `; ${r.existentes} já existia(m)` : ''}.` : r.existentes ? `Nenhuma nova: as ${r.existentes} mensalidade(s) de ${a}/${m} já existiam.` : `Nenhum contrato cobre ${a}/${m}: nada a gerar.` };
  }

  // ---------- baixa ----------
  /** Baixa: grava o pagamento e o recebimento na conta, juntos. Se qualquer parte falhar, nada fica gravado. */
  async baixar(id: number, d: BaixaDto, quem: UsuarioPublico) {
    if (!dataValida(d.data) || d.data > hoje()) throw new BadRequestException('A data do pagamento não pode ser futura.');
    const pct = await this.multaPercentual();
    const r = await this.db.tx(async (c) => {
      const m = (await c.query('select m.*, a.nome as associado from mensalidade m join associado a on a.id = m.associado_id where m.id=$1 for update of m', [id])).rows[0];
      if (!m) throw new NotFoundException('Mensalidade não encontrada.');
      if (m.cancelada_em) throw new BadRequestException('Esta mensalidade está cancelada.');
      if ((await c.query('select 1 from pagamento where mensalidade_id=$1 and estornado_em is null', [id])).rowCount) throw new ConflictException('Esta mensalidade já foi baixada.');
      const valor = Number(m.valor);
      const multaCheia = d.data > m.vencimento ? arred((valor * pct) / 100) : 0; // multa única, sem juros
      if (d.dispensarMulta && multaCheia > 0 && !d.motivo?.trim()) throw new BadRequestException('Informe o motivo para dispensar a multa.');
      const multa = d.dispensarMulta ? 0 : multaCheia;
      const total = arred(valor + multa);
      if (total <= 0) throw new BadRequestException('Mensalidade sem valor a receber.');
      const conta = await travarConta(c, d.contaId);
      const pg = (await c.query(
        'insert into pagamento(mensalidade_id, pago_em, valor, multa, forma, conta_id, observacao, criado_por) values($1,$2,$3,$4,$5,$6,$7,$8) returning id',
        [id, d.data, valor, multa, d.forma, conta.id, d.dispensarMulta && multaCheia > 0 ? `Multa dispensada: ${d.motivo!.trim()}` : null, quem.id])).rows[0];
      const [ano, mes] = m.referencia.split('-');
      await lancar(c, {
        contaId: conta.id, data: d.data, tipo: 'receita', sinal: 1, categoria: 'Mensalidade', valor: total, criadoPor: quem.id, pagamentoId: pg.id, associadoId: m.associado_id,
        historico: `Mensalidade ${mes}/${ano} - ${m.associado}${multa > 0 ? ` (com multa de ${multa.toFixed(2).replace('.', ',')})` : ''}`,
      });
      return { pagamentoId: pg.id as number, total, multa, associado: m.associado as string };
    });
    await this.db.auditar(quem.id, 'mensalidade_baixada', 'pagamento', { mensalidadeId: id, pagamentoId: r.pagamentoId, total: r.total, multa: r.multa, dispensouMulta: !!d.dispensarMulta });
    return { pagamentoId: r.pagamentoId, total: r.total, multa: r.multa, mensagem: `Baixa registrada: recibo nº ${String(r.pagamentoId).padStart(6, '0')}.` };
  }

  /** Estorno da baixa: devolve a mensalidade para "em aberto" e lança a saída correspondente na conta. Recusa se faltar saldo. */
  async estornar(pagamentoId: number, motivo: string, quem: UsuarioPublico) {
    await this.db.tx(async (c) => {
      const p = (await c.query('select p.*, m.referencia from pagamento p join mensalidade m on m.id = p.mensalidade_id where p.id=$1 for update of p', [pagamentoId])).rows[0];
      if (!p) throw new NotFoundException('Pagamento não encontrado.');
      if (p.estornado_em) throw new BadRequestException('Este pagamento já foi estornado.');
      const mov = (await c.query("select id, categoria, historico from movimentacao where pagamento_id=$1 and tipo='receita'", [pagamentoId])).rows[0];
      const conta = await travarConta(c, p.conta_id);
      const total = arred(Number(p.valor) + Number(p.multa));
      await exigirSaldo(c, conta, total); // o estorno de uma receita tira dinheiro da conta
      await c.query('update pagamento set estornado_em = now(), estorno_motivo = $2, estornado_por = $3 where id = $1', [pagamentoId, motivo.trim(), quem.id]);
      await lancar(c, { contaId: conta.id, data: hoje(), tipo: 'estorno', sinal: -1, categoria: mov.categoria, valor: total, criadoPor: quem.id, pagamentoId, estornaId: mov.id, historico: `Estorno do recibo ${String(pagamentoId).padStart(6, '0')}: ${motivo.trim()}` });
    });
    await this.db.auditar(quem.id, 'baixa_estornada', 'pagamento', { pagamentoId, motivo: motivo.trim() });
    return { mensagem: 'Baixa estornada. A mensalidade voltou para em aberto.' };
  }

  async cancelar(id: number, motivo: string, quem: UsuarioPublico) {
    const r = await this.db.query(
      `update mensalidade m set cancelada_em = now(), cancelada_motivo = $2 where m.id = $1 and m.cancelada_em is null
         and not exists (select 1 from pagamento p where p.mensalidade_id = m.id and p.estornado_em is null) returning id`, [id, motivo.trim()]);
    if (!r.length) throw new BadRequestException('Só é possível cancelar mensalidade existente, em aberto ou atrasada (estorne a baixa antes, se estiver paga).');
    await this.db.auditar(quem.id, 'mensalidade_cancelada', 'mensalidade', { id, motivo: motivo.trim() });
    return { mensagem: 'Mensalidade cancelada.' };
  }

  async reativar(id: number, quem: UsuarioPublico) {
    const m = await this.db.um('select associado_id, referencia from mensalidade where id=$1 and cancelada_em is not null', [id]);
    if (!m) throw new BadRequestException('Mensalidade não encontrada ou não está cancelada.');
    const { total, contratoId } = await this.calculo.valorDoMes(this.db.pool, m.associado_id, m.referencia);
    if (total <= 0) throw new BadRequestException('Nenhum contrato cobre esse mês, então a mensalidade não tem valor.');
    await this.db.query('update mensalidade set cancelada_em = null, cancelada_motivo = null, valor = $2, contrato_id = $3 where id = $1', [id, total, contratoId]);
    await this.db.auditar(quem.id, 'mensalidade_reativada', 'mensalidade', { id });
    return { mensagem: 'Mensalidade reativada com o valor atual do contrato.' };
  }

  // ---------- recibo ----------
  async recibo(pagamentoId: number, quem: UsuarioPublico, saida: Writable) {
    const r = await this.db.um(`
      select p.id, p.pago_em, p.valor, p.multa, p.forma, p.observacao, p.estornado_em, p.estorno_motivo, m.referencia, m.vencimento, m.associado_id,
             a.nome as associado, cf.nome as conta, u.nome as recebido_por
      from pagamento p join mensalidade m on m.id = p.mensalidade_id join associado a on a.id = m.associado_id
      join conta_financeira cf on cf.id = p.conta_id left join usuario u on u.id = p.criado_por where p.id = $1`, [pagamentoId]);
    if (!r || (quem.perfil === 'associado' && r.associado_id !== quem.associadoId)) throw new NotFoundException('Recibo não encontrado.');
    gerarRecibo({
      numero: r.id, associado: r.associado, referencia: r.referencia, vencimento: r.vencimento, pagoEm: r.pago_em, valor: Number(r.valor), multa: Number(r.multa), forma: r.forma,
      conta: r.conta, recebidoPor: r.recebido_por, observacao: r.observacao, estornadoEm: r.estornado_em ? new Date(r.estornado_em).toISOString() : null, estornoMotivo: r.estorno_motivo,
    }, saida);
  }
}
