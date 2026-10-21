import { Controller, Get } from '@nestjs/common';
import { ComunicacaoService } from './comunicacao.service';

/** Comunicação: Avisos, notícias e anexos. */
@Controller('comunicacao')
export class ComunicacaoController {
  constructor(private readonly service: ComunicacaoService) {}

  @Get()
  listar() {
    return this.service.listar();
  }
}
