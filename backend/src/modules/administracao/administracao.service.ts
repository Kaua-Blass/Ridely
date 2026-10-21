import { Injectable } from '@nestjs/common';

@Injectable()
export class AdministracaoService {
  listar() {
    return []; // TODO: consultar o banco
  }
}
