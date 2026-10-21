import { Controller, Get } from '@nestjs/common';
import { PainelService } from './painel.service';

/** Painel: Indicadores por perfil e alertas de lotação. */
@Controller('painel')
export class PainelController {
  constructor(private readonly service: PainelService) {}

  @Get()
  listar() {
    return this.service.listar();
  }
}
