import { Injectable } from '@nestjs/common';
import { DbService } from '../../common/db.service';

@Injectable()
export class VeiculosRotasService {
  constructor(private readonly db: DbService) {}
  instituicoes() { return this.db.query('select id, nome from instituicao order by nome'); }
  /** Rotas com paradas e instituições atendidas (leitura; o cadastro completo vem na etapa 2). */
  rotas() {
    return this.db.query(`
      select r.id, r.nome,
        coalesce((select json_agg(p.nome order by p.ordem) from rota_parada p where p.rota_id = r.id), '[]') as paradas,
        coalesce((select json_agg(ri.instituicao_id) from rota_instituicao ri where ri.rota_id = r.id), '[]') as instituicoes
      from rota r order by r.id`);
  }
  listar() { return []; } // TODO: veículos
}
