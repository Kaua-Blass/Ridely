import { BadRequestException, Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { brl } from '../../common/caixa';
import { DbService } from '../../common/db.service';
import { dataValida, hoje, somarDias } from '../../common/datas';
import type { Perfil } from '../../common/perfil.enum';

/** Quem vê e exporta relatórios gerenciais. São só consultas agregadas. */
export const LER_RELATORIOS: Perfil[] = ['presidente', 'vice-presidente', 'tesoureiro', 'conselheiro'];

const SOMA_RECEITAS = "coalesce(sum(case when b.tipo = 'receita' then b.valor when b.tipo = 'estorno' and b.sinal = -1 and b.categoria <> 'Transferência' then -b.valor end), 0)";
const SOMA_DESPESAS = "coalesce(sum(case when b.tipo = 'despesa' then b.valor when b.tipo = 'estorno' and b.sinal = 1 and b.categoria <> 'Transferência' then -b.valor end), 0)";
const BASE_MOV = 'select m.data, m.tipo, m.categoria, m.valor, m.sinal from movimentacao m';

export type Formato = 'pdf' | 'csv';
const n = (v: unknown) => Number(v ?? 0);
const arred = (v: number) => Math.round(v * 100) / 100;
/** '2026-09' (ou '2026-09-01') -> '09/2026' */
const mesAno = (ref: string) => `${ref.slice(5, 7)}/${ref.slice(0, 4)}`;
const dataBr = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

/** CSV com ponto e vírgula e BOM, que o Excel em português abre sem ajuste. Células com ; " ou quebra vão entre aspas. */
export function csv(cabecalho: string[], linhas: (string | number)[][]): string {
  const cel = (v: string | number) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
  return '\uFEFF' + [cabecalho, ...linhas].map((l) => l.map(cel).join(';')).join('\r\n') + '\r\n';
}

/** Tabela simples em PDF (A4 retrato). */
export function pdfTabela(titulo: string, subtitulo: string, cabecalho: string[], linhas: (string | number)[][], larguras: number[], rodape?: string): Promise<Buffer> {
  return new Promise((resolver) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: titulo } });
    const partes: Buffer[] = [];
    doc.on('data', (c) => partes.push(c));
    doc.on('end', () => resolver(Buffer.concat(partes)));
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#1f4fb8').text(process.env.ASSOCIACAO_NOME ?? 'Associação de Transporte Escolar');
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f2442').text(titulo);
    doc.font('Helvetica').fontSize(9).fillColor('#62758f').text(subtitulo).moveDown(0.8);
    const x0 = 40, total = larguras.reduce((a, b) => a + b, 0);
    const linha = (vals: (string | number)[], negrito: boolean) => {
      const y = doc.y; let x = x0, alt = 0;
      vals.forEach((v, i) => {
        doc.font(negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(negrito ? '#0f2442' : '#1b2a3f');
        const h = doc.heightOfString(String(v ?? ''), { width: larguras[i] - 8 });
        alt = Math.max(alt, h);
        doc.text(String(v ?? ''), x + 4, y + 4, { width: larguras[i] - 8, align: typeof v === 'number' ? 'right' : 'left' });
        x += larguras[i];
      });
      doc.moveTo(x0, y + alt + 8).lineTo(x0 + total, y + alt + 8).strokeColor('#dbe3ef').stroke();
      doc.y = y + alt + 10;
      if (doc.y > doc.page.height - 60) doc.addPage();
    };
    linha(cabecalho, true);
    linhas.forEach((l) => linha(l, false));
    if (rodape) doc.moveDown(1).font('Helvetica-Bold').fontSize(10).fillColor('#0f2442').text(rodape);
    doc.end();
  });
}

@Injectable()
export class RelatoriosService {
  constructor(private readonly db: DbService) {}

  // ---------- 1. Inadimplência: mensalidades em atraso, por associado ----------
  async inadimplencia(hojeIso = hoje()) {
    const l = await this.db.query(
      `select a.id, a.nome, count(*)::int as meses,
              string_agg(m.referencia, ', ' order by m.vencimento) as referencias,
              min(m.vencimento) as mais_antigo, sum(m.valor)::float8 as valor
       from mensalidade m join associado a on a.id = m.associado_id
       where m.cancelada_em is null and m.vencimento < $1::date
         and not exists (select 1 from pagamento p where p.mensalidade_id = m.id and p.estornado_em is null)
       group by a.id, a.nome order by sum(m.valor) desc, a.nome`, [hojeIso]);
    const total = arred(l.reduce((s, r) => s + n(r.valor), 0));
    return {
      geradoEm: hojeIso, total, associados: l.length, meses: l.reduce((s, r) => s + r.meses, 0),
      itens: l.map((r) => ({ id: r.id, nome: r.nome, meses: r.meses, referencias: r.referencias, maisAntigo: r.mais_antigo, valor: arred(n(r.valor)) })),
    };
  }

  // ---------- 2. Fluxo de caixa por mês (regime de caixa, sem transferências) ----------
  async fluxoCaixa(de?: string, ate?: string) {
    const fim = ate ?? hoje();
    const ini = de ?? `${somarDias(fim, -365).slice(0, 7)}-01`;
    if (!dataValida(ini) || !dataValida(fim) || fim < ini) throw new BadRequestException('Período inválido.');
    const l = await this.db.query(
      `select to_char(b.data, 'YYYY-MM') as mes, ${SOMA_RECEITAS} as receitas, ${SOMA_DESPESAS} as despesas
       from (${BASE_MOV}) b
       where b.data between $1::date and $2::date
       group by 1 order by 1`, [ini, fim]);
    const meses = l.map((r) => {
      const receitas = arred(n(r.receitas)), despesas = arred(n(r.despesas));
      return { mes: r.mes, receitas, despesas, saldo: arred(receitas - despesas) };
    });
    const totais = meses.reduce((t, m) => ({ receitas: arred(t.receitas + m.receitas), despesas: arred(t.despesas + m.despesas), saldo: arred(t.saldo + m.saldo) }), { receitas: 0, despesas: 0, saldo: 0 });
    const saldoInicial = n((await this.db.um(
      `select coalesce(sum(cf.saldo_inicial), 0) + coalesce((select sum(m.sinal * m.valor) from movimentacao m where m.data < $1::date), 0) as v
       from conta_financeira cf`, [ini]))!.v);
    return { de: ini, ate: fim, saldoInicial: arred(saldoInicial), meses, totais: { ...totais, saldoFinal: arred(saldoInicial + totais.saldo) } };
  }

  // ---------- 3. Contratos a vencer (vigentes que terminam dentro do prazo do parâmetro) ----------
  async contratosAVencer(hojeIso = hoje()) {
    const alerta = n((await this.db.um("select valor from parametro where chave='alerta_renovacao_dias'"))?.valor ?? 30);
    const l = await this.db.query(
      `select c.id, a.nome as associado, c.inicio, c.fim, c.valor_por_dia::float8 as valor_por_dia, c.dias_semana
       from contrato c join associado a on a.id = c.associado_id
       where c.status = 'vigente' and c.fim >= $1::date and c.fim <= $1::date + $2::int
       order by c.fim, a.nome`, [hojeIso, alerta]);
    return {
      geradoEm: hojeIso, prazoDias: alerta,
      itens: l.map((r) => ({
        id: r.id, associado: r.associado, inicio: r.inicio, fim: r.fim, valorPorDia: n(r.valor_por_dia),
        diasParaVencer: Math.round((Date.parse(`${String(r.fim).slice(0, 10)}T12:00:00Z`) - Date.parse(`${hojeIso}T12:00:00Z`)) / 86_400_000),
      })),
    };
  }

  // ---------- painel: indicadores por perfil ----------
  async painel(quem: { perfil: Perfil; associadoId: number | null }) {
    const h = hoje(), mes = `${h.slice(0, 7)}-01`, ref = h.slice(0, 7);
    if (quem.perfil === 'associado') {
      const a = quem.associadoId;
      const mens = await this.db.um(
        `select count(*) filter (where m.cancelada_em is null and m.vencimento < $2::date and not exists (select 1 from pagamento p where p.mensalidade_id=m.id and p.estornado_em is null))::int as atrasadas,
                coalesce(sum(m.valor) filter (where m.cancelada_em is null and m.vencimento < $2::date and not exists (select 1 from pagamento p where p.mensalidade_id=m.id and p.estornado_em is null)),0)::float8 as valor_atrasado,
                count(*) filter (where m.referencia = $3 and m.cancelada_em is null)::int as do_mes
         from mensalidade m where m.associado_id = $1`, [a, h, ref]);
      const prox = await this.db.um(
        `select referencia, vencimento, valor::float8 as valor from mensalidade m
         where m.associado_id=$1 and m.cancelada_em is null and m.vencimento >= $2::date
           and not exists (select 1 from pagamento p where p.mensalidade_id=m.id and p.estornado_em is null)
         order by vencimento limit 1`, [a, h]);
      const contrato = await this.db.um("select fim from contrato where associado_id=$1 and status='vigente' order by fim desc limit 1", [a]);
      return { perfil: 'associado', indicadores: [
        { rotulo: 'Mensalidades em atraso', valor: mens!.atrasadas, detalhe: mens!.atrasadas ? brl(n(mens!.valor_atrasado)) : 'Nenhuma' },
        { rotulo: 'Próximo vencimento', valor: prox ? dataBr(prox.vencimento) : '—', detalhe: prox ? `${mesAno(prox.referencia)} · ${brl(n(prox.valor))}` : 'Nada em aberto' },
        { rotulo: 'Contrato vigente até', valor: contrato ? dataBr(contrato.fim) : '—', detalhe: contrato ? '' : 'Sem contrato vigente' },
      ] };
    }
    if (quem.perfil === 'motorista') {
      return { perfil: 'motorista', indicadores: [
        { rotulo: 'Viagens da sua rota', valor: 'Ver na tela Transporte', detalhe: 'lista de passageiros e marcação de embarque' },
      ] };
    }
    // gerenciais (presidente, vice, tesoureiro, conselheiro)
    const caixa = await this.db.um(
      `select coalesce(sum(cf.saldo_inicial),0) + coalesce((select sum(m.sinal*m.valor) from movimentacao m),0) as saldo from conta_financeira cf where cf.ativa`);
    const mensMes = await this.db.um(
      `select count(*) filter (where m.cancelada_em is null)::int as geradas,
              count(*) filter (where p.id is not null)::int as pagas,
              coalesce(sum(m.valor) filter (where m.cancelada_em is null),0)::float8 as previsto,
              coalesce(sum(p.valor) filter (where p.id is not null),0)::float8 as recebido
       from mensalidade m left join pagamento p on p.mensalidade_id=m.id and p.estornado_em is null
       where m.referencia = $1`, [ref]);
    const inad = await this.inadimplencia(h);
    const venc = await this.contratosAVencer(h);
    const ind = [
      { rotulo: 'Saldo em caixa e bancos', valor: brl(n(caixa!.saldo)), detalhe: 'contas ativas' },
      { rotulo: `Mensalidades de ${mesAno(ref)}`, valor: `${n(mensMes!.pagas)} de ${n(mensMes!.geradas)} pagas`, detalhe: `${brl(n(mensMes!.recebido))} recebidos de ${brl(n(mensMes!.previsto))}` },
      { rotulo: 'Inadimplência', valor: brl(inad.total), detalhe: `${inad.associados} associado(s), ${inad.meses} mensalidade(s)` },
      { rotulo: 'Contratos a vencer', valor: venc.itens.length, detalhe: `nos próximos ${venc.prazoDias} dias` },
    ];
    if (quem.perfil === 'tesoureiro') ind.reverse(); // o tesoureiro vê primeiro a inadimplência e a cobrança
    return { perfil: 'gerencial', indicadores: ind };
  }

  // ---------- exportação ----------
  async exportar(tipo: 'inadimplencia' | 'fluxo' | 'contratos', formato: Formato, de?: string, ate?: string) {
    const hojeIso = hoje();
    if (tipo === 'inadimplencia') {
      const d = await this.inadimplencia(hojeIso);
      const cab = ['Associado', 'Meses', 'Referências', 'Mais antigo', 'Valor (R$)'];
      const linhas = d.itens.map((r) => [r.nome, r.meses, r.referencias, dataBr(r.maisAntigo), r.valor.toFixed(2).replace('.', ',')]);
      return formato === 'csv'
        ? { nome: `inadimplencia-${hojeIso}.csv`, tipo: 'text/csv; charset=utf-8', corpo: Buffer.from(csv(cab, linhas), 'utf8') }
        : { nome: `inadimplencia-${hojeIso}.pdf`, tipo: 'application/pdf', corpo: await pdfTabela('Inadimplência', `Gerado em ${dataBr(hojeIso)} · mensalidades vencidas e não pagas`, cab, linhas.map((l) => [l[0], l[1], l[2], l[3], brl(Number(String(l[4]).replace(',', '.')))]), [170, 50, 165, 75, 90], `Total em aberto: ${brl(d.total)}`) };
    }
    if (tipo === 'fluxo') {
      const d = await this.fluxoCaixa(de, ate);
      const cab = ['Mês', 'Receitas (R$)', 'Despesas (R$)', 'Saldo do mês (R$)'];
      const f = (v: number) => v.toFixed(2).replace('.', ',');
      const linhas = d.meses.map((m) => [mesAno(m.mes), f(m.receitas), f(m.despesas), f(m.saldo)]);
      linhas.push(['Total', f(d.totais.receitas), f(d.totais.despesas), f(d.totais.saldo)]);
      return formato === 'csv'
        ? { nome: `fluxo-de-caixa-${d.de}-${d.ate}.csv`, tipo: 'text/csv; charset=utf-8', corpo: Buffer.from(csv(cab, linhas), 'utf8') }
        : { nome: `fluxo-de-caixa-${d.de}-${d.ate}.pdf`, tipo: 'application/pdf', corpo: await pdfTabela('Fluxo de caixa', `Período ${dataBr(d.de)} a ${dataBr(d.ate)} · saldo inicial ${brl(d.saldoInicial)} · saldo final ${brl(d.totais.saldoFinal)} · transferências não entram`, cab, linhas.map((l) => [l[0], brl(Number(String(l[1]).replace(',', '.'))), brl(Number(String(l[2]).replace(',', '.'))), brl(Number(String(l[3]).replace(',', '.')))]), [150, 130, 130, 130], `Saldo final do período: ${brl(d.totais.saldoFinal)}`) };
    }
    const d = await this.contratosAVencer(hojeIso);
    const cab = ['Associado', 'Início', 'Término', 'Dias para vencer', 'Valor por dia (R$)'];
    const linhas = d.itens.map((r) => [r.associado, dataBr(r.inicio), dataBr(r.fim), r.diasParaVencer, r.valorPorDia.toFixed(2).replace('.', ',')]);
    return formato === 'csv'
      ? { nome: `contratos-a-vencer-${hojeIso}.csv`, tipo: 'text/csv; charset=utf-8', corpo: Buffer.from(csv(cab, linhas), 'utf8') }
      : { nome: `contratos-a-vencer-${hojeIso}.pdf`, tipo: 'application/pdf', corpo: await pdfTabela('Contratos a vencer', `Gerado em ${dataBr(hojeIso)} · término nos próximos ${d.prazoDias} dias`, cab, linhas.map((l) => [l[0], l[1], l[2], l[3], brl(Number(String(l[4]).replace(',', '.')))]), [170, 75, 75, 90, 100]) };
  }
}
