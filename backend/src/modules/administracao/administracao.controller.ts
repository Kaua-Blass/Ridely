import { Controller, Get } from '@nestjs/common';
import { AdministracaoService } from './administracao.service';

/** Administração: Solicitações, usuários e perfis, parâmetros e auditoria. */
@Controller('administracao')
export class AdministracaoController {
  constructor(private readonly service: AdministracaoService) {}

  @Get()
  listar() {
    return this.service.listar();
  }
}
