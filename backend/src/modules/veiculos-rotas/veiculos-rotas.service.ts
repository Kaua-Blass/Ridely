import { Injectable } from '@nestjs/common';
import { DbService } from '../../common/db.service';

@Injectable()
export class VeiculosRotasService {
  constructor(private readonly db: DbService) {}
  instituicoes() { return this.db.query('select id, nome from instituicao order by nome'); }
  listar() { return []; } // TODO: veículos e rotas
}
