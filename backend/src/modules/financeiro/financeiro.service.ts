import { Injectable } from '@nestjs/common';

@Injectable()
export class FinanceiroService {
  listar() {
    return []; // TODO: consultar o banco
  }
}
