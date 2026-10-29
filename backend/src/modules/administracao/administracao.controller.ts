import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { Perfis } from '../../common/roles.decorator';
import type { ReqAuth, UsuarioPublico } from '../../common/usuario';
import { AdministracaoService } from './administracao.service';
import { AtualizarUsuarioDto, AuditoriaQueryDto, ParametrosDto } from './dto/admin.dto';
import { DecisaoDto } from './dto/decisao.dto';

const quem = (req: ReqAuth) => (req.usuario as UsuarioPublico).id;

/** Administração: solicitações, usuários e perfis, parâmetros e auditoria. Só o presidente. */
@Controller('administracao')
@Perfis('presidente')
export class AdministracaoController {
  constructor(private readonly service: AdministracaoService) {}

  @Get('solicitacoes') solicitacoes() { return this.service.solicitacoes(); }

  @Post('solicitacoes/:id/decisao') @HttpCode(200)
  decidir(@Param('id', ParseIntPipe) id: number, @Body() d: DecisaoDto, @Req() req: ReqAuth) { return this.service.decidir(id, d.aprovar, quem(req)); }

  @Get('usuarios') usuarios() { return this.service.usuarios(); }

  @Patch('usuarios/:id')
  atualizarUsuario(@Param('id', ParseIntPipe) id: number, @Body() d: AtualizarUsuarioDto, @Req() req: ReqAuth) { return this.service.atualizarUsuario(id, d, quem(req)); }

  @Get('parametros') parametros() { return this.service.parametros(); }

  @Put('parametros') salvarParametros(@Body() d: ParametrosDto, @Req() req: ReqAuth) { return this.service.salvarParametros(d, quem(req)); }

  @Get('auditoria') auditoria(@Query() q: AuditoriaQueryDto) { return this.service.auditoria(q); }

  @Get('auditoria/acoes') acoes() { return this.service.acoesAuditoria(); }
}
