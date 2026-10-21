import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { Perfis } from '../../common/roles.decorator';
import type { ReqAuth, UsuarioPublico } from '../../common/usuario';
import { AdministracaoService } from './administracao.service';
import { DecisaoDto } from './dto/decisao.dto';

/** Administração: solicitações, usuários e perfis, parâmetros e auditoria. */
@Controller('administracao')
@Perfis('presidente')
export class AdministracaoController {
  constructor(private readonly service: AdministracaoService) {}

  @Get('solicitacoes')
  solicitacoes() { return this.service.solicitacoes(); }

  @Post('solicitacoes/:id/decisao') @HttpCode(200)
  decidir(@Param('id', ParseIntPipe) id: number, @Body() d: DecisaoDto, @Req() req: ReqAuth) {
    return this.service.decidir(id, d.aprovar, (req.usuario as UsuarioPublico).id);
  }
}
