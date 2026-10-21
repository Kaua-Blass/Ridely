import { Injectable } from '@nestjs/common';

@Injectable()
export class PerfilService {
  listar() {
    return []; // TODO: consultar o banco
  }
}
