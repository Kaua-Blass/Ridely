import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import type { Perfil } from '../../common/perfil.enum';
import { Perfis } from '../../common/roles.decorator';
import type { ReqAuth, UsuarioPublico } from '../../common/usuario';
import { CancelarReservaDto, ListaQueryDto, MoverVeiculoDto, PainelQueryDto, ReservaDto, SituacaoReservaDto } from './dto/transporte.dto';
import { TransporteService } from './transporte.service';

const RESERVAR: Perfil[] = ['associado', 'presidente', 'vice-presidente', 'auxiliar'];
const EQUIPE: Perfil[] = ['presidente', 'vice-presidente', 'auxiliar'];
const OPERACAO: Perfil[] = [...EQUIPE, 'motorista'];
const eu = (req: ReqAuth) => req.usuario as UsuarioPublico;

/** Transporte: reservas, lista de espera, lotação, lista de passageiros e embarque. */
@Controller('transporte')
export class TransporteController {
  constructor(private readonly service: TransporteService) {}

  @Get('minhas') @Perfis(...RESERVAR)
  minhas(@Req() req: ReqAuth) { return this.service.minhas(eu(req)); }

  @Post('reservas') @HttpCode(201) @Perfis(...RESERVAR)
  reservar(@Body() d: ReservaDto, @Req() req: ReqAuth) { return this.service.reservar(d, eu(req)); }

  @Post('reservas/:id/cancelar') @HttpCode(200) @Perfis(...RESERVAR)
  cancelar(@Param('id', ParseIntPipe) id: number, @Body() d: CancelarReservaDto, @Req() req: ReqAuth) { return this.service.cancelar(id, d.motivo, eu(req)); }

  @Post('reservas/:id/situacao') @HttpCode(200) @Perfis(...OPERACAO)
  situacao(@Param('id', ParseIntPipe) id: number, @Body() d: SituacaoReservaDto, @Req() req: ReqAuth) { return this.service.marcar(id, d.status, eu(req)); }

  @Post('reservas/:id/veiculo') @HttpCode(200) @Perfis(...EQUIPE)
  veiculo(@Param('id', ParseIntPipe) id: number, @Body() d: MoverVeiculoDto, @Req() req: ReqAuth) { return this.service.moverVeiculo(id, d.veiculoId, eu(req)); }

  @Get('lista') @Perfis(...OPERACAO)
  lista(@Query() q: ListaQueryDto, @Req() req: ReqAuth) { return this.service.lista(q.data, q.rotaId, eu(req)); }

  @Get('painel') @Perfis(...EQUIPE)
  painel(@Query() q: PainelQueryDto) { return this.service.painel(q.de, q.ate); }

  @Get('alertas') @Perfis(...EQUIPE)
  alertas() { return this.service.alertas(); }
}
