import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Req, Res, UploadedFile, UseFilters, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AnexoGrandeFilter } from '../../common/erros';
import type { Perfil } from '../../common/perfil.enum';
import { Perfis } from '../../common/roles.decorator';
import type { ReqAuth, UsuarioPublico } from '../../common/usuario';
import { ComunicacaoService, GERENTES } from './comunicacao.service';
import { CriarComunicadoDto, EditarComunicadoDto, ListaQueryDto } from './dto/comunicacao.dto';
import { NotificacoesService } from './notificacoes.service';
import { RotinasService } from './rotinas.service';

const ESCREVER = GERENTES as unknown as Perfil[];
const eu = (req: ReqAuth) => req.usuario as UsuarioPublico;

/** Comunicação: comunicados com anexo, notificações do painel e rotinas automáticas.
 *  Qualquer pessoa logada lê o que é para ela; publicam presidente, vice e tesoureiro (este só Cobrança e Aviso). */
@Controller('comunicacao')
export class ComunicacaoController {
  constructor(
    private readonly service: ComunicacaoService,
    private readonly notificacoes: NotificacoesService,
    private readonly rotinas: RotinasService,
  ) {}

  // ---------- notificações da pessoa logada (rotas fixas antes de ':id') ----------
  @Get('notificacoes') listarNotificacoes(@Query() q: ListaQueryDto, @Req() req: ReqAuth) { return this.notificacoes.listar(eu(req).id, q); }
  @Get('notificacoes/resumo') async resumo(@Req() req: ReqAuth) { return { naoLidas: await this.notificacoes.naoLidas(eu(req).id) }; }
  @Post('notificacoes/lidas') @HttpCode(200) marcarTodas(@Req() req: ReqAuth) { return this.notificacoes.marcarTodasLidas(eu(req).id); }
  @Post('notificacoes/:id/lida') @HttpCode(200)
  marcarLida(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth) { return this.notificacoes.marcarLida(eu(req).id, id); }

  // ---------- rotinas automáticas ----------
  @Get('rotinas') @Perfis(...ESCREVER) situacaoRotinas() { return this.rotinas.situacao(); }
  @Post('rotinas/:id/executar') @HttpCode(200) @Perfis(...ESCREVER)
  async executar(@Param('id') id: string, @Req() req: ReqAuth) {
    const r = await this.rotinas.executar(id, 'manual', eu(req).id);
    return { ...r, mensagem: r.detalhe ?? `${r.criadas} notificação(ões) criada(s); ${r.ignoradas} já enviada(s) antes.` };
  }

  // ---------- comunicados ----------
  @Get() listar(@Query() q: ListaQueryDto, @Req() req: ReqAuth) { return this.service.listar(eu(req), q); }
  @Get('destinatarios') @Perfis(...ESCREVER) destinatarios() { return this.service.destinatarios(); }

  @Post() @HttpCode(201) @Perfis(...ESCREVER)
  criar(@Body() d: CriarComunicadoDto, @Req() req: ReqAuth) { return this.service.criar(d, eu(req)); }

  @Patch(':id') @Perfis(...ESCREVER)
  editar(@Param('id', ParseIntPipe) id: number, @Body() d: EditarComunicadoDto, @Req() req: ReqAuth) { return this.service.editar(id, d, eu(req)); }

  @Delete(':id') @Perfis(...ESCREVER)
  remover(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth) { return this.service.remover(id, eu(req)); }

  @Post(':id/anexo') @HttpCode(200) @Perfis(...ESCREVER) @UseFilters(AnexoGrandeFilter)
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  salvarAnexo(@Param('id', ParseIntPipe) id: number, @UploadedFile() arquivo: Express.Multer.File | undefined, @Req() req: ReqAuth) { return this.service.salvarAnexo(id, arquivo, eu(req)); }

  @Delete(':id/anexo') @Perfis(...ESCREVER)
  removerAnexo(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth) { return this.service.removerAnexo(id, eu(req)); }

  @Get(':id/anexo')
  async anexo(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth, @Res() res: Response) {
    const { caminho, nome, mime } = await this.service.anexoDe(id, eu(req));
    res.set({ 'Content-Type': mime, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
    res.sendFile(caminho);
  }
}
