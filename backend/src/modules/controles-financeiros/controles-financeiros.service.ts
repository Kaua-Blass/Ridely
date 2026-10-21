import { Injectable } from '@nestjs/common';

@Injectable()
export class ControlesFinanceirosService {
  listar() {
    return []; // TODO: consultar o banco
  }
}
