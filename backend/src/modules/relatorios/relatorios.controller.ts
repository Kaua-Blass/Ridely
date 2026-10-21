import { Controller, Get } from '@nestjs/common';
import { RelatoriosService } from './relatorios.service';

/** Relatórios: Inadimplência, fluxo de caixa e contratos a vencer. */
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly service: RelatoriosService) {}

  @Get()
  listar() {
    return this.service.listar();
  }
}
