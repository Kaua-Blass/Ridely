import { Module } from '@nestjs/common';
import { AssociadosController } from './associados.controller';
import { AssociadosService } from './associados.service';

@Module({ controllers: [AssociadosController], providers: [AssociadosService] })
export class AssociadosModule {}
