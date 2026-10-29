import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { COOKIE } from './cookie';
import { DbService } from './db.service';
import { ReqAuth, usuarioPublico } from './usuario';

const PUBLICO = 'publico';
/** Marca uma rota que não exige login. */
export const Publico = () => SetMetadata(PUBLICO, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService, private readonly db: DbService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<ReqAuth & { cookies?: Record<string, string> }>();
    const token = req.cookies?.[COOKIE];
    if (token) {
      try {
        const p = await this.jwt.verifyAsync<{ sub: number; iat: number }>(token);
        const u = await this.db.um('select * from usuario where id=$1', [p.sub]);
        // conta inativa ou senha trocada depois da emissão do token = sessão invalidada
        if (u?.ativo && p.iat >= Math.floor(new Date(u.senha_alterada_em).getTime() / 1000)) req.usuario = usuarioPublico(u);
      } catch { /* token inválido ou expirado: segue como visitante */ }
    }
    const publico = this.reflector.getAllAndOverride<boolean>(PUBLICO, [ctx.getHandler(), ctx.getClass()]);
    if (publico) return true;
    if (!req.usuario) throw new UnauthorizedException('Faça login para continuar.');
    return true;
  }
}
