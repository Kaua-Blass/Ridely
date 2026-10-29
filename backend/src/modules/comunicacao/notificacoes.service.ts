import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DbService } from '../../common/db.service';
import { MailService } from '../../common/mail.service';
import { MAX_TENTATIVAS_EMAIL, TipoNotificacao } from './regras';

export interface NovaNotificacao {
  usuarioId: number;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  /** Caminho dentro do sistema (ex.: /financeiro), usado no painel e no botão do e-mail. */
  link?: string | null;
  comunicadoId?: number | null;
  /** Identifica o evento: a mesma pessoa nunca recebe duas notificações com a mesma chave. */
  chave?: string | null;
  /** false = só no painel (padrão: painel e e-mail). */
  email?: boolean;
}

const LOTE_EMAIL = 5;
const baseUrl = () => process.env.APP_URL ?? 'http://localhost:5173';

/** Notificações do painel e a entrega delas por e-mail. */
@Injectable()
export class NotificacoesService {
  private readonly log = new Logger('Notificacoes');
  constructor(private readonly db: DbService, private readonly mail: MailService) {}

  // ---------- criação ----------
  /** Grava as notificações. Chave repetida para a mesma pessoa é ignorada (rotinas podem rodar mais de uma vez sem duplicar). */
  async criar(lista: NovaNotificacao[], c?: PoolClient): Promise<{ criadas: number[]; ignoradas: number }> {
    const q = (sql: string, p: unknown[]) => (c ? c.query(sql, p).then((r) => r.rows) : this.db.query(sql, p));
    const criadas: number[] = [];
    for (const n of lista) {
      const rows = await q(
        `insert into notificacao(usuario_id, tipo, titulo, mensagem, link, comunicado_id, chave, email_status)
         values($1,$2,$3,$4,$5,$6,$7,$8)
         on conflict (usuario_id, chave) where chave is not null do nothing returning id`,
        [n.usuarioId, n.tipo, n.titulo, n.mensagem, n.link ?? null, n.comunicadoId ?? null, n.chave ?? null, n.email === false ? 'dispensado' : 'pendente']);
      if (rows[0]) criadas.push(Number(rows[0].id));
    }
    return { criadas, ignoradas: lista.length - criadas.length };
  }

  // ---------- entrega por e-mail ----------
  /** Envia o e-mail das notificações pendentes ou com falha e registra o resultado de cada uma. Nunca lança erro. */
  async despachar(ids: number[]): Promise<{ enviados: number; falhas: number }> {
    const total = { enviados: 0, falhas: 0 };
    if (!ids.length) return total;
    try {
      const linhas = await this.db.query(
        `select n.id, n.titulo, n.mensagem, n.link, u.email
         from notificacao n join usuario u on u.id = n.usuario_id
         where n.id = any($1::bigint[]) and n.email_status in ('pendente','falhou') and u.ativo
         order by n.id`, [ids]);
      for (let i = 0; i < linhas.length; i += LOTE_EMAIL) {
        await Promise.all(linhas.slice(i, i + LOTE_EMAIL).map(async (n) => {
          const r = await this.mail.enviar(n.email, `Ridely: ${n.titulo}`, n.titulo, String(n.mensagem).split('\n'),
            n.link ? { texto: 'Abrir no Ridely', url: `${baseUrl()}${n.link}` } : undefined);
          await this.db.query(
            `update notificacao set email_status = $2, email_tentativas = email_tentativas + 1, email_erro = $3,
                    email_enviado_em = case when $2 = 'enviado' then now() else email_enviado_em end where id = $1`,
            [n.id, r.status, r.status === 'falhou' ? r.erro ?? 'Falha desconhecida' : null]);
          if (r.status === 'falhou') total.falhas++; else total.enviados++;
        }));
      }
    } catch (e) {
      this.log.error(`Falha ao despachar e-mails: ${(e as Error).message}`);
    }
    return total;
  }

  /** Nova tentativa para e-mails que falharam (até MAX_TENTATIVAS, só nas notificações dos últimos 3 dias). */
  async reenviarFalhas(limite = 200): Promise<{ reenviados: number; falhas: number }> {
    const ids = (await this.db.query(
      `select id from notificacao where email_status = 'falhou' and email_tentativas < $1 and criada_em > now() - interval '3 days'
       order by id limit $2`, [MAX_TENTATIVAS_EMAIL, limite])).map((r) => Number(r.id));
    const r = await this.despachar(ids);
    return { reenviados: r.enviados, falhas: r.falhas };
  }

  // ---------- painel da pessoa logada ----------
  async listar(usuarioId: number, q: { pagina?: number; porPagina?: number; apenasNaoLidas?: boolean }) {
    const porPagina = q.porPagina ?? 20, pagina = q.pagina ?? 1;
    const l = await this.db.query(
      `select id, tipo, titulo, mensagem, link, comunicado_id, lida_em, criada_em, count(*) over() as total
       from notificacao where usuario_id = $1 ${q.apenasNaoLidas ? 'and lida_em is null' : ''}
       order by criada_em desc, id desc limit $2 offset $3`, [usuarioId, porPagina, (pagina - 1) * porPagina]);
    return {
      itens: l.map((n) => ({ id: Number(n.id), tipo: n.tipo, titulo: n.titulo, mensagem: n.mensagem, link: n.link, comunicadoId: n.comunicado_id, lida: !!n.lida_em, criadaEm: n.criada_em })),
      total: l.length ? Number(l[0].total) : 0, pagina, porPagina,
      naoLidas: await this.naoLidas(usuarioId),
    };
  }
  async naoLidas(usuarioId: number): Promise<number> {
    return Number((await this.db.um('select count(*) as n from notificacao where usuario_id = $1 and lida_em is null', [usuarioId]))!.n);
  }
  async marcarLida(usuarioId: number, id: number) {
    const r = await this.db.query('update notificacao set lida_em = coalesce(lida_em, now()) where id = $1 and usuario_id = $2 returning id', [id, usuarioId]);
    if (!r.length) throw new NotFoundException('Notificação não encontrada.'); // de outra pessoa também cai aqui
    return { naoLidas: await this.naoLidas(usuarioId) };
  }
  async marcarTodasLidas(usuarioId: number) {
    const r = await this.db.query('update notificacao set lida_em = now() where usuario_id = $1 and lida_em is null returning id', [usuarioId]);
    return { marcadas: r.length, naoLidas: 0 };
  }

  // ---------- destinatários ----------
  /** Usuários ativos por perfil do banco (ex.: 'presidente', 'vice_presidente'). */
  async usuariosPorPerfil(perfis: string[]): Promise<number[]> {
    return (await this.db.query('select id from usuario where ativo and perfil::text = any($1::text[]) order by id', [perfis])).map((r) => r.id);
  }
}
