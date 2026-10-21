import { Controller, Get } from '@nestjs/common';
import { ContratosService } from './contratos.service';

/** Contratos: Vigência, dias contratados, aditivos e PDF. */
@Controller('contratos')
export class ContratosController {
  constructor(private readonly service: ContratosService) {}

  @Get()
  listar() {
    return this.service.listar();
  }
}
