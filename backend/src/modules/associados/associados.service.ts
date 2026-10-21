import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DbService } from '../../common/db.service';
import { tratarUnico } from '../../common/erros';
import { MailService } from '../../common/mail.service';
import { hashToken, novoToken } from '../../common/password';
import { paraBanco } from '../../common/perfil.enum';
import type { UsuarioPublico } from '../../common/usuario';
import { ConviteDto } from './dto/convite.dto';

const ROTULO: Record<string, string> = {
  associado: 'Associado', presidente: 'Presidente', vice_presidente: 'Vice-presidente',
  tesoureiro: 'Tesoureiro', conselheiro: 'Conselheiro', auxiliar: 'Auxiliar',
};
const link = (token: string) => `${process.env.APP_URL ?? 'http://localhost:5173'}/concluir-cadastro?token=${token}`;

@Injectable()
export class AssociadosService {
  constructor(private readonly db: DbService, private readonly mail: MailService) {}

  async listar() {
    const l = await this.db.query(`
      select a.id, a.nome, a.email, a.telefone, a.cargo, a.situacao, i.nome as instituicao, r.nome as rota
      from associado a
      left join instituicao i on i.id = a.instituicao_id
      left join rota r on r.id = a.rota_id
      order by a.nome`);
    return l.map((a) => ({ ...a, cargo: ROTULO[a.cargo] ?? a.cargo }));
  }

  private async novoConvite(c: PoolClient, associadoId: number, perfil: string) {
    const token = novoToken();
    await c.query("update token_usuario set usado_em=now() where associado_id=$1 and tipo='convite' and usado_em is null", [associadoId]);
    await c.query("insert into token_usuario(tipo, associado_id, token_hash, expira_em, dados) values('convite',$1,$2, now() + interval '7 days',$3)",
      [associadoId, hashToken(token), JSON.stringify({ perfil })]);
    return token;
  }
  private enviarConvite(nome: string, email: string, token: string) {
    return this.mail.enviar(email, 'Ridely: convite para a associação', 'Você foi convidado(a)', [
      `Olá, ${nome}! A presidência convidou você para usar o Ridely, o sistema da associação de transporte escolar.`,
      'Use o botão abaixo para criar sua senha e concluir o cadastro. O convite vale por 7 dias.'], { texto: 'Concluir cadastro', url: link(token) });
  }

  async convidar(d: ConviteDto, quem: UsuarioPublico) {
    const perfil = paraBanco(d.perfil), cargo = paraBanco(d.cargo), email = d.email.toLowerCase().trim();
    if (perfil !== 'associado' && quem.perfil !== 'presidente') throw new ForbiddenException('Só a presidência pode definir perfis administrativos.');
    if (await this.db.um('select 1 from usuario where email=$1', [email])) throw new ConflictException('Já existe uma conta com este e-mail.');
    let token = '';
    try {
      await this.db.tx(async (c) => {
        const rota = (await c.query('select rota_id from rota_instituicao where instituicao_id=$1 order by rota_id limit 1', [d.instituicaoId])).rows[0]?.rota_id ?? null;
        const a = (await c.query("insert into associado(nome, email, cargo, situacao, instituicao_id, rota_id) values($1,$2,$3,'convite',$4,$5) returning id",
          [d.nome.trim(), email, cargo, d.instituicaoId, rota])).rows[0];
        token = await this.novoConvite(c, a.id, perfil);
      });
    } catch (e) { tratarUnico(e, 'Esse e-mail já foi convidado ou cadastrado.'); }
    await this.db.auditar(quem.id, 'convite_enviado', 'associado', { email, cargo, perfil });
    void this.enviarConvite(d.nome.trim(), email, token);
    return { mensagem: `Convite enviado para ${email}.` };
  }

  async reenviar(id: number, quem: UsuarioPublico) {
    const a = await this.db.um("select id, nome, email from associado where id=$1 and situacao='convite'", [id]);
    if (!a) throw new NotFoundException('Convite não encontrado.');
    const ultimo = await this.db.um("select dados from token_usuario where associado_id=$1 and tipo='convite' order by id desc limit 1", [id]);
    const perfil = ultimo?.dados?.perfil ?? 'associado';
    if (perfil !== 'associado' && quem.perfil !== 'presidente') throw new ForbiddenException('Só a presidência pode reenviar este convite.');
    const token = await this.db.tx((c) => this.novoConvite(c, id, perfil));
    void this.enviarConvite(a.nome, a.email, token);
    return { mensagem: `Convite reenviado para ${a.email}.` };
  }
}
