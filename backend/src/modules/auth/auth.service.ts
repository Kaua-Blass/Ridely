import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { COOKIE, opcoesCookie } from '../../common/cookie';
import { buscaCpf, cifrarCpf } from '../../common/cpf';
import { DbService } from '../../common/db.service';
import { tratarUnico } from '../../common/erros';
import { MailService } from '../../common/mail.service';
import { HASH_FALSO, conferirSenha, hashSenha, hashToken, novoToken } from '../../common/password';
import { usuarioPublico } from '../../common/usuario';
import { CadastroDto } from './dto/auth.dto';

const link = (caminho: string, token?: string) =>
  `${process.env.APP_URL ?? 'http://localhost:5173'}/${caminho}${token ? `?token=${token}` : ''}`;
const MSG_ESQUECI = 'Se esse e-mail estiver cadastrado, enviamos um link para redefinir a senha. Ele vale por 30 minutos.';

@Injectable()
export class AuthService {
  constructor(private readonly db: DbService, private readonly jwt: JwtService, private readonly mail: MailService) {}

  async login(email: string, senha: string, res: Response, ip?: string) {
    const u = await this.db.um('select * from usuario where email=$1', [email.toLowerCase().trim()]);
    const confere = await conferirSenha(senha, u?.senha_hash ?? HASH_FALSO); // sempre calcula, existindo ou não
    if (!u || !confere) {
      await this.db.auditar(u?.id ?? null, 'login_falhou', 'usuario', { email: email.toLowerCase().trim(), ip });
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    if (!u.ativo) throw new ForbiddenException('Seu acesso ainda não foi liberado. Aguarde a aprovação da presidência.');
    await this.db.query('update usuario set ultimo_acesso=now() where id=$1', [u.id]);
    await this.db.auditar(u.id, 'login', 'usuario', { ip });
    res.cookie(COOKIE, await this.jwt.signAsync({ sub: u.id }), opcoesCookie());
    return usuarioPublico(u);
  }

  logout(res: Response) {
    const { maxAge, ...resto } = opcoesCookie();
    res.clearCookie(COOKIE, resto);
    return { mensagem: 'Sessão encerrada.' };
  }

  /** Cadastro público: cria a conta inativa, abre a solicitação para a presidência e pede a confirmação do e-mail. */
  async cadastro(d: CadastroDto) {
    const email = d.email.toLowerCase().trim();
    const resposta = { mensagem: 'Cadastro recebido. Enviamos um e-mail para confirmar o seu endereço. Depois, a presidência analisa o pedido.' };
    if (await this.db.um('select 1 from usuario where email=$1', [email])) {
      // não revela que o e-mail já existe: o aviso vai só para a caixa de entrada dele
      void this.mail.enviar(email, 'Ridely: você já tem uma conta', 'Você já tem uma conta', [
        'Alguém tentou criar uma conta com este e-mail. Se foi você, use a recuperação de senha. Se não foi, ignore esta mensagem.'],
        { texto: 'Recuperar senha', url: link('esqueci-senha') });
      return resposta;
    }
    const token = novoToken();
    const hash = await hashSenha(d.senha);
    try {
      await this.db.tx(async (c) => {
        const u = (await c.query("insert into usuario(nome, email, senha_hash, perfil, ativo, telefone) values($1,$2,$3,'associado',false,$4) returning id",
          [d.nome.trim(), email, hash, d.telefone ?? null])).rows[0];
        await c.query("insert into solicitacao(tipo, dados, usuario_id) values('associacao',$1,$2)",
          [JSON.stringify({ nome: d.nome.trim(), email, cpfCifrado: d.cpf ? cifrarCpf(d.cpf) : null, cpfBusca: d.cpf ? buscaCpf(d.cpf) : null, telefone: d.telefone ?? null, instituicaoId: d.instituicaoId }), u.id]);
        await c.query("insert into token_usuario(tipo, usuario_id, token_hash, expira_em) values('email',$1,$2, now() + interval '24 hours')", [u.id, hashToken(token)]);
      });
    } catch (e) { tratarUnico(e, 'Não foi possível concluir o cadastro.'); }
    void this.mail.enviar(email, 'Ridely: confirme seu e-mail', 'Confirme seu e-mail', [
      `Olá, ${d.nome.trim()}! Recebemos seu pedido para participar da associação.`, 'Confirme seu e-mail para a presidência poder analisar o cadastro. O link vale por 24 horas.'],
      { texto: 'Confirmar e-mail', url: link('verificar-email', token) });
    return resposta;
  }

  /** Confirma o e-mail do cadastro ou o novo e-mail pedido em Meu perfil. */
  async verificarEmail(token: string) {
    let mensagem: string | null = null;
    let uid = 0;
    try {
      mensagem = await this.db.tx(async (c) => {
        const t = (await c.query("select id, tipo, usuario_id, dados from token_usuario where tipo in ('email','email_novo') and token_hash=$1 and usado_em is null and expira_em>now() for update", [hashToken(token)])).rows[0];
        if (!t) return null;
        uid = t.usuario_id;
        if (t.tipo === 'email') {
          await c.query('update usuario set email_verificado_em=now() where id=$1', [t.usuario_id]);
        } else {
          const u = (await c.query('update usuario set email=$2, email_verificado_em=now() where id=$1 returning associado_id', [t.usuario_id, t.dados.email])).rows[0];
          if (u.associado_id) await c.query('update associado set email=$2 where id=$1', [u.associado_id, t.dados.email]);
        }
        await c.query('update token_usuario set usado_em=now() where id=$1', [t.id]);
        return t.tipo === 'email' ? 'E-mail confirmado. Se o cadastro ainda não foi aprovado, a presidência já pode analisá-lo.' : 'Novo e-mail confirmado. Use-o no próximo login.';
      });
    } catch (e) { tratarUnico(e, 'Esse e-mail já está em uso por outra conta.'); }
    if (!mensagem) throw new BadRequestException('Link inválido ou expirado.');
    await this.db.auditar(uid, 'email_confirmado', 'usuario');
    return { mensagem };
  }

  /** Sempre devolve a mesma resposta, exista a conta ou não. */
  async esqueciSenha(email: string) {
    const u = await this.db.um('select id, nome, email from usuario where email=$1', [email.toLowerCase().trim()]);
    if (u) {
      const token = novoToken();
      await this.db.tx(async (c) => {
        await c.query("update token_usuario set usado_em=now() where usuario_id=$1 and tipo='senha' and usado_em is null", [u.id]);
        await c.query("insert into token_usuario(tipo, usuario_id, token_hash, expira_em) values('senha',$1,$2, now() + interval '30 minutes')", [u.id, hashToken(token)]);
      });
      void this.mail.enviar(u.email, 'Ridely: redefinir senha', 'Redefinir sua senha', [
        `Olá, ${u.nome}. Recebemos um pedido para redefinir a senha da sua conta.`, 'O link vale por 30 minutos e só pode ser usado uma vez. Se não foi você, ignore esta mensagem: sua senha continua a mesma.'],
        { texto: 'Criar nova senha', url: link('redefinir-senha', token) });
    }
    return { mensagem: MSG_ESQUECI };
  }

  async redefinirSenha(token: string, senha: string) {
    const hash = await hashSenha(senha);
    const u = await this.db.tx(async (c) => {
      const t = (await c.query("select id, usuario_id from token_usuario where tipo='senha' and token_hash=$1 and usado_em is null and expira_em>now() for update", [hashToken(token)])).rows[0];
      if (!t) throw new BadRequestException('Link inválido ou expirado. Peça um novo.');
      const r = await c.query('update usuario set senha_hash=$1, senha_alterada_em=now() where id=$2 returning id, nome, email', [hash, t.usuario_id]);
      await c.query("update token_usuario set usado_em=now() where usuario_id=$1 and tipo='senha' and usado_em is null", [t.usuario_id]);
      return r.rows[0];
    });
    await this.db.auditar(u.id, 'senha_redefinida', 'usuario');
    void this.mail.enviar(u.email, 'Ridely: sua senha foi alterada', 'Senha alterada', [
      'A senha da sua conta acabou de ser alterada. Se não foi você, peça outra redefinição agora e avise a presidência.'], { texto: 'Recuperar conta', url: link('esqueci-senha') });
    return { mensagem: 'Senha alterada. Entre com a nova senha.' };
  }

  /** Conclusão de cadastro por convite: associado (cria o usuário) ou motorista (a conta já existe, sem senha). */
  async concluirCadastro(token: string, senha: string, telefone?: string) {
    const hash = await hashSenha(senha);
    try {
      await this.db.tx(async (c) => {
        const t = (await c.query("select id, associado_id, usuario_id, dados from token_usuario where tipo='convite' and token_hash=$1 and usado_em is null and expira_em>now() for update", [hashToken(token)])).rows[0];
        if (!t) throw new BadRequestException('Convite inválido ou expirado. Peça um novo à presidência.');
        if (t.usuario_id) {
          const r = await c.query("update usuario set senha_hash=$2, ativo=true, telefone=coalesce($3, telefone), email_verificado_em=now(), senha_alterada_em=now() where id=$1 and senha_hash='pendente'", [t.usuario_id, hash, telefone ?? null]);
          if (!r.rowCount) throw new BadRequestException('Este convite já foi usado.');
        } else {
          const a = (await c.query('select id, nome, email from associado where id=$1 for update', [t.associado_id])).rows[0];
          await c.query("insert into usuario(associado_id, nome, email, senha_hash, perfil, ativo, telefone, email_verificado_em) values($1,$2,$3,$4,$5,true,$6,now())",
            [a.id, a.nome, a.email, hash, t.dados?.perfil ?? 'associado', telefone ?? null]);
          await c.query("update associado set situacao='ativo', telefone=coalesce($2, telefone) where id=$1", [a.id, telefone ?? null]);
        }
        await c.query('update token_usuario set usado_em=now() where id=$1', [t.id]);
      });
    } catch (e) { tratarUnico(e, 'Já existe uma conta com este e-mail.'); }
    return { mensagem: 'Cadastro concluído. Agora você já pode entrar.' };
  }
}
