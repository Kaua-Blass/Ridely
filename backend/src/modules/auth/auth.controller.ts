import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Publico } from '../../common/auth.guard';
import { RateLimitService } from '../../common/rate-limit.service';
import type { ReqAuth } from '../../common/usuario';
import { AuthService } from './auth.service';
import { CadastroDto, ConcluirCadastroDto, EsqueciSenhaDto, LoginDto, RedefinirSenhaDto, TokenDto } from './dto/auth.dto';

const QUINZE_MIN = 15 * 60_000;

/** Entrar, sair, cadastro, convite e recuperação de conta. */
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService, private readonly limite: RateLimitService) {}

  @Publico() @Post('login') @HttpCode(200)
  login(@Body() d: LoginDto, @Req() req: ReqAuth, @Res({ passthrough: true }) res: Response) {
    this.limite.verificar(`login|${req.ip}|${d.email.toLowerCase()}`, 8, QUINZE_MIN);
    return this.service.login(d.email, d.senha, res);
  }
  @Publico() @Post('logout') @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) { return this.service.logout(res); }

  @Get('me')
  me(@Req() req: ReqAuth) { return req.usuario; }

  @Publico() @Post('cadastro') @HttpCode(201)
  cadastro(@Body() d: CadastroDto, @Req() req: ReqAuth) {
    this.limite.verificar(`cadastro|${req.ip}`, 5, 60 * 60_000);
    return this.service.cadastro(d);
  }
  @Publico() @Post('verificar-email') @HttpCode(200)
  verificar(@Body() d: TokenDto) { return this.service.verificarEmail(d.token); }

  @Publico() @Post('esqueci-senha') @HttpCode(200)
  esqueci(@Body() d: EsqueciSenhaDto, @Req() req: ReqAuth) {
    this.limite.verificar(`esqueci|${req.ip}`, 5, QUINZE_MIN);
    return this.service.esqueciSenha(d.email);
  }
  @Publico() @Post('redefinir-senha') @HttpCode(200)
  redefinir(@Body() d: RedefinirSenhaDto, @Req() req: ReqAuth) {
    this.limite.verificar(`redefinir|${req.ip}`, 10, QUINZE_MIN);
    return this.service.redefinirSenha(d.token, d.senha);
  }
  @Publico() @Post('concluir-cadastro') @HttpCode(200)
  concluir(@Body() d: ConcluirCadastroDto, @Req() req: ReqAuth) {
    this.limite.verificar(`concluir|${req.ip}`, 10, QUINZE_MIN);
    return this.service.concluirCadastro(d.token, d.senha, d.telefone);
  }
}
