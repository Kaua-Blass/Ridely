import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ComunicacaoController } from './comunicacao.controller';
import { ComunicacaoService } from './comunicacao.service';
import { NotificacoesService } from './notificacoes.service';
import { RotinasService } from './rotinas.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [ComunicacaoController],
  providers: [ComunicacaoService, NotificacoesService, RotinasService],
  exports: [NotificacoesService],
})
export class ComunicacaoModule {}
