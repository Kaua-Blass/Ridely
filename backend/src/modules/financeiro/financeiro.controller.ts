import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Perfil } from '../../common/perfil.enum';
import { Perfis } from '../../common/roles.decorator';
import type { ReqAuth, UsuarioPublico } from '../../common/usuario';
import { BaixaDto, GerarDto, MensalidadesQueryDto, MotivoDto } from './dto/financeiro.dto';
import { FinanceiroService } from './financeiro.service';

const LER: Perfil[] = ['presidente', 'vice-presidente', 'tesoureiro', 'conselheiro', 'associado'];
const ESCREVER: Perfil[] = ['presidente', 'tesoureiro'];
const eu = (req: ReqAuth) => req.usuario as UsuarioPublico;

/** Financeiro: mensalidades, baixas, estornos e recibos. O associado enxerga só as próprias. */
@Controller('financeiro')
@Perfis(...LER)
export class FinanceiroController {
  constructor(private readonly service: FinanceiroService) {}

  @Get('mensalidades') listar(@Query() q: MensalidadesQueryDto, @Req() req: ReqAuth) { return this.service.listar(q, eu(req)); }
  @Get('resumo') resumo(@Req() req: ReqAuth) { return this.service.resumo(eu(req)); }

  @Post('mensalidades/gerar') @HttpCode(200) @Perfis(...ESCREVER)
  gerar(@Body() d: GerarDto, @Req() req: ReqAuth) { return this.service.gerar(d, eu(req)); }
  @Post('mensalidades/:id/baixa') @HttpCode(200) @Perfis(...ESCREVER)
  baixar(@Param('id', ParseIntPipe) id: number, @Body() d: BaixaDto, @Req() req: ReqAuth) { return this.service.baixar(id, d, eu(req)); }
  @Post('mensalidades/:id/cancelar') @HttpCode(200) @Perfis(...ESCREVER)
  cancelar(@Param('id', ParseIntPipe) id: number, @Body() d: MotivoDto, @Req() req: ReqAuth) { return this.service.cancelar(id, d.motivo, eu(req)); }
  @Post('mensalidades/:id/reativar') @HttpCode(200) @Perfis(...ESCREVER)
  reativar(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth) { return this.service.reativar(id, eu(req)); }
  @Post('pagamentos/:id/estornar') @HttpCode(200) @Perfis(...ESCREVER)
  estornar(@Param('id', ParseIntPipe) id: number, @Body() d: MotivoDto, @Req() req: ReqAuth) { return this.service.estornar(id, d.motivo, eu(req)); }

  @Get('recibos/:id')
  async recibo(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth, @Res() res: Response) {
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="recibo-${String(id).padStart(6, '0')}.pdf"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
    await this.service.recibo(id, eu(req), res);
  }
}
