import { Module } from '@nestjs/common';
import { TransporteModule } from '../transporte/transporte.module';
import { VeiculosRotasController } from './veiculos-rotas.controller';
import { VeiculosRotasService } from './veiculos-rotas.service';

@Module({ imports: [TransporteModule], controllers: [VeiculosRotasController], providers: [VeiculosRotasService] })
export class VeiculosRotasModule {}
