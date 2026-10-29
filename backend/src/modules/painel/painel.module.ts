import { Module } from '@nestjs/common';
import { RelatoriosModule } from '../relatorios/relatorios.module';
import { PainelController } from './painel.controller';

@Module({ imports: [RelatoriosModule], controllers: [PainelController] })
export class PainelModule {}
