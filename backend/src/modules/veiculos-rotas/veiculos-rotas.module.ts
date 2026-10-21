import { Module } from '@nestjs/common';
import { VeiculosRotasController } from './veiculos-rotas.controller';
import { VeiculosRotasService } from './veiculos-rotas.service';

@Module({ controllers: [VeiculosRotasController], providers: [VeiculosRotasService] })
export class VeiculosRotasModule {}
