import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { Perfis } from '../../common/roles.decorator';
import type { ReqAuth, UsuarioPublico } from '../../common/usuario';
import { AssociadosService } from './associados.service';
import { ConviteDto } from './dto/convite.dto';

/** Associados: cadastro, convites por e-mail e cargos. */
@Controller('associados')
@Perfis('presidente', 'vice-presidente', 'tesoureiro', 'conselheiro', 'auxiliar')
export class AssociadosController {
  constructor(private readonly service: AssociadosService) {}

  @Get()
  listar() { return this.service.listar(); }

  @Post('convite') @HttpCode(201) @Perfis('presidente', 'vice-presidente')
  convidar(@Body() d: ConviteDto, @Req() req: ReqAuth) { return this.service.convidar(d, req.usuario as UsuarioPublico); }

  @Post(':id/reenviar-convite') @HttpCode(200) @Perfis('presidente', 'vice-presidente')
  reenviar(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth) { return this.service.reenviar(id, req.usuario as UsuarioPublico); }
}
