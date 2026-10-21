import { Controller, Get } from '@nestjs/common';
import { PerfilService } from './perfil.service';

/** Meu perfil: Dados pessoais, foto, instituição e troca de senha. */
@Controller('perfil')
export class PerfilController {
  constructor(private readonly service: PerfilService) {}

  @Get()
  listar() {
    return this.service.listar();
  }
}
