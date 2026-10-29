import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { basename, join } from 'path';
import { MIME_ANEXO, pastaComunicados, tipoAnexo } from '../../common/arquivos';
import { DbService } from '../../common/db.service';
import type { UsuarioPublico } from '../../common/usuario';
import { CriarComunicadoDto, EditarComunicadoDto, ListaQueryDto } from './dto/comunicacao.dto';
import { NotificacoesService } from './notificacoes.service';
import { resumir, ROTULO_TIPO, TIPOS_TESOUREIRO, TipoComunicado } from './regras';

/** Quem publica e administra comunicados (o tesoureiro só nos tipos de TIPOS_TESOUREIRO). */
export const GERENTES = ['presidente', 'vice-presidente', 'tesoureiro'] as const;
const ehGerente = (q: UsuarioPublico) => (GERENTES as readonly string[]).includes(q.perfil);

@Injectable()
export class ComunicacaoService {
  constructor(private readonly db: DbService, private readonly notificacoes: NotificacoesService) {}

  // ---------- apoio ----------
  /** O tesoureiro só mexe em cobrança e aviso; presidente e vice, em qualquer tipo. */
  private exigirTipo(tipo: string, quem: UsuarioPublico) {
    if (quem.perfil === 'tesoureiro' && !TIPOS_TESOUREIRO.includes(tipo as TipoComunicado)) {
      throw new ForbiddenException('O tesoureiro só publica comunicados dos tipos Cobrança e Aviso.');
    }
  }
  private async buscar(id: number) {
    const c = await this.db.um('select * from comunicado where id = $1', [id]);
    if (!c) throw new NotFoundException('Comunicado não encontrado.');
    return c;
  }
  /** Gerentes veem tudo; os demais, só o que é para todos ou para eles. */
  private podeVer(c: { destinatario_id: number | null }, quem: UsuarioPublico) {
    return ehGerente(quem) || c.destinatario_id === null || c.destinatario_id === quem.associadoId;
  }
  private forma(c: any, quem: UsuarioPublico) {
    const gerente = ehGerente(quem);
    const podeEditar = gerente && !(quem.perfil === 'tesoureiro' && !TIPOS_TESOUREIRO.includes(c.tipo));
    return {
      id: c.id, tipo: c.tipo as TipoComunicado, tipoNome: ROTULO_TIPO[c.tipo as TipoComunicado], titulo: c.titulo, mensagem: c.mensagem,
      destinatario: c.destinatario_id ? { id: c.destinatario_id, nome: c.destinatario_nome } : null,
      anexoNome: c.anexo_path ? c.anexo_nome ?? 'anexo' : null,
      criadoEm: c.criado_em, criadoPor: c.autor, atualizadoEm: c.atualizado_em, podeEditar,
      // entrega por e-mail só interessa a quem publica
      entregas: gerente ? { total: Number(c.n_total), lidas: Number(c.n_lidas), emailsFalharam: Number(c.n_falhas) } : null,
    };
  }

  // ---------- leitura ----------
  async listar(quem: UsuarioPublico, q: ListaQueryDto) {
    const porPagina = q.porPagina ?? 20, pagina = q.pagina ?? 1;
    const l = await this.db.query(
      `select c.*, d.nome as destinatario_nome, u.nome as autor,
              (select count(*) from notificacao n where n.comunicado_id = c.id) as n_total,
              (select count(*) from notificacao n where n.comunicado_id = c.id and n.lida_em is not null) as n_lidas,
              (select count(*) from notificacao n where n.comunicado_id = c.id and n.email_status = 'falhou') as n_falhas,
              count(*) over() as total
       from comunicado c
       left join associado d on d.id = c.destinatario_id
       left join usuario u on u.id = c.criado_por
       where ($1::boolean or c.destinatario_id is null or c.destinatario_id = $2)
       order by c.criado_em desc, c.id desc limit $3 offset $4`,
      [ehGerente(quem), quem.associadoId, porPagina, (pagina - 1) * porPagina]);
    return { itens: l.map((c) => this.forma(c, quem)), total: l.length ? Number(l[0].total) : 0, pagina, porPagina };
  }

  /** Associados ativos que podem ser escolhidos como destinatário. */
  destinatarios() {
    return this.db.query("select id, nome from associado where situacao = 'ativo' order by nome");
  }

  // ---------- escrita ----------
  async criar(d: CriarComunicadoDto, quem: UsuarioPublico) {
    this.exigirTipo(d.tipo, quem);
    const destId = d.destinatarioId ?? null;
    if (destId !== null) {
      const a = await this.db.um('select situacao from associado where id = $1', [destId]);
      if (!a) throw new BadRequestException('Associado não encontrado.');
      if (a.situacao !== 'ativo') throw new BadRequestException('Só é possível enviar a associados ativos.');
    }
    const r = await this.db.tx(async (c) => {
      const id = (await c.query(
        'insert into comunicado(tipo, titulo, mensagem, destinatario_id, criado_por) values($1,$2,$3,$4,$5) returning id',
        [d.tipo, d.titulo, d.mensagem, destId, quem.id])).rows[0].id as number;
      // quem recebe: todos os usuários ativos (menos o autor) ou o usuário do associado escolhido
      const alvo = destId === null
        ? (await c.query('select id from usuario where ativo and id <> $1 order by id', [quem.id])).rows
        : (await c.query('select id from usuario where ativo and associado_id = $1 and id <> $2 order by id', [destId, quem.id])).rows;
      const { criadas } = await this.notificacoes.criar(alvo.map((u) => ({
        usuarioId: u.id, tipo: 'comunicado' as const, titulo: d.titulo, mensagem: resumir(d.mensagem),
        link: '/comunicacao?aba=Comunicados', comunicadoId: id, email: d.enviarEmail !== false,
      })), c);
      return { id, criadas };
    });
    // e-mails saem depois de gravar e sem segurar a resposta: o resultado de cada um fica registrado na notificação
    if (d.enviarEmail !== false) void this.notificacoes.despachar(r.criadas);
    await this.db.auditar(quem.id, 'comunicado_criado', 'comunicado', { id: r.id, tipo: d.tipo, destinatarioId: destId, alcance: r.criadas.length });
    const semAcesso = destId !== null && r.criadas.length === 0;
    return {
      id: r.id,
      mensagem: semAcesso
        ? 'Comunicado publicado, mas esse associado ainda não tem acesso ao sistema e não foi avisado.'
        : `Comunicado publicado e enviado a ${r.criadas.length} ${r.criadas.length === 1 ? 'pessoa' : 'pessoas'}.`,
    };
  }

  async editar(id: number, d: EditarComunicadoDto, quem: UsuarioPublico) {
    const c = await this.buscar(id);
    this.exigirTipo(c.tipo, quem);
    const tipo = d.tipo ?? c.tipo;
    this.exigirTipo(tipo, quem);
    const titulo = d.titulo ?? c.titulo, mensagem = d.mensagem ?? c.mensagem;
    await this.db.tx(async (t) => {
      await t.query('update comunicado set tipo=$2, titulo=$3, mensagem=$4, atualizado_em=now(), atualizado_por=$5 where id=$1', [id, tipo, titulo, mensagem, quem.id]);
      // o painel de quem já foi avisado passa a mostrar o texto corrigido
      await t.query('update notificacao set titulo=$2, mensagem=$3 where comunicado_id=$1', [id, titulo, resumir(mensagem)]);
    });
    await this.db.auditar(quem.id, 'comunicado_editado', 'comunicado', { id });
    return { mensagem: 'Comunicado atualizado. Quem já foi avisado vê o texto corrigido; ninguém é avisado de novo.' };
  }

  async remover(id: number, quem: UsuarioPublico) {
    const c = await this.buscar(id);
    this.exigirTipo(c.tipo, quem);
    await this.db.query('delete from comunicado where id = $1', [id]); // as notificações dele saem junto (ON DELETE CASCADE)
    if (c.anexo_path) await unlink(join(pastaComunicados(), basename(c.anexo_path))).catch(() => undefined);
    await this.db.auditar(quem.id, 'comunicado_removido', 'comunicado', { id, tipo: c.tipo, titulo: c.titulo });
    return { mensagem: 'Comunicado removido.' };
  }

  // ---------- anexo ----------
  async salvarAnexo(id: number, arquivo: Express.Multer.File | undefined, quem: UsuarioPublico) {
    const c = await this.buscar(id);
    this.exigirTipo(c.tipo, quem);
    if (!arquivo) throw new BadRequestException('Envie um arquivo PDF ou imagem (JPG, PNG ou WebP).');
    const tipo = tipoAnexo(arquivo.buffer);
    if (!tipo) throw new BadRequestException('O anexo precisa ser um PDF ou uma imagem JPG, PNG ou WebP.');
    await mkdir(pastaComunicados(), { recursive: true });
    const nome = `${id}-${randomBytes(8).toString('hex')}.${tipo.ext}`;
    await writeFile(join(pastaComunicados(), nome), arquivo.buffer);
    const original = basename(Buffer.from(arquivo.originalname, 'latin1').toString('utf8')).slice(0, 120);
    await this.db.query('update comunicado set anexo_path=$2, anexo_nome=$3, atualizado_em=now(), atualizado_por=$4 where id=$1', [id, nome, original, quem.id]);
    if (c.anexo_path) await unlink(join(pastaComunicados(), basename(c.anexo_path))).catch(() => undefined);
    await this.db.auditar(quem.id, 'comunicado_anexo_enviado', 'comunicado', { id, nome: original });
    return { mensagem: 'Anexo salvo.' };
  }

  async removerAnexo(id: number, quem: UsuarioPublico) {
    const c = await this.buscar(id);
    this.exigirTipo(c.tipo, quem);
    await this.db.query('update comunicado set anexo_path=null, anexo_nome=null, atualizado_em=now(), atualizado_por=$2 where id=$1', [id, quem.id]);
    if (c.anexo_path) await unlink(join(pastaComunicados(), basename(c.anexo_path))).catch(() => undefined);
    await this.db.auditar(quem.id, 'comunicado_anexo_removido', 'comunicado', { id });
    return { mensagem: 'Anexo removido.' };
  }

  async anexoDe(id: number, quem: UsuarioPublico) {
    const c = await this.buscar(id);
    // comunicado de outra pessoa responde como se não existisse
    if (!this.podeVer(c, quem)) throw new NotFoundException('Comunicado não encontrado.');
    if (!c.anexo_path) throw new NotFoundException('Este comunicado não tem anexo.');
    const arquivo = basename(c.anexo_path);
    const ext = arquivo.split('.').pop() ?? '';
    return { caminho: join(pastaComunicados(), arquivo), nome: c.anexo_nome ?? `anexo.${ext}`, mime: MIME_ANEXO[ext] ?? 'application/octet-stream' };
  }
}
