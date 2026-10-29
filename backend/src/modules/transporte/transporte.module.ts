import { Module } from '@nestjs/common';
import { FilaService } from './fila.service';
import { TransporteController } from './transporte.controller';
import { TransporteService } from './transporte.service';

/** FilaService é exportado: o módulo de veículos o chama quando a capacidade de uma rota muda. */
@Module({ controllers: [TransporteController], providers: [TransporteService, FilaService], exports: [FilaService] })
export class TransporteModule {}
