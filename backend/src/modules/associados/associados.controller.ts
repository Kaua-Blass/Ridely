import { Controller, Get } from '@nestjs/common';
import { AssociadosService } from './associados.service';

/** Associados: Cadastro, convites por e-mail e cargos. */
@Controller('associados')
export class AssociadosController {
  constructor(private readonly service: AssociadosService) {}

  @Get()
  listar() {
    return this.service.listar();
  }
}
