import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Req, Res, UploadedFile, UseFilters, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ArquivoGrandeFilter } from '../../common/erros';
import { RateLimitService } from '../../common/rate-limit.service';
import type { ReqAuth, UsuarioPublico } from '../../common/usuario';
import { AtualizarPerfilDto, TrocarEmailDto, TrocarSenhaDto } from './dto/perfil.dto';
import { PerfilService } from './perfil.service';

const eu = (req: ReqAuth) => (req.usuario as UsuarioPublico).id;

/** Meu perfil: qualquer usuário logado, sempre sobre a própria conta. */
@Controller('perfil')
export class PerfilController {
  constructor(private readonly service: PerfilService, private readonly limite: RateLimitService) {}

  @Get() obter(@Req() req: ReqAuth) { return this.service.obter(eu(req)); }

  @Patch() atualizar(@Body() d: AtualizarPerfilDto, @Req() req: ReqAuth) { return this.service.atualizar(eu(req), d); }

  @Post('senha') @HttpCode(200)
  trocarSenha(@Body() d: TrocarSenhaDto, @Req() req: ReqAuth, @Res({ passthrough: true }) res: Response) {
    this.limite.verificar(`senha|${eu(req)}`, 5, 15 * 60_000);
    return this.service.trocarSenha(eu(req), d, res);
  }

  @Post('email') @HttpCode(200)
  trocarEmail(@Body() d: TrocarEmailDto, @Req() req: ReqAuth) {
    this.limite.verificar(`email|${eu(req)}`, 5, 15 * 60_000);
    return this.service.trocarEmail(eu(req), d);
  }

  @Post('foto') @HttpCode(200) @UseFilters(ArquivoGrandeFilter)
  @UseInterceptors(FileInterceptor('foto', { limits: { fileSize: 2 * 1024 * 1024, files: 1 } }))
  salvarFoto(@UploadedFile() arquivo: Express.Multer.File | undefined, @Req() req: ReqAuth) { return this.service.salvarFoto(eu(req), arquivo); }

  @Delete('foto') removerFoto(@Req() req: ReqAuth) { return this.service.removerFoto(eu(req)); }

  @Get('foto')
  async foto(@Req() req: ReqAuth, @Res() res: Response) {
    const { caminho, mime } = await this.service.arquivoFoto(eu(req));
    res.set({ 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=300' });
    res.sendFile(caminho);
  }
}
