import { BadRequestException, Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Perfis } from '../../common/roles.decorator';
import { LER_RELATORIOS, RelatoriosService } from './relatorios.service';
const DATA = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

/** Relatórios gerenciais e exportação. Só presidente, vice, tesoureiro e conselheiro. */
@Controller('relatorios')
@Perfis(...LER_RELATORIOS)
export class RelatoriosController {
  constructor(private readonly service: RelatoriosService) {}

  @Get('inadimplencia') inadimplencia() { return this.service.inadimplencia(); }
  @Get('fluxo-caixa') fluxo(@Query('de') de?: string, @Query('ate') ate?: string) { return this.service.fluxoCaixa(DATA(de), DATA(ate)); }
  @Get('contratos-a-vencer') contratos() { return this.service.contratosAVencer(); }

  /** Exportação: /relatorios/exportar/:tipo?formato=pdf|csv (tipo: inadimplencia | fluxo | contratos). */
  @Get('exportar/:tipo')
  async exportar(@Param('tipo') tipo: string, @Query('formato') formato: string, @Query('de') de: string, @Query('ate') ate: string, @Res() res: Response) {
    if (!['inadimplencia', 'fluxo', 'contratos'].includes(tipo)) throw new BadRequestException('Relatório desconhecido.');
    const f = formato === 'csv' ? 'csv' : 'pdf';
    const r = await this.service.exportar(tipo as 'inadimplencia' | 'fluxo' | 'contratos', f, DATA(de), DATA(ate));
    res.set({ 'Content-Type': r.tipo, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(r.nome)}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
    res.send(r.corpo);
  }
}
