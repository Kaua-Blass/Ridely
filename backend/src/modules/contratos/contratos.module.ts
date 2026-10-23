import { Module } from '@nestjs/common';
import { FinanceiroModule } from '../financeiro/financeiro.module';
import { ContratosController } from './contratos.controller';
import { ContratosService } from './contratos.service';

@Module({ imports: [FinanceiroModule], controllers: [ContratosController], providers: [ContratosService] })
export class ContratosModule {}
