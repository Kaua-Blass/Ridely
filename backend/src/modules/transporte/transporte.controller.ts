import { Controller, Get } from '@nestjs/common';
import { TransporteService } from './transporte.service';

/** Transporte: Reservas, lista de passageiros e lotação. */
@Controller('transporte')
export class TransporteController {
  constructor(private readonly service: TransporteService) {}

  @Get()
  listar() {
    return this.service.listar();
  }
}
