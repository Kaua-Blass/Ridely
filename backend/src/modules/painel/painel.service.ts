import { Injectable } from '@nestjs/common';

@Injectable()
export class PainelService {
  listar() {
    return []; // TODO: consultar o banco
  }
}
