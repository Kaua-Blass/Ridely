import { Controller, Get } from '@nestjs/common';
import { FinanceiroService } from './financeiro.service';

/** Financeiro: Mensalidades, baixas e multa por atraso. */
@Controller('financeiro')
export class FinanceiroController {
  constructor(private readonly service: FinanceiroService) {}

  @Get()
  listar() {
    return this.service.listar();
  }
}
