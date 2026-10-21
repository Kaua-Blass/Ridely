import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  listar() {
    return []; // TODO: consultar o banco
  }
}
