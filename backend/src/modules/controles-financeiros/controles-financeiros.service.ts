import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { arred, brl, exigirSaldo, lancar, saldoConta, travarConta } from '../../common/caixa';
import { dataValida, hoje } from '../../common/datas';
import { DbService } from '../../common/db.service';
import { tratarUnico } from '../../common/erros';
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA, ContaBaseDto, ContaDto, LancamentoDto, MovimentacoesQueryDto, TransferenciaDto } from './dto/controles.dto';

const esc = (s: string) => s.replace(/[\\%_]/g, '\\$&');
/** Receitas e despesas líquidas de estorno; transferências ficam de fora. */
const SOMA_RECEITAS = "coalesce(sum(case when b.tipo = 'receita' then b.valor when b.tipo = 'estorno' and b.sinal = -1 and b.categoria <> 'Transferência' then -b.valor end), 0)";
const SOMA_DESPESAS = "coalesce(sum(case when b.tipo = 'despesa' then b.valor when b.tipo = 'estorno' and b.sinal = 1 and b.categoria <> 'Transferência' then -b.valor end), 0)";
/** Movimentações com o saldo da conta após cada uma. */
const BASE = `
  select m.*, cf.nome as conta, cf.saldo_inicial + sum(m.sinal * m.valor) over (partition by m.conta_id order by m.data, m.id) as saldo_apos
  from movimentacao m join conta_financeira cf on cf.id = m.conta_id`;

@Injectable()
export class ControlesFinanceirosService {
  constructor(private readonly db: DbService) {}

  categorias() { return { receitas: CATEGORIAS_RECEITA, despesas: CATEGORIAS_DESPESA }; }

  // ---------- contas ----------
  async contas() {
    const l = await this.db.query(`
      select cf.*, cf.saldo_inicial + coalesce(sum(m.sinal * m.valor), 0) as saldo, count(m.id)::int as movimentacoes
      from conta_financeira cf left join movimentacao m on m.conta_id = cf.id
      group by cf.id order by cf.ativa desc, cf.nome`);
    return l.map((c) => ({
      id: c.id, nome: c.nome, tipo: c.tipo, banco: c.banco, agencia: c.agencia, numero: c.numero, digito: c.digito, tipoConta: c.tipo_conta, chavePix: c.chave_pix,
      titular: c.titular, observacoes: c.observacoes, saldoInicial: Number(c.saldo_inicial), saldo: Number(c.saldo), ativa: c.ativa, movimentacoes: c.movimentacoes,
    }));
  }

  private validarConta(d: ContaBaseDto) {
    if (d.tipo === 'banco' && (!d.banco?.trim() || !d.numero?.trim())) throw new BadRequestException('Para conta bancária, informe o banco e o número da conta.');
  }
  private campos(d: ContaBaseDto) {
    const b = d.tipo === 'banco';
    return [d.nome.trim(), d.tipo, b ? d.banco?.trim() || null : null, b ? d.agencia?.trim() || null : null, b ? d.numero?.trim() || null : null, b ? d.digito?.trim() || null : null,
      b ? d.tipoConta ?? null : null, d.chavePix?.trim() || null, d.titular?.trim() || null, d.observacoes?.trim() || null];
  }

  async criarConta(d: ContaDto, quemId: number) {
    this.validarConta(d);
    try {
      const r = await this.db.um('insert into conta_financeira(nome, tipo, banco, agencia, numero, digito, tipo_conta, chave_pix, titular, observacoes, saldo_inicial) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id',
        [...this.campos(d), d.saldoInicial ?? 0]);
      await this.db.auditar(quemId, 'conta_criada', 'conta_financeira', { id: r!.id, nome: d.nome.trim(), saldoInicial: d.saldoInicial ?? 0 });
      return { id: r!.id, mensagem: 'Conta criada.' };
    } catch (e) { tratarUnico(e, 'Já existe uma conta com esse nome.'); }
  }
  /** O saldo inicial não muda depois de criada a conta; correções de saldo são feitas por lançamentos. */
  async atualizarConta(id: number, d: ContaBaseDto, quemId: number) {
    const c = await this.db.um('select tipo, (select count(*) from movimentacao where conta_id = $1)::int as n from conta_financeira where id = $1', [id]);
    if (!c) throw new NotFoundException('Conta não encontrada.');
    if (c.n > 0 && c.tipo !== d.tipo) throw new BadRequestException('Conta com movimentação não pode mudar de tipo.');
    this.validarConta(d);
    try {
      await this.db.query('update conta_financeira set nome=$2, tipo=$3, banco=$4, agencia=$5, numero=$6, digito=$7, tipo_conta=$8, chave_pix=$9, titular=$10, observacoes=$11 where id=$1', [id, ...this.campos(d)]);
    } catch (e) { tratarUnico(e, 'Já existe uma conta com esse nome.'); }
    await this.db.auditar(quemId, 'conta_alterada', 'conta_financeira', { id });
    return { mensagem: 'Conta atualizada.' };
  }
  /** Inativar exige saldo zerado. Reativar devolve a conta ao uso. */
  async situacaoConta(id: number, ativa: boolean, quemId: number) {
    await this.db.tx(async (c) => {
      const conta = (await c.query('select id, nome, ativa from conta_financeira where id=$1 for update', [id])).rows[0];
      if (!conta) throw new NotFoundException('Conta não encontrada.');
      if (!ativa) {
        const saldo = await saldoConta(c, id);
        if (Math.abs(saldo) > 0.004) throw new BadRequestException(`Só é possível inativar com saldo zerado (saldo atual: ${brl(saldo)}). Transfira o valor para outra conta antes.`);
      }
      await c.query('update conta_financeira set ativa=$2 where id=$1', [id, ativa]);
    });
    await this.db.auditar(quemId, ativa ? 'conta_reativada' : 'conta_inativada', 'conta_financeira', { id });
    return { mensagem: ativa ? 'Conta reativada.' : 'Conta inativada.' };
  }
  /** Conta com qualquer movimentação nunca é apagada, nem zerada: o histórico fica. */
  async removerConta(id: number, quemId: number) {
    const c = await this.db.um('select nome, (select count(*) from movimentacao where conta_id = $1)::int as n from conta_financeira where id = $1', [id]);
    if (!c) throw new NotFoundException('Conta não encontrada.');
    if (c.n > 0) throw new BadRequestException('Conta com movimentação não pode ser removida, nem zerada. Inative-a (com saldo zerado) para preservar o histórico.');
    try { await this.db.query('delete from conta_financeira where id=$1', [id]); }
    catch (e) { if ((e as { code?: string }).code === '23503') throw new BadRequestException('Conta em uso não pode ser removida.'); throw e; }
    await this.db.auditar(quemId, 'conta_removida', 'conta_financeira', { id, nome: c.nome });
    return { mensagem: 'Conta removida.' };
  }

  // ---------- lançamentos ----------
  private dataLancamento(data: string) {
    if (!dataValida(data) || data > hoje()) throw new BadRequestException('A data não pode ser futura.');
  }

  /** Receita ou despesa manual. Despesa sem saldo na conta é recusada. Mensalidade entra só pela baixa. */
  async lancarSimples(tipo: 'receita' | 'despesa', d: LancamentoDto, quemId: number) {
    this.dataLancamento(d.data);
    if (!(tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA).includes(d.categoria)) throw new BadRequestException('Categoria inválida para este tipo de lançamento.');
    if (d.associadoId && !(await this.db.um('select 1 from associado where id=$1', [d.associadoId]))) throw new BadRequestException('Associado inválido.');
    const id = await this.db.tx(async (c) => {
      const conta = await travarConta(c, d.contaId);
      if (tipo === 'despesa') await exigirSaldo(c, conta, d.valor);
      return lancar(c, { contaId: conta.id, data: d.data, tipo, sinal: tipo === 'receita' ? 1 : -1, categoria: d.categoria, historico: d.descricao.trim(), valor: d.valor, criadoPor: quemId, associadoId: d.associadoId, observacao: d.observacao?.trim() || null });
    });
    await this.db.auditar(quemId, tipo === 'receita' ? 'receita_lancada' : 'despesa_lancada', 'movimentacao', { id, valor: d.valor, contaId: d.contaId, categoria: d.categoria });
    return { id, mensagem: tipo === 'receita' ? 'Receita registrada.' : 'Despesa registrada.' };
  }

  /** Transferência: sai de uma conta e entra na outra, juntas. Não é receita nem despesa. */
  async transferir(d: TransferenciaDto, quemId: number) {
    if (d.origemId === d.destinoId) throw new BadRequestException('A conta de origem e a de destino devem ser diferentes.');
    this.dataLancamento(d.data);
    const tid = randomUUID();
    await this.db.tx(async (c) => {
      const [primeira, segunda] = [d.origemId, d.destinoId].sort((a, b) => a - b); // sempre na mesma ordem: sem impasse entre transferências simultâneas
      const contas = new Map([[primeira, await travarConta(c, primeira)], [segunda, await travarConta(c, segunda)]]);
      const origem = contas.get(d.origemId)!, destino = contas.get(d.destinoId)!;
      await exigirSaldo(c, origem, d.valor);
      const base = { data: d.data, categoria: 'Transferência', valor: d.valor, criadoPor: quemId, transferenciaId: tid, observacao: d.observacao?.trim() || null };
      await lancar(c, { ...base, contaId: origem.id, tipo: 'transferencia_saida', sinal: -1, historico: `Transferência para ${destino.nome}: ${d.historico.trim()}` });
      await lancar(c, { ...base, contaId: destino.id, tipo: 'transferencia_entrada', sinal: 1, historico: `Transferência de ${origem.nome}: ${d.historico.trim()}` });
    });
    await this.db.auditar(quemId, 'transferencia_feita', 'movimentacao', { transferenciaId: tid, origemId: d.origemId, destinoId: d.destinoId, valor: d.valor });
    return { mensagem: 'Transferência concluída.' };
  }

  /** Estorno: nada é apagado nem alterado; entra um lançamento oposto. Transferência é estornada nas duas pontas. */
  async estornar(id: number, motivo: string, quemId: number) {
    await this.db.tx(async (c) => {
      const m = (await c.query('select * from movimentacao where id=$1 for update', [id])).rows[0];
      if (!m) throw new NotFoundException('Movimentação não encontrada.');
      if (m.tipo === 'estorno') throw new BadRequestException('Um estorno não pode ser estornado.');
      if (m.pagamento_id) throw new BadRequestException('Este recebimento veio de uma baixa de mensalidade: estorne a baixa na tela Financeiro.');
      const partes = m.transferencia_id ? (await c.query('select * from movimentacao where transferencia_id=$1 order by conta_id for update', [m.transferencia_id])).rows : [m];
      for (const p of partes) if ((await c.query('select 1 from movimentacao where estorna_id=$1', [p.id])).rowCount) throw new BadRequestException('Esta movimentação já foi estornada.');
      const contas = new Map<number, { id: number; nome: string }>();
      for (const p of partes) contas.set(p.conta_id, await travarConta(c, p.conta_id)); // já em ordem de conta
      for (const p of partes) if (p.sinal === 1) await exigirSaldo(c, contas.get(p.conta_id)!, Number(p.valor)); // estornar uma entrada é uma saída
      for (const p of partes) {
        await lancar(c, { contaId: p.conta_id, data: hoje(), tipo: 'estorno', sinal: p.sinal === 1 ? -1 : 1, categoria: p.categoria, valor: Number(p.valor), criadoPor: quemId, estornaId: p.id, associadoId: p.associado_id, transferenciaId: p.transferencia_id, historico: `Estorno: ${p.historico} (${motivo.trim()})` });
      }
    });
    await this.db.auditar(quemId, 'movimentacao_estornada', 'movimentacao', { id, motivo: motivo.trim() });
    return { mensagem: 'Movimentação estornada.' };
  }

  // ---------- consultas ----------
  async resumo() {
    const contas = await this.contas();
    const mes = `${hoje().slice(0, 7)}-01`;
    const r = (await this.db.um(`select ${SOMA_RECEITAS} as receitas, ${SOMA_DESPESAS} as despesas from (${BASE}) b where b.data >= $1::date`, [mes]))!;
    return { saldoTotal: arred(contas.reduce((s, c) => s + c.saldo, 0)), receitasDoMes: Number(r.receitas), despesasDoMes: Number(r.despesas), contas };
  }

  async movimentacoes(q: MovimentacoesQueryDto) {
    const p: unknown[] = [], onde: string[] = [];
    const add = (cond: string, v: unknown) => { p.push(v); onde.push(cond.replaceAll('?', `$${p.length}`)); };
    if (q.contaId) add('b.conta_id = ?', q.contaId);
    if (q.tipo === 'transferencia') onde.push("b.tipo in ('transferencia_entrada','transferencia_saida')");
    else if (q.tipo) add('b.tipo = ?::tipo_mov', q.tipo);
    if (q.categoria) add('b.categoria = ?', q.categoria);
    if (q.de) add('b.data >= ?::date', q.de);
    if (q.ate) add('b.data <= ?::date', q.ate);
    if (q.busca) add('(b.historico ilike ? or a.nome ilike ?)', `%${esc(q.busca)}%`);
    const filtro = onde.length ? `where ${onde.join(' and ')}` : '';
    const porPagina = q.porPagina ?? 25, pagina = q.pagina ?? 1, dir = q.ordem === 'asc' ? 'asc' : 'desc';
    const juncao = 'left join associado a on a.id = b.associado_id';
    const totais = (await this.db.um(`select count(*)::int as n, ${SOMA_RECEITAS} as receitas, ${SOMA_DESPESAS} as despesas from (${BASE}) b ${juncao} ${filtro}`, p))!;
    const l = await this.db.query(`
      select b.id, b.data, b.tipo, b.sinal, b.categoria, b.historico, b.valor, b.saldo_apos, b.conta, b.conta_id, b.pagamento_id, b.estorna_id, b.observacao,
             a.nome as associado, u.nome as responsavel, exists(select 1 from movimentacao e where e.estorna_id = b.id) as estornada
      from (${BASE}) b ${juncao} left join usuario u on u.id = b.criado_por ${filtro}
      order by b.data ${dir}, b.id ${dir} limit $${p.length + 1} offset $${p.length + 2}`, [...p, porPagina, (pagina - 1) * porPagina]);
    return {
      itens: l.map((m) => ({ ...m, valor: Number(m.valor), saldoApos: Number(m.saldo_apos), saldo_apos: undefined, contaId: m.conta_id, conta_id: undefined, pagamentoId: m.pagamento_id, pagamento_id: undefined, estornaId: m.estorna_id, estorna_id: undefined })),
      total: totais.n as number, pagina, porPagina, receitas: Number(totais.receitas), despesas: Number(totais.despesas),
    };
  }
}
