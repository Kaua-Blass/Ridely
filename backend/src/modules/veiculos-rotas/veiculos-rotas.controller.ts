import { Controller, Get } from '@nestjs/common';
import { VeiculosRotasService } from './veiculos-rotas.service';

/** Veículos e rotas: Veículos, rotas, paradas e instituições atendidas. */
@Controller('veiculos-rotas')
export class VeiculosRotasController {
  constructor(private readonly service: VeiculosRotasService) {}

  @Get()
  listar() {
    return this.service.listar();
  }
}
