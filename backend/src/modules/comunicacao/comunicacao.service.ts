import { Injectable } from '@nestjs/common';

@Injectable()
export class ComunicacaoService {
  listar() {
    return []; // TODO: consultar o banco
  }
}
