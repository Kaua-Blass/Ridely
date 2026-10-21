import { Controller, Get } from '@nestjs/common';
import { ControlesFinanceirosService } from './controles-financeiros.service';

/** Controles financeiros: Cadastro de contas, receitas, despesas e transferências. */
@Controller('controles-financeiros')
export class ControlesFinanceirosController {
  constructor(private readonly service: ControlesFinanceirosService) {}

  @Get()
  listar() {
    return this.service.listar();
  }
}
