import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { basename, join } from 'path';
import { COOKIE, opcoesCookie } from '../../common/cookie';
import { DbService } from '../../common/db.service';
import { tratarUnico } from '../../common/erros';
import { MailService } from '../../common/mail.service';
import { pastaFotos, tipoImagem, MIME_POR_EXT } from '../../common/foto';
import { conferirSenha, hashSenha, hashToken, novoToken } from '../../common/password';
import { rotuloCargo } from '../../common/perfil.enum';
import { usuarioPublico } from '../../common/usuario';
import { AtualizarPerfilDto, TrocarEmailDto, TrocarSenhaDto } from './dto/perfil.dto';

const limpar = (s?: string) => s?.trim() || null;

@Injectable()
export class PerfilService {
  constructor(private readonly db: DbService, private readonly jwt: JwtService, private readonly mail: MailService) {}

  async obter(id: number) {
    const u = await this.db.um(`
      select u.*, a.cargo, a.instituicao_id, i.nome as instituicao, r.nome as rota, a.ponto_embarque
      from usuario u
      left join associado a on a.id = u.associado_id
      left join instituicao i on i.id = a.instituicao_id
      left join rota r on r.id = a.rota_id
      where u.id = $1`, [id]);
    if (!u) throw new NotFoundException();
    return { ...usuarioPublico(u), cargo: rotuloCargo(u.cargo), instituicaoId: u.instituicao_id, instituicao: u.instituicao, rota: u.rota, pontoEmbarque: u.ponto_embarque };
  }

  /** Atualiza o usuário e o associado vinculado. Trocar a instituição recalcula a rota. */
  async atualizar(id: number, d: AtualizarPerfilDto) {
    try {
      await this.db.tx(async (c) => {
        const u = (await c.query('select associado_id from usuario where id=$1 for update', [id])).rows[0];
        await c.query('update usuario set nome=$2, telefone=$3, endereco=$4, contato_emergencia=$5 where id=$1',
          [id, d.nome.trim(), limpar(d.telefone), limpar(d.endereco), limpar(d.contatoEmergencia)]);
        if (!u.associado_id) return;
        await c.query('update associado set nome=$2, telefone=$3 where id=$1', [u.associado_id, d.nome.trim(), limpar(d.telefone)]);
        if (d.instituicaoId == null) return;
        const a = (await c.query('select instituicao_id from associado where id=$1', [u.associado_id])).rows[0];
        if (a.instituicao_id === d.instituicaoId) return;
        const rota = (await c.query('select rota_id from rota_instituicao where instituicao_id=$1 order by rota_id limit 1', [d.instituicaoId])).rows[0]?.rota_id ?? null;
        await c.query('update associado set instituicao_id=$2, rota_id=$3, ponto_embarque=null where id=$1', [u.associado_id, d.instituicaoId, rota]);
      });
    } catch (e) {
      if ((e as { code?: string }).code === '23503') throw new BadRequestException('Instituição inválida.');
      throw e;
    }
    await this.db.auditar(id, 'perfil_atualizado', 'usuario');
    return { mensagem: 'Dados atualizados.' };
  }

  /** Troca a senha logado. As outras sessões caem; esta recebe um cookie novo. */
  async trocarSenha(id: number, d: TrocarSenhaDto, res: Response) {
    const u = await this.db.um('select id, nome, email, senha_hash from usuario where id=$1', [id]);
    if (!u || !(await conferirSenha(d.senhaAtual, u.senha_hash))) throw new BadRequestException('Senha atual incorreta.');
    if (d.novaSenha === d.senhaAtual) throw new BadRequestException('A nova senha deve ser diferente da atual.');
    await this.db.query('update usuario set senha_hash=$2, senha_alterada_em=$3 where id=$1', [id, await hashSenha(d.novaSenha), new Date(Date.now() - 1000)]);
    res.cookie(COOKIE, await this.jwt.signAsync({ sub: id }), opcoesCookie());
    await this.db.auditar(id, 'senha_alterada', 'usuario');
    void this.mail.enviar(u.email, 'Ridely: sua senha foi alterada', 'Senha alterada', ['A senha da sua conta acabou de ser alterada. Se não foi você, use "Esqueci minha senha" agora e avise a presidência.']);
    return { mensagem: 'Senha alterada. Os outros dispositivos foram desconectados.' };
  }

  /** Pede a troca de e-mail: o endereço só muda depois que o link enviado ao novo endereço for aberto. */
  async trocarEmail(id: number, d: TrocarEmailDto) {
    const novo = d.novoEmail.toLowerCase().trim();
    const u = await this.db.um('select id, nome, email, senha_hash from usuario where id=$1', [id]);
    if (!u || !(await conferirSenha(d.senhaAtual, u.senha_hash))) throw new BadRequestException('Senha atual incorreta.');
    if (novo === u.email) throw new BadRequestException('Esse já é o seu e-mail.');
    const emUso = await this.db.um('select 1 from usuario where email=$1 union select 1 from associado where email=$1', [novo]);
    if (emUso) throw new BadRequestException('Esse e-mail já está em uso por outra conta.');
    const token = novoToken();
    await this.db.tx(async (c) => {
      await c.query("update token_usuario set usado_em=now() where usuario_id=$1 and tipo='email_novo' and usado_em is null", [id]);
      await c.query("insert into token_usuario(tipo, usuario_id, token_hash, expira_em, dados) values('email_novo',$1,$2, now() + interval '24 hours',$3)",
        [id, hashToken(token), JSON.stringify({ email: novo })]);
    });
    await this.db.auditar(id, 'email_troca_solicitada', 'usuario', { novo });
    const url = `${process.env.APP_URL ?? 'http://localhost:5173'}/verificar-email?token=${token}`;
    void this.mail.enviar(novo, 'Ridely: confirme o novo e-mail', 'Confirme seu novo e-mail', [`Olá, ${u.nome}! Para usar este endereço na sua conta, confirme abaixo. O link vale por 24 horas.`], { texto: 'Confirmar novo e-mail', url });
    void this.mail.enviar(u.email, 'Ridely: pedido de troca de e-mail', 'Pedido de troca de e-mail', [`Foi pedida a troca do e-mail da sua conta para ${novo}. Se não foi você, troque sua senha agora.`]);
    return { mensagem: `Enviamos um link de confirmação para ${novo}. O e-mail só muda depois que você abrir o link.` };
  }

  async salvarFoto(id: number, arquivo?: Express.Multer.File) {
    if (!arquivo) throw new BadRequestException('Envie uma imagem.');
    const t = tipoImagem(arquivo.buffer);
    if (!t) throw new BadRequestException('Use uma imagem JPG, PNG ou WebP.');
    await mkdir(pastaFotos(), { recursive: true });
    const nome = `${id}-${randomBytes(8).toString('hex')}.${t.ext}`;
    await writeFile(join(pastaFotos(), nome), arquivo.buffer);
    const antiga = (await this.db.um('select foto_path from usuario where id=$1', [id]))?.foto_path as string | undefined;
    await this.db.query('update usuario set foto_path=$2 where id=$1', [id, nome]);
    if (antiga) await unlink(join(pastaFotos(), basename(antiga))).catch(() => undefined);
    await this.db.auditar(id, 'foto_atualizada', 'usuario');
    return { mensagem: 'Foto atualizada.' };
  }

  async removerFoto(id: number) {
    const antiga = (await this.db.um('select foto_path from usuario where id=$1', [id]))?.foto_path as string | undefined;
    await this.db.query('update usuario set foto_path=null where id=$1', [id]);
    if (antiga) await unlink(join(pastaFotos(), basename(antiga))).catch(() => undefined);
    return { mensagem: 'Foto removida.' };
  }

  async arquivoFoto(id: number) {
    const f = (await this.db.um('select foto_path from usuario where id=$1', [id]))?.foto_path as string | undefined;
    if (!f) throw new NotFoundException('Sem foto.');
    const nome = basename(f);
    return { caminho: join(pastaFotos(), nome), mime: MIME_POR_EXT[nome.split('.').pop() ?? ''] ?? 'application/octet-stream' };
  }
}
