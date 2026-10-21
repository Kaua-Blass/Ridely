import { Injectable } from '@nestjs/common';

@Injectable()
export class TransporteService {
  listar() {
    return []; // TODO: consultar o banco
  }
}
