import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { basename, join } from 'path';
import type { PoolClient } from 'pg';
import { ehPdf, pastaContratos } from '../../common/arquivos';
import { dataValida, diasEntre, hoje } from '../../common/datas';
import { DbService } from '../../common/db.service';
import { MailService } from '../../common/mail.service';
import type { UsuarioPublico } from '../../common/usuario';
import { CalculoMensalidadeService } from '../financeiro/calculo-mensalidade.service';
import { mensalidadeProporcional, versaoEm, versoes } from './calculo';
import { AditivoDto, ContratoBaseDto, ContratoDto, SolicitacaoContratoDto } from './dto/contratos.dto';

type Situacao = 'agendado' | 'vigente' | 'a_renovar' | 'vencido' | 'encerrado';
const ordenar = (dias: number[]) => [...dias].sort((a, b) => a - b);
const CONFLITO = 'Esse associado já tem um contrato vigente em parte desse período.';

@Injectable()
export class ContratosService {
  constructor(private readonly db: DbService, private readonly mail: MailService, private readonly calculo: CalculoMensalidadeService) {}

  // ---------- apoio ----------
  private async parametros() {
    const m = Object.fromEntries((await this.db.query('select chave, valor from parametro')).map((p) => [p.chave, Number(p.valor)]));
    return { valorPorDia: m.valor_por_dia ?? 0, alertaDias: m.alerta_renovacao_dias ?? 30 };
  }
  private erroContrato(e: unknown): never {
    if ((e as { code?: string }).code === '23P01') throw new ConflictException(CONFLITO);
    throw e;
  }
  private periodo(inicio: string, fim: string) {
    if (!dataValida(inicio) || !dataValida(fim)) throw new BadRequestException('Data inválida.');
    if (fim < inicio) throw new BadRequestException('O término não pode ser anterior ao início.');
    if (diasEntre(inicio, fim) > 365 * 5) throw new BadRequestException('O contrato não pode passar de 5 anos.');
  }
  private acesso(k: { associado_id: number }, quem: UsuarioPublico) {
    if (quem.perfil === 'associado' && k.associado_id !== quem.associadoId) throw new NotFoundException('Contrato não encontrado.');
  }
  private async contrato(id: number, quem?: UsuarioPublico) {
    const k = await this.db.um('select c.*, a.nome as associado from contrato c join associado a on a.id = c.associado_id where c.id=$1', [id]);
    if (!k) throw new NotFoundException('Contrato não encontrado.');
    if (quem) this.acesso(k, quem);
    return k;
  }
  private aditivosDe(id: number) {
    return this.db.query(`
      select a.id, a.vigencia_a_partir as "vigenciaAPartir", a.novo_fim as "novoFim", a.novos_dias as "novosDias",
             a.novo_valor_por_dia as "novoValorPorDia", a.observacao, a.criado_em as "criadoEm", u.nome as "criadoPor",
             a.vigencia_a_partir, a.novos_dias, a.novo_valor_por_dia
      from aditivo a left join usuario u on u.id = a.criado_por where a.contrato_id=$1 order by a.vigencia_a_partir, a.id`, [id]);
  }

  /** Resumo de um contrato: situação, dias e mensalidade em vigor hoje. */
  private resumo(c: any, ads: any[], alertaDias: number) {
    const h = hoje();
    const vs = versoes({ inicio: c.inicio, dias_semana: c.dias_semana, valor_por_dia: c.valor_por_dia }, ads);
    const atual = versaoEm(vs, h) ?? vs[0];
    const diasParaVencer = diasEntre(h, c.fim);
    const situacao: Situacao = c.status === 'encerrado' ? 'encerrado' : c.fim < h ? 'vencido' : c.inicio > h ? 'agendado' : diasParaVencer <= alertaDias ? 'a_renovar' : 'vigente';
    return {
      id: c.id, associadoId: c.associado_id, associado: c.associado, inicio: c.inicio, fim: c.fim, status: c.status, situacao, diasParaVencer,
      diasAtuais: atual.dias, valorDiaAtual: atual.valorDia, mensalidadeAtual: Math.round(atual.dias.length * atual.valorDia * 100) / 100,
      aditivos: ads.length, temPdf: !!c.pdf_path, pdfNome: c.pdf_nome ?? null, podeEditarDireto: c.status === 'vigente' && !ads.length && !c.tem_mensalidades,
      versoes: vs,
    };
  }

  // ---------- leitura ----------
  async listar(quem: UsuarioPublico) {
    const p = await this.parametros();
    const soDele = quem.perfil === 'associado';
    if (soDele && !quem.associadoId) return [];
    const cs = await this.db.query(`
      select c.*, a.nome as associado, exists(select 1 from mensalidade m where m.associado_id = c.associado_id and m.cancelada_em is null and m.referencia between to_char(c.inicio, 'YYYY-MM') and to_char(c.fim, 'YYYY-MM')) as tem_mensalidades
      from contrato c join associado a on a.id = c.associado_id ${soDele ? 'where c.associado_id = $1' : ''}
      order by a.nome, c.inicio desc`, soDele ? [quem.associadoId] : []);
    const ads = cs.length ? await this.db.query('select contrato_id, vigencia_a_partir, novos_dias, novo_valor_por_dia from aditivo where contrato_id = any($1::int[]) order by vigencia_a_partir, id', [cs.map((c) => c.id)]) : [];
    return cs.map((c) => { const { versoes: _v, ...r } = this.resumo(c, ads.filter((a) => a.contrato_id === c.id), p.alertaDias); return r; });
  }

  async detalhe(id: number, quem: UsuarioPublico) {
    const k = await this.contrato(id, quem);
    k.tem_mensalidades = !!(await this.db.um('select 1 from mensalidade m where m.associado_id=$1 and m.cancelada_em is null and m.referencia between $2 and $3', [k.associado_id, k.inicio.slice(0, 7), k.fim.slice(0, 7)]));
    const ads = await this.aditivosDe(id);
    const r = this.resumo(k, ads, (await this.parametros()).alertaDias);
    return { ...r, aditivosLista: ads.map(({ vigencia_a_partir, novos_dias, novo_valor_por_dia, ...a }) => a) };
  }

  /** Mensalidade de um mês, já proporcional ao tempo de cada versão do contrato. */
  async previa(id: number, referencia: string, quem: UsuarioPublico) {
    const k = await this.contrato(id, quem);
    const vs = versoes({ inicio: k.inicio, dias_semana: k.dias_semana, valor_por_dia: k.valor_por_dia }, await this.aditivosDe(id));
    return { referencia, ...mensalidadeProporcional(referencia, k.inicio, k.fim, vs) };
  }

  // ---------- escrita ----------
  async criar(d: ContratoDto, quem: UsuarioPublico) {
    this.periodo(d.inicio, d.fim);
    const a = await this.db.um('select situacao from associado where id=$1', [d.associadoId]);
    if (!a) throw new BadRequestException('Associado inválido.');
    if (a.situacao !== 'ativo') throw new BadRequestException('Só associados ativos podem ter contrato.');
    const valor = d.valorPorDia ?? (await this.parametros()).valorPorDia;
    try {
      const k = await this.db.um('insert into contrato(associado_id, inicio, fim, dias_semana, valor_por_dia, criado_por) values($1,$2,$3,$4,$5,$6) returning id',
        [d.associadoId, d.inicio, d.fim, ordenar(d.diasSemana), valor, quem.id]);
      await this.db.auditar(quem.id, 'contrato_criado', 'contrato', { id: k!.id, associadoId: d.associadoId, inicio: d.inicio, fim: d.fim, dias: ordenar(d.diasSemana), valorPorDia: valor });
      return { id: k!.id, mensagem: 'Contrato criado.' };
    } catch (e) { this.erroContrato(e); }
  }

  /** Correção direta só enquanto não há aditivos nem mensalidades; depois, só por aditivo. */
  async editar(id: number, d: ContratoBaseDto, quem: UsuarioPublico) {
    const k = await this.contrato(id);
    if (k.status !== 'vigente') throw new BadRequestException('Contrato encerrado não pode ser editado.');
    const ads = await this.db.um('select count(*)::int as n from aditivo where contrato_id=$1', [id]);
    const mens = await this.db.um('select 1 from mensalidade m where m.associado_id=$1 and m.cancelada_em is null and m.referencia between $2 and $3', [k.associado_id, k.inicio.slice(0, 7), k.fim.slice(0, 7)]);
    if (ads!.n || mens) throw new BadRequestException('Este contrato já tem aditivos ou mensalidades. Faça a alteração por um aditivo.');
    this.periodo(d.inicio, d.fim);
    try {
      await this.db.query('update contrato set inicio=$2, fim=$3, dias_semana=$4, valor_por_dia=$5 where id=$1',
        [id, d.inicio, d.fim, ordenar(d.diasSemana), d.valorPorDia ?? k.valor_por_dia]);
    } catch (e) { this.erroContrato(e); }
    await this.db.auditar(quem.id, 'contrato_editado', 'contrato', { id });
    return { mensagem: 'Contrato atualizado.' };
  }

  /** Regras do aditivo, usadas tanto no aditivo direto quanto na aprovação de solicitação. */
  private async aplicarAditivo(c: PoolClient, k: any, d: AditivoDto, quemId: number, solicitacaoId?: number) {
    if (k.status !== 'vigente') throw new BadRequestException('Contrato encerrado não aceita aditivos.');
    if (d.novosDias == null && d.novoValorPorDia == null && !d.novoFim) throw new BadRequestException('Informe ao menos uma mudança: dias, valor ou nova data de término.');
    if (!dataValida(d.vigenciaAPartir) || (d.novoFim && !dataValida(d.novoFim))) throw new BadRequestException('Data inválida.');
    if (d.vigenciaAPartir < hoje()) throw new BadRequestException('A vigência do aditivo não pode ser anterior a hoje.');
    const ultima = (await c.query('select max(vigencia_a_partir)::text as v from aditivo where contrato_id=$1', [k.id])).rows[0].v as string | null;
    if (ultima && d.vigenciaAPartir < ultima) throw new BadRequestException(`Já existe um aditivo com vigência em ${ultima.split('-').reverse().join('/')}. O novo precisa começar nessa data ou depois.`);
    const fim = d.novoFim ?? k.fim;
    if (d.vigenciaAPartir < k.inicio || d.vigenciaAPartir > fim) throw new BadRequestException('A vigência deve ficar entre o início e o término do contrato.');
    await c.query(`insert into aditivo(contrato_id, vigencia_a_partir, novo_fim, novos_dias, novo_valor_por_dia, observacao, criado_por, solicitacao_id) values($1,$2,$3,$4,$5,$6,$7,$8)`,
      [k.id, d.vigenciaAPartir, d.novoFim ?? null, d.novosDias ? ordenar(d.novosDias) : null, d.novoValorPorDia ?? null, d.observacao?.trim() || null, quemId, solicitacaoId ?? null]);
    if (d.novoFim) await c.query('update contrato set fim=$2 where id=$1', [k.id, d.novoFim]);
  }

  async aditivar(id: number, d: AditivoDto, quem: UsuarioPublico) {
    try {
      await this.db.tx(async (c) => {
        const k = (await c.query('select * from contrato where id=$1 for update', [id])).rows[0];
        if (!k) throw new NotFoundException('Contrato não encontrado.');
        await this.aplicarAditivo(c, k, d, quem.id);
        await this.calculo.recalcularAbertas(c, k.associado_id); // mensalidades em aberto passam a refletir o aditivo
      });
    } catch (e) { this.erroContrato(e); }
    await this.db.auditar(quem.id, 'aditivo_criado', 'contrato', { id, ...d });
    return { mensagem: 'Aditivo registrado.' };
  }

  async encerrar(id: number, data: string, quem: UsuarioPublico) {
    const k = await this.contrato(id);
    if (k.status !== 'vigente') throw new BadRequestException('Este contrato já está encerrado.');
    if (!dataValida(data) || data < hoje()) throw new BadRequestException('A data de encerramento não pode ser anterior a hoje.');
    if (data < k.inicio || data > k.fim) throw new BadRequestException('A data deve ficar entre o início e o término do contrato.');
    await this.db.tx(async (c) => {
      await c.query("update contrato set status='encerrado', fim=$2 where id=$1", [id, data]);
      await this.calculo.recalcularAbertas(c, k.associado_id);
    });
    await this.db.auditar(quem.id, 'contrato_encerrado', 'contrato', { id, data });
    return { mensagem: 'Contrato encerrado.' };
  }

  // ---------- PDF ----------
  async salvarPdf(id: number, arquivo: Express.Multer.File | undefined, quem: UsuarioPublico) {
    const k = await this.contrato(id, quem);
    if (quem.perfil === 'associado' && k.pdf_path) throw new ForbiddenException('Este contrato já tem PDF. Peça à associação para trocá-lo.');
    if (!arquivo) throw new BadRequestException('Envie um arquivo PDF.');
    if (!ehPdf(arquivo.buffer)) throw new BadRequestException('O arquivo enviado não é um PDF.');
    await mkdir(pastaContratos(), { recursive: true });
    const nome = `${id}-${randomBytes(8).toString('hex')}.pdf`;
    await writeFile(join(pastaContratos(), nome), arquivo.buffer);
    const original = basename(Buffer.from(arquivo.originalname, 'latin1').toString('utf8')).slice(0, 120);
    await this.db.query('update contrato set pdf_path=$2, pdf_nome=$3 where id=$1', [id, nome, original]);
    if (k.pdf_path) await unlink(join(pastaContratos(), basename(k.pdf_path))).catch(() => undefined);
    await this.db.auditar(quem.id, 'contrato_pdf_enviado', 'contrato', { id, nome: original });
    return { mensagem: 'PDF anexado.' };
  }
  async removerPdf(id: number, quem: UsuarioPublico) {
    const k = await this.contrato(id);
    await this.db.query('update contrato set pdf_path=null, pdf_nome=null where id=$1', [id]);
    if (k.pdf_path) await unlink(join(pastaContratos(), basename(k.pdf_path))).catch(() => undefined);
    await this.db.auditar(quem.id, 'contrato_pdf_removido', 'contrato', { id });
    return { mensagem: 'PDF removido.' };
  }
  async arquivoPdf(id: number, quem: UsuarioPublico) {
    const k = await this.contrato(id, quem);
    if (!k.pdf_path) throw new NotFoundException('Este contrato não tem PDF.');
    return { caminho: join(pastaContratos(), basename(k.pdf_path)), nome: k.pdf_nome ?? `contrato-${id}.pdf` };
  }

  // ---------- solicitações de alteração ----------
  /** O associado pede mudança de dias; nada muda no contrato até alguém da associação aprovar. */
  async solicitar(d: SolicitacaoContratoDto, quem: UsuarioPublico) {
    const k = await this.contrato(d.contratoId, quem);
    if (k.status !== 'vigente') throw new BadRequestException('Só é possível pedir alteração de contrato vigente.');
    if (!dataValida(d.vigenciaAPartir) || d.vigenciaAPartir < hoje()) throw new BadRequestException('A data desejada não pode ser anterior a hoje.');
    if (d.vigenciaAPartir > k.fim) throw new BadRequestException('A data desejada passa do término do contrato.');
    if (await this.db.um("select 1 from solicitacao where tipo='alteracao_contrato' and status='pendente' and (dados->>'contratoId')::int=$1", [d.contratoId]))
      throw new ConflictException('Já existe uma solicitação pendente para este contrato.');
    await this.db.query("insert into solicitacao(tipo, dados, usuario_id) values('alteracao_contrato',$1,$2)",
      [JSON.stringify({ contratoId: d.contratoId, associadoId: k.associado_id, novosDias: ordenar(d.novosDias), vigenciaAPartir: d.vigenciaAPartir, observacao: d.observacao?.trim() || null }), quem.id]);
    await this.db.auditar(quem.id, 'contrato_alteracao_solicitada', 'contrato', { id: d.contratoId });
    return { mensagem: 'Solicitação enviada. O contrato só muda depois da aprovação.' };
  }

  async solicitacoes(quem: UsuarioPublico) {
    const soDele = quem.perfil === 'associado';
    const l = await this.db.query(`
      select s.id, s.status, s.criado_em as "criadoEm", s.dados, a.nome as associado
      from solicitacao s join associado a on a.id = (s.dados->>'associadoId')::int
      where s.tipo = 'alteracao_contrato' and ${soDele ? 's.usuario_id = $1' : "s.status = 'pendente'"}
      order by s.id desc`, soDele ? [quem.id] : []);
    return l;
  }

  async decidir(id: number, aprovar: boolean, motivo: string | undefined, quem: UsuarioPublico) {
    let alvo: { nome: string; email: string } | undefined;
    try {
      alvo = await this.db.tx(async (c) => {
        const s = (await c.query("select * from solicitacao where id=$1 and tipo='alteracao_contrato' and status='pendente' for update", [id])).rows[0];
        if (!s) throw new NotFoundException('Solicitação não encontrada ou já decidida.');
        const u = (await c.query('select nome, email from usuario where id=$1', [s.usuario_id])).rows[0];
        if (aprovar) {
          const k = (await c.query('select * from contrato where id=$1 for update', [s.dados.contratoId])).rows[0];
          const desde = s.dados.vigenciaAPartir < hoje() ? hoje() : s.dados.vigenciaAPartir; // pedido antigo: vale a partir de hoje
          await this.aplicarAditivo(c, k, { vigenciaAPartir: desde, novosDias: s.dados.novosDias, observacao: `Solicitado pelo associado${s.dados.observacao ? `: ${s.dados.observacao}` : ''}` }, quem.id, id);
          await this.calculo.recalcularAbertas(c, k.associado_id);
        }
        await c.query("update solicitacao set status=$2, decidido_por=$3, dados = dados || jsonb_build_object('motivo', $4::text) where id=$1", [id, aprovar ? 'aprovada' : 'rejeitada', quem.id, motivo?.trim() ?? '']);
        return u;
      });
    } catch (e) { this.erroContrato(e); }
    await this.db.auditar(quem.id, aprovar ? 'contrato_alteracao_aprovada' : 'contrato_alteracao_rejeitada', 'solicitacao', { id });
    if (alvo) {
      void (aprovar
        ? this.mail.enviar(alvo.email, 'Ridely: alteração de contrato aprovada', 'Alteração aprovada', [`Olá, ${alvo.nome}! O seu pedido de alteração dos dias de transporte foi aprovado.`, 'Veja os novos dias na tela Contratos.'])
        : this.mail.enviar(alvo.email, 'Ridely: alteração de contrato não aprovada', 'Alteração não aprovada', [`Olá, ${alvo.nome}. O seu pedido de alteração do contrato não foi aprovado.`, ...(motivo?.trim() ? [`Motivo: ${motivo.trim()}`] : [])]));
    }
    return { mensagem: aprovar ? 'Alteração aprovada e aplicada ao contrato.' : 'Solicitação rejeitada.' };
  }
}
