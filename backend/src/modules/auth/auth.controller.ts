import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth.service';

/** Entrar: E-mail e senha, convite e criação de conta. */
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Get()
  listar() {
    return this.service.listar();
  }
}
