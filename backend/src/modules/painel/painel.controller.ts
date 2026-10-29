import { Controller, Get, Req } from '@nestjs/common';
import type { ReqAuth, UsuarioPublico } from '../../common/usuario';
import { RelatoriosService } from '../relatorios/relatorios.service';

const eu = (req: ReqAuth) => req.usuario as UsuarioPublico;

/** Painel: indicadores de cada perfil (o conteúdo muda conforme quem entra). */
@Controller('painel')
export class PainelController {
  constructor(private readonly relatorios: RelatoriosService) {}

  @Get() listar(@Req() req: ReqAuth) {
    const q = eu(req);
    return this.relatorios.painel({ perfil: q.perfil, associadoId: q.associadoId });
  }
}
