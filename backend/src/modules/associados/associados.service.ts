import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DbService } from '../../common/db.service';
import { buscaCpf, cifrarCpf } from '../../common/cpf';
import { tratarUnico } from '../../common/erros';
import { MailService } from '../../common/mail.service';
import { hashToken, novoToken } from '../../common/password';
import { paraBanco, perfilApi, rotuloCargo } from '../../common/perfil.enum';
import type { UsuarioPublico } from '../../common/usuario';
import { ConviteDto } from './dto/convite.dto';
import { EditarAssociadoDto } from './dto/editar.dto';

const link = (token: string) => `${process.env.APP_URL ?? 'http://localhost:5173'}/concluir-cadastro?token=${token}`;
const ADMIN = 'Só a presidência altera cargos e dados de quem tem cargo ou perfil administrativo.';

@Injectable()
export class AssociadosService {
  constructor(private readonly db: DbService, private readonly mail: MailService) {}

  async listar() {
    const l = await this.db.query(`
      select a.id, a.nome, a.email, a.telefone, a.cargo, a.situacao, a.ponto_embarque as "pontoEmbarque",
             a.instituicao_id as "instituicaoId", a.rota_id as "rotaId", i.nome as instituicao, r.nome as rota
      from associado a
      left join instituicao i on i.id = a.instituicao_id
      left join rota r on r.id = a.rota_id
      order by a.nome`);
    return l.map((a) => ({ ...a, cargoCodigo: perfilApi(a.cargo), cargo: rotuloCargo(a.cargo) }));
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

  /** Edita os dados do associado. Quem tem cargo ou perfil administrativo só a presidência altera. */
  async editar(id: number, d: EditarAssociadoDto, quem: UsuarioPublico) {
    const a = await this.db.um('select a.*, u.perfil from associado a left join usuario u on u.associado_id = a.id where a.id=$1', [id]);
    if (!a) throw new NotFoundException('Associado não encontrado.');
    const cargo = paraBanco(d.cargo);
    const administrativo = a.cargo !== 'associado' || cargo !== 'associado' || (a.perfil && a.perfil !== 'associado');
    if (administrativo && quem.perfil !== 'presidente') throw new ForbiddenException(ADMIN);

    let rotaId = d.rotaId ?? null;
    if (rotaId == null) {
      rotaId = (await this.db.um('select rota_id from rota_instituicao where instituicao_id=$1 order by rota_id limit 1', [d.instituicaoId]))?.rota_id ?? null;
    } else if (!(await this.db.um('select 1 from rota_instituicao where rota_id=$1 and instituicao_id=$2', [rotaId, d.instituicaoId]))) {
      throw new BadRequestException('Essa rota não atende a instituição escolhida.');
    }
    const ponto = d.pontoEmbarque?.trim() || null;
    if (ponto && !(await this.db.um('select 1 from rota_parada where rota_id=$1 and nome=$2', [rotaId, ponto]))) {
      throw new BadRequestException('Esse ponto de embarque não pertence à rota escolhida.');
    }
    const cpf = d.cpf?.replace(/\D/g, '') || null; // vazio = mantém o CPF atual
    const cpfCifrado = cpf ? cifrarCpf(cpf) : null, cpfBusca = cpf ? buscaCpf(cpf) : null;
    try {
      await this.db.tx(async (c) => {
        await c.query(`update associado set nome=$2, telefone=$3, cpf_cifrado=coalesce($4, cpf_cifrado), cpf_busca=coalesce($9, cpf_busca), cargo=$5, instituicao_id=$6, rota_id=$7, ponto_embarque=$8 where id=$1`,
          [id, d.nome.trim(), d.telefone?.trim() || null, cpfCifrado, cargo, d.instituicaoId, rotaId, ponto, cpfBusca]);
        await c.query('update usuario set nome=$2 where associado_id=$1', [id, d.nome.trim()]);
      });
    } catch (e) { tratarUnico(e, 'Esse CPF já está cadastrado em outro associado.'); }
    await this.db.auditar(quem.id, 'associado_editado', 'associado', { id, cargoAntes: a.cargo, cargoDepois: cargo });
    return { mensagem: 'Associado atualizado.' };
  }

  /** Inativar bloqueia o acesso na hora (as sessões abertas caem); reativar devolve o acesso. */
  async situacao(id: number, ativo: boolean, quem: UsuarioPublico) {
    const a = await this.db.um('select a.*, u.id as uid, u.perfil from associado a left join usuario u on u.associado_id = a.id where a.id=$1', [id]);
    if (!a) throw new NotFoundException('Associado não encontrado.');
    if (a.situacao === 'convite') throw new BadRequestException('Convite pendente: reenvie o convite ou aguarde a conclusão do cadastro.');
    if ((a.cargo !== 'associado' || (a.perfil && a.perfil !== 'associado')) && quem.perfil !== 'presidente') throw new ForbiddenException(ADMIN);
    if (!ativo && a.uid === quem.id) throw new BadRequestException('Você não pode inativar a si mesmo.');
    if (!ativo && a.perfil === 'presidente') {
      const outros = await this.db.um("select count(*)::int as n from usuario where perfil='presidente' and ativo and id<>$1", [a.uid]);
      if (!outros || outros.n < 1) throw new BadRequestException('Mantenha pelo menos um presidente ativo.');
    }
    await this.db.tx(async (c) => {
      await c.query('update associado set situacao=$2 where id=$1', [id, ativo ? 'ativo' : 'inativo']);
      if (a.uid) await c.query('update usuario set ativo=$2 where id=$1', [a.uid, ativo]);
    });
    await this.db.auditar(quem.id, ativo ? 'associado_reativado' : 'associado_inativado', 'associado', { id });
    return { mensagem: ativo ? 'Associado reativado.' : 'Associado inativado. O acesso foi bloqueado.' };
  }
}
