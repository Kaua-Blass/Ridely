import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { Perfis } from '../../common/roles.decorator';
import type { ReqAuth, UsuarioPublico } from '../../common/usuario';
import { AssociadosService } from './associados.service';
import { ConviteDto } from './dto/convite.dto';
import { EditarAssociadoDto, SituacaoDto } from './dto/editar.dto';

const quem = (req: ReqAuth) => req.usuario as UsuarioPublico;

/** Associados: cadastro, convites por e-mail, edição e situação. */
@Controller('associados')
@Perfis('presidente', 'vice-presidente', 'tesoureiro', 'conselheiro', 'auxiliar')
export class AssociadosController {
  constructor(private readonly service: AssociadosService) {}

  @Get()
  listar() { return this.service.listar(); }

  @Post('convite') @HttpCode(201) @Perfis('presidente', 'vice-presidente')
  convidar(@Body() d: ConviteDto, @Req() req: ReqAuth) { return this.service.convidar(d, quem(req)); }

  @Post(':id/reenviar-convite') @HttpCode(200) @Perfis('presidente', 'vice-presidente')
  reenviar(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth) { return this.service.reenviar(id, quem(req)); }

  @Patch(':id') @Perfis('presidente', 'vice-presidente')
  editar(@Param('id', ParseIntPipe) id: number, @Body() d: EditarAssociadoDto, @Req() req: ReqAuth) { return this.service.editar(id, d, quem(req)); }

  @Post(':id/situacao') @HttpCode(200) @Perfis('presidente', 'vice-presidente')
  situacao(@Param('id', ParseIntPipe) id: number, @Body() d: SituacaoDto, @Req() req: ReqAuth) { return this.service.situacao(id, d.ativo, quem(req)); }
}
