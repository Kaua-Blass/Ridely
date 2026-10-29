import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DbService } from '../../common/db.service';
import { diasEntre, hoje } from '../../common/datas';
import { NotificacoesService, NovaNotificacao } from './notificacoes.service';
import {
  chaveCobranca, chaveContrato, chaveLembrete, chaveResumo, dentroDoLembrete, faixaCobranca, faixaContrato,
  textoCobranca, textoContratoAssociado, textoContratoEquipe, textoLembrete, textoResumoCobranca,
} from './regras';

export interface ResultadoRotina { criadas: number; ignoradas: number; detalhe?: string }

export const ROTINAS = [
  { id: 'lembrete-vencimento', nome: 'Lembrete de vencimento', descricao: 'Avisa quem tem mensalidade em aberto que vence nos próximos dias (parâmetro "dias de antecedência"; 0 desliga).' },
  { id: 'cobranca-atrasados', nome: 'Cobrança de atrasados', descricao: 'Avisa quem está com mensalidade vencida, com valor e multa, uma vez a cada "intervalo de cobrança" (0 desliga).' },
  { id: 'contratos-a-vencer', nome: 'Contratos a vencer', descricao: 'Avisa o associado e a equipe (presidente, vice e auxiliar) quando o contrato entra no prazo de renovação e nos últimos 7 dias.' },
  { id: 'reenviar-emails', nome: 'Reenvio de e-mails com falha', descricao: 'Tenta de novo os e-mails que falharam (até 3 tentativas, só dos últimos 3 dias).' },
] as const;
type RotinaId = (typeof ROTINAS)[number]['id'];

/** Identificador da trava de execução no PostgreSQL: só uma rotina roda por vez, mesmo com mais de um servidor. */
const TRAVA = 740006;

@Injectable()
export class RotinasService {
  private readonly log = new Logger('Rotinas');
  constructor(private readonly db: DbService, private readonly notif: NotificacoesService) {}

  private async param(chave: string, padrao: number): Promise<number> {
    const r = await this.db.um('select valor from parametro where chave = $1', [chave]);
    const n = r ? Number(r.valor) : NaN;
    return Number.isFinite(n) ? n : padrao;
  }

  // ---------- as rotinas ----------
  /** Mensalidades em aberto que vencem de hoje até daqui a N dias. */
  async lembreteVencimento(): Promise<ResultadoRotina> {
    const dias = await this.param('lembrete_vencimento_dias', 3);
    if (dias <= 0) return { criadas: 0, ignoradas: 0, detalhe: 'Rotina desligada (dias de antecedência = 0).' };
    const dia = hoje(), multa = await this.param('multa_percentual', 5);
    const l = await this.db.query(
      `select m.id, m.referencia, m.vencimento, m.valor::float8 as valor, u.id as usuario_id
       from mensalidade m
       join associado a on a.id = m.associado_id and a.situacao = 'ativo'
       join usuario u on u.associado_id = a.id and u.ativo
       where m.cancelada_em is null
         and not exists (select 1 from pagamento p where p.mensalidade_id = m.id and p.estornado_em is null)
         and m.vencimento >= $1::date and m.vencimento <= $1::date + $2::int
       order by m.vencimento, m.id`, [dia, dias]);
    const lista: NovaNotificacao[] = l.filter((m) => dentroDoLembrete(diasEntre(dia, m.vencimento), dias)).map((m) => ({
      usuarioId: m.usuario_id, tipo: 'lembrete_vencimento', ...textoLembrete(m, diasEntre(dia, m.vencimento), multa),
      link: '/financeiro', chave: chaveLembrete(m.id),
    }));
    return this.gravarEEnviar(lista);
  }

  /** Mensalidades vencidas e não pagas: uma cobrança por faixa de dias de atraso. */
  async cobrancaAtrasados(): Promise<ResultadoRotina> {
    const intervalo = await this.param('cobranca_intervalo_dias', 7);
    if (intervalo <= 0) return { criadas: 0, ignoradas: 0, detalhe: 'Rotina desligada (intervalo de cobrança = 0).' };
    const dia = hoje(), multa = await this.param('multa_percentual', 5);
    const l = await this.db.query(
      `select m.id, m.referencia, m.vencimento, m.valor::float8 as valor, u.id as usuario_id
       from mensalidade m
       join associado a on a.id = m.associado_id and a.situacao = 'ativo'
       join usuario u on u.associado_id = a.id and u.ativo
       where m.cancelada_em is null and m.vencimento < $1::date
         and not exists (select 1 from pagamento p where p.mensalidade_id = m.id and p.estornado_em is null)
       order by m.vencimento, m.id`, [dia]);
    const lista: NovaNotificacao[] = [];
    const valores = new Map<number, number>();
    for (const m of l) {
      const atraso = diasEntre(m.vencimento, dia), faixa = faixaCobranca(atraso, intervalo);
      if (faixa === null) continue;
      lista.push({ usuarioId: m.usuario_id, tipo: 'cobranca_atraso', ...textoCobranca(m, atraso, multa), link: '/financeiro', chave: chaveCobranca(m.id, faixa) });
      valores.set(m.id, m.valor);
    }
    const r = await this.gravarEEnviar(lista);
    // resumo para a diretoria financeira: no máximo um por dia
    if (r.criadas > 0) {
      const novas = lista.filter((n) => r.chavesNovas.has(`${n.usuarioId}|${n.chave}`));
      const total = novas.reduce((s, n) => s + (valores.get(Number(n.chave!.split(':')[1].slice(1))) ?? 0), 0);
      const donos = await this.notif.usuariosPorPerfil(['presidente', 'tesoureiro']);
      await this.notif.criar(donos.map((id) => ({ usuarioId: id, tipo: 'resumo_rotina' as const, ...textoResumoCobranca(r.criadas, Math.round(total * 100) / 100), link: '/financeiro', chave: chaveResumo('cobranca', dia), email: false })));
    }
    return { criadas: r.criadas, ignoradas: r.ignoradas };
  }

  /** Contratos vigentes que terminam dentro do prazo de renovação: aviso ao associado e à equipe. */
  async contratosAVencer(): Promise<ResultadoRotina> {
    const alerta = await this.param('alerta_renovacao_dias', 30);
    if (alerta <= 0) return { criadas: 0, ignoradas: 0, detalhe: 'Rotina desligada (dias de alerta de renovação = 0).' };
    const dia = hoje();
    const l = await this.db.query(
      `select c.id, c.fim, a.nome, u.id as usuario_id
       from contrato c
       join associado a on a.id = c.associado_id and a.situacao = 'ativo'
       left join usuario u on u.associado_id = a.id and u.ativo
       where c.status = 'vigente' and c.fim >= $1::date and c.fim <= $1::date + $2::int
       order by c.fim, c.id`, [dia, alerta]);
    const equipe = await this.notif.usuariosPorPerfil(['presidente', 'vice_presidente', 'auxiliar']);
    const lista: NovaNotificacao[] = [];
    for (const c of l) {
      const dias = diasEntre(dia, c.fim), faixa = faixaContrato(dias, alerta);
      if (!faixa) continue;
      const chave = chaveContrato(c.id, c.fim, faixa);
      if (c.usuario_id) lista.push({ usuarioId: c.usuario_id, tipo: 'contrato_a_vencer', ...textoContratoAssociado(c.fim, dias), link: '/contratos', chave });
      for (const u of equipe) lista.push({ usuarioId: u, tipo: 'contrato_a_vencer', ...textoContratoEquipe(c.nome, c.fim, dias), link: '/contratos', chave });
    }
    const r = await this.gravarEEnviar(lista);
    return { criadas: r.criadas, ignoradas: r.ignoradas };
  }

  async reenviarEmails(): Promise<ResultadoRotina> {
    const r = await this.notif.reenviarFalhas();
    return { criadas: r.reenviados, ignoradas: r.falhas, detalhe: `${r.reenviados} e-mail(s) entregue(s); ${r.falhas} ainda com falha.` };
  }

  private async gravarEEnviar(lista: NovaNotificacao[]) {
    const { criadas, ignoradas } = await this.notif.criar(lista);
    await this.notif.despachar(criadas);
    // quem foi realmente criado (para o resumo): confere pelas chaves gravadas agora
    const novas = new Set<string>();
    if (criadas.length) {
      for (const r of await this.db.query('select usuario_id, chave from notificacao where id = any($1::bigint[])', [criadas])) novas.add(`${r.usuario_id}|${r.chave}`);
    }
    return { criadas: criadas.length, ignoradas, chavesNovas: novas };
  }

  // ---------- execução com histórico e trava ----------
  /** Roda uma rotina, grava o histórico e impede duas execuções ao mesmo tempo. */
  async executar(id: string, origem: 'agendada' | 'manual', por?: number): Promise<ResultadoRotina> {
    const def = ROTINAS.find((r) => r.id === id);
    if (!def) throw new NotFoundException('Rotina não encontrada.');
    const conexao = await this.db.pool.connect();
    try {
      const ok = (await conexao.query('select pg_try_advisory_lock($1) as ok', [TRAVA])).rows[0].ok;
      if (!ok) throw new ConflictException('Já existe uma rotina em execução. Tente de novo em instantes.');
      try {
        const exec = (await this.db.query('insert into rotina_execucao(rotina, origem, por) values($1,$2,$3) returning id', [id, origem, por ?? null]))[0].id;
        try {
          const r = await this.rodar(def.id);
          await this.db.query('update rotina_execucao set concluida_em = now(), criadas = $2, ignoradas = $3 where id = $1', [exec, r.criadas, r.ignoradas]);
          return r;
        } catch (e) {
          await this.db.query('update rotina_execucao set concluida_em = now(), erro = $2 where id = $1', [exec, (e as Error).message.slice(0, 300)]);
          throw e;
        }
      } finally {
        await conexao.query('select pg_advisory_unlock($1)', [TRAVA]);
      }
    } finally {
      conexao.release();
    }
  }

  private rodar(id: RotinaId): Promise<ResultadoRotina> {
    switch (id) {
      case 'lembrete-vencimento': return this.lembreteVencimento();
      case 'cobranca-atrasados': return this.cobrancaAtrasados();
      case 'contratos-a-vencer': return this.contratosAVencer();
      case 'reenviar-emails': return this.reenviarEmails();
    }
  }

  /** Estado de cada rotina para a tela: última execução e parâmetros em vigor. */
  async situacao() {
    const ultimas = await this.db.query(
      `select distinct on (rotina) rotina, origem, iniciada_em, concluida_em, criadas, ignoradas, erro
       from rotina_execucao order by rotina, iniciada_em desc`);
    return {
      smtpConfigurado: !!process.env.SMTP_URL,
      agendamento: process.env.ROTINAS_AUTOMATICAS === 'false' ? 'desligado' : 'todos os dias às 8h (horário de Brasília)',
      parametros: {
        lembreteVencimentoDias: await this.param('lembrete_vencimento_dias', 3),
        cobrancaIntervaloDias: await this.param('cobranca_intervalo_dias', 7),
        alertaRenovacaoDias: await this.param('alerta_renovacao_dias', 30),
      },
      rotinas: ROTINAS.map((r) => {
        const u = ultimas.find((x) => x.rotina === r.id);
        return { ...r, ultima: u ? { origem: u.origem, iniciadaEm: u.iniciada_em, concluidaEm: u.concluida_em, criadas: u.criadas, ignoradas: u.ignoradas, erro: u.erro } : null };
      }),
    };
  }

  // ---------- agendamento ----------
  /** Todos os dias às 8h de Brasília. Se o servidor ficar parado, as faixas das rotinas recuperam o que passou. */
  @Cron('0 8 * * *', { name: 'rotinas-diarias', timeZone: 'America/Sao_Paulo' })
  async diarias() {
    if (process.env.ROTINAS_AUTOMATICAS === 'false') return;
    for (const r of ROTINAS) {
      try {
        const x = await this.executar(r.id, 'agendada');
        this.log.log(`${r.id}: ${x.criadas} criada(s), ${x.ignoradas} ignorada(s)`);
      } catch (e) {
        this.log.error(`${r.id} falhou: ${(e as Error).message}`);
      }
    }
  }
}
