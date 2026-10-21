import { Module } from '@nestjs/common';
import { ControlesFinanceirosController } from './controles-financeiros.controller';
import { ControlesFinanceirosService } from './controles-financeiros.service';

@Module({ controllers: [ControlesFinanceirosController], providers: [ControlesFinanceirosService] })
export class ControlesFinanceirosModule {}
