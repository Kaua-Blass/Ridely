import { Controller, Get } from '@nestjs/common';
import { Publico } from '../../common/auth.guard';
import { VeiculosRotasService } from './veiculos-rotas.service';

/** Veículos e rotas: veículos, rotas, paradas e instituições atendidas. */
@Controller('veiculos-rotas')
export class VeiculosRotasController {
  constructor(private readonly service: VeiculosRotasService) {}

  /** Pública: a tela de cadastro precisa listar as instituições antes do login. */
  @Publico() @Get('instituicoes')
  instituicoes() { return this.service.instituicoes(); }

  @Get('rotas')
  rotas() { return this.service.rotas(); }

  @Get()
  listar() { return this.service.listar(); }
}
