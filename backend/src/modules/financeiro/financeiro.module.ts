import { Module } from '@nestjs/common';
import { CalculoMensalidadeService } from './calculo-mensalidade.service';
import { FinanceiroController } from './financeiro.controller';
import { FinanceiroService } from './financeiro.service';

/** O cálculo de mensalidade é exportado: o módulo de contratos o chama quando um contrato muda. */
@Module({ controllers: [FinanceiroController], providers: [FinanceiroService, CalculoMensalidadeService], exports: [CalculoMensalidadeService] })
export class FinanceiroModule {}
