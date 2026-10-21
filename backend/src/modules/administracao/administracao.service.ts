import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../../common/db.service';
import { tratarUnico } from '../../common/erros';
import { MailService } from '../../common/mail.service';

@Injectable()
export class AdministracaoService {
  constructor(private readonly db: DbService, private readonly mail: MailService) {}

  solicitacoes() {
    return this.db.query(`
      select s.id, s.tipo, s.dados, s.criado_em as "criadoEm", (u.email_verificado_em is not null) as "emailVerificado"
      from solicitacao s left join usuario u on u.id = s.usuario_id
      where s.status = 'pendente' order by s.criado_em`);
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
