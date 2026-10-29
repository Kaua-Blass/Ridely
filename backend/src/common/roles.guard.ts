import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERFIS_CHAVE } from './roles.decorator';
import type { Perfil } from './perfil.enum';

/** Autorização no servidor: recusa quem não tem o perfil exigido pela rota. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const exigidos = this.reflector.getAllAndOverride<Perfil[]>(PERFIS_CHAVE, [ctx.getHandler(), ctx.getClass()]);
    if (!exigidos?.length) return true;
    const usuario = ctx.switchToHttp().getRequest().usuario as { perfil: Perfil } | undefined;
    if (!usuario || !exigidos.includes(usuario.perfil)) throw new ForbiddenException('Sem permissão');
    return true;
  }
}
