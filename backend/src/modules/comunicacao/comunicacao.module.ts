import { Module } from '@nestjs/common';
import { ComunicacaoController } from './comunicacao.controller';
import { ComunicacaoService } from './comunicacao.service';

@Module({ controllers: [ComunicacaoController], providers: [ComunicacaoService] })
export class ComunicacaoModule {}
