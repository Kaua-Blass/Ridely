import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../../common/db.service';
import { tratarUnico } from '../../common/erros';
import { MailService } from '../../common/mail.service';
import { paraBanco, perfilApi, rotuloCargo } from '../../common/perfil.enum';
import { AtualizarUsuarioDto, AuditoriaQueryDto, ParametrosDto } from './dto/admin.dto';

@Injectable()
export class AdministracaoService {
  constructor(private readonly db: DbService, private readonly mail: MailService) {}

  solicitacoes() {
    return this.db.query(`
      select s.id, s.tipo, s.dados, s.criado_em as "criadoEm", (u.email_verificado_em is not null) as "emailVerificado"
      from solicitacao s left join usuario u on u.id = s.usuario_id
      where s.status = 'pendente' and s.tipo = 'associacao' order by s.criado_em`);
  }

  // ---------- usuários e perfis ----------
  async usuarios() {
    const l = await this.db.query(`
      select u.id, u.nome, u.email, u.perfil, u.ativo, u.ultimo_acesso as "ultimoAcesso",
             (u.email_verificado_em is not null) as "emailVerificado", a.cargo
      from usuario u left join associado a on a.id = u.associado_id order by u.nome`);
    return l.map((u) => ({ ...u, perfil: perfilApi(u.perfil), cargo: rotuloCargo(u.cargo) }));
  }

  /** Muda perfil ou bloqueia acesso. O efeito é imediato: o perfil é lido do banco a cada requisição. */
  async atualizarUsuario(id: number, d: AtualizarUsuarioDto, quemId: number) {
    const u = await this.db.um('select id, perfil, ativo from usuario where id=$1', [id]);
    if (!u) throw new NotFoundException('Usuário não encontrado.');
    if (id === quemId) throw new BadRequestException('Você não pode alterar o seu próprio perfil ou acesso. Peça a outro presidente.');
    const perfil = d.perfil ? paraBanco(d.perfil) : u.perfil;
    const ativo = d.ativo ?? u.ativo;
    if (u.perfil === 'presidente' && (perfil !== 'presidente' || !ativo)) {
      const outros = await this.db.um("select count(*)::int as n from usuario where perfil='presidente' and ativo and id<>$1", [id]);
      if (!outros || outros.n < 1) throw new BadRequestException('Mantenha pelo menos um presidente ativo.');
    }
    await this.db.query('update usuario set perfil=$2, ativo=$3 where id=$1', [id, perfil, ativo]);
    await this.db.auditar(quemId, 'usuario_alterado', 'usuario', { id, perfilAntes: u.perfil, perfilDepois: perfil, ativoAntes: u.ativo, ativoDepois: ativo });
    return { mensagem: 'Usuário atualizado.' };
  }

  // ---------- parâmetros ----------
  async parametros() {
    const l = await this.db.query('select chave, valor from parametro');
    const m = Object.fromEntries(l.map((p) => [p.chave, Number(p.valor)]));
    return { valorPorDia: m.valor_por_dia ?? 0, multaPercentual: m.multa_percentual ?? 0, alertaRenovacaoDias: m.alerta_renovacao_dias ?? 30 };
  }
  async salvarParametros(d: ParametrosDto, quemId: number) {
    const antes = await this.parametros();
    await this.db.tx(async (c) => {
      for (const [k, v] of [['valor_por_dia', d.valorPorDia.toFixed(2)], ['multa_percentual', String(d.multaPercentual)], ['alerta_renovacao_dias', String(d.alertaRenovacaoDias)]]) {
        await c.query('insert into parametro(chave, valor) values($1,$2) on conflict (chave) do update set valor = excluded.valor', [k, v]);
      }
    });
    await this.db.auditar(quemId, 'parametros_alterados', 'parametro', { antes, depois: d });
    return { mensagem: 'Parâmetros salvos. O valor por dia vale para novos contratos; contratos existentes mantêm o valor deles.' };
  }

  // ---------- auditoria ----------
  async auditoria(q: AuditoriaQueryDto) {
    const onde: string[] = [], p: unknown[] = [];
    const add = (cond: string, v: unknown) => { p.push(v); onde.push(cond.replace('?', `$${p.length}`)); };
    if (q.acao) add('a.acao = ?', q.acao);
    if (q.usuarioId) add('a.usuario_id = ?', q.usuarioId);
    if (q.de) add('a.em >= ?::date', q.de);
    if (q.ate) add('a.em < (?::date + 1)', q.ate);
    const filtro = onde.length ? `where ${onde.join(' and ')}` : '';
    const porPagina = q.porPagina ?? 50, pagina = q.pagina ?? 1;
    const total = (await this.db.um(`select count(*)::int as n from auditoria a ${filtro}`, p))!.n as number;
    const itens = await this.db.query(`
      select a.id, a.em, a.acao, a.entidade, a.detalhes, u.nome as usuario
      from auditoria a left join usuario u on u.id = a.usuario_id ${filtro}
      order by a.em desc, a.id desc limit $${p.length + 1} offset $${p.length + 2}`, [...p, porPagina, (pagina - 1) * porPagina]);
    return { itens, total, pagina, porPagina };
  }
  async acoesAuditoria() {
    return (await this.db.query('select distinct acao from auditoria order by acao')).map((r) => r.acao as string);
  }

  /** Aprovar cria o associado, vincula ao usuário e libera o acesso, tudo na mesma transação. */
  async decidir(id: number, aprovar: boolean, quemId: number) {
    let u: { nome: string; email: string } | undefined;
    try {
      u = await this.db.tx(async (c) => {
        const s = (await c.query("select * from solicitacao where id=$1 and status='pendente' for update", [id])).rows[0];
        if (!s) throw new NotFoundException('Solicitação não encontrada ou já decidida.');
        if (s.tipo !== 'associacao') throw new BadRequestException('Este tipo de solicitação ainda não é tratado aqui.');
        const usr = (await c.query('select nome, email from usuario where id=$1', [s.usuario_id])).rows[0];
        if (aprovar) {
          const d = s.dados;
          const rota = (await c.query('select rota_id from rota_instituicao where instituicao_id=$1 order by rota_id limit 1', [d.instituicaoId])).rows[0]?.rota_id ?? null;
          const a = (await c.query("insert into associado(nome, cpf, telefone, email, cargo, situacao, instituicao_id, rota_id) values($1,$2,$3,$4,'associado','ativo',$5,$6) returning id",
            [d.nome, d.cpf, d.telefone, d.email, d.instituicaoId, rota])).rows[0];
          await c.query('update usuario set associado_id=$1, ativo=true where id=$2', [a.id, s.usuario_id]);
        }
        await c.query('update solicitacao set status=$1, decidido_por=$2 where id=$3', [aprovar ? 'aprovada' : 'rejeitada', quemId, id]);
        return usr;
      });
    } catch (e) { tratarUnico(e, 'CPF ou e-mail já cadastrado como associado.'); }
    await this.db.auditar(quemId, aprovar ? 'solicitacao_aprovada' : 'solicitacao_rejeitada', 'solicitacao', { id });
    if (u) {
      const url = `${process.env.APP_URL ?? 'http://localhost:5173'}/login`;
      void (aprovar
        ? this.mail.enviar(u.email, 'Ridely: cadastro aprovado', 'Cadastro aprovado', [`Olá, ${u.nome}! A presidência aprovou o seu cadastro.`], { texto: 'Entrar', url })
        : this.mail.enviar(u.email, 'Ridely: cadastro não aprovado', 'Cadastro não aprovado', [`Olá, ${u.nome}. A presidência não aprovou o seu pedido neste momento. Em caso de dúvida, fale com a associação.`]));
    }
    return { mensagem: aprovar ? 'Cadastro aprovado.' : 'Cadastro rejeitado.' };
  }
}
