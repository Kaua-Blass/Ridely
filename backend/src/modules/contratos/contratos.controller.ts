import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Req, Res, UploadedFile, UseFilters, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PdfGrandeFilter } from '../../common/erros';
import type { Perfil } from '../../common/perfil.enum';
import { Perfis } from '../../common/roles.decorator';
import type { ReqAuth, UsuarioPublico } from '../../common/usuario';
import { ContratosService } from './contratos.service';
import { AditivoDto, ContratoBaseDto, ContratoDto, DecisaoSolicitacaoDto, EncerrarDto, PreviaQueryDto, SolicitacaoContratoDto } from './dto/contratos.dto';

const LER: Perfil[] = ['presidente', 'vice-presidente', 'tesoureiro', 'conselheiro', 'auxiliar', 'associado'];
const ESCREVER: Perfil[] = ['presidente', 'vice-presidente', 'auxiliar'];
const eu = (req: ReqAuth) => req.usuario as UsuarioPublico;

/** Contratos: vigência, dias contratados, aditivos, PDF e solicitações de alteração.
 *  O associado enxerga só os próprios contratos; quem altera: presidente, vice e auxiliar. */
@Controller('contratos')
@Perfis(...LER)
export class ContratosController {
  constructor(private readonly service: ContratosService) {}

  @Get() listar(@Req() req: ReqAuth) { return this.service.listar(eu(req)); }

  // rotas fixas antes de ':id'
  @Get('solicitacoes') solicitacoes(@Req() req: ReqAuth) { return this.service.solicitacoes(eu(req)); }
  @Post('solicitacoes') @HttpCode(201) @Perfis('associado')
  solicitar(@Body() d: SolicitacaoContratoDto, @Req() req: ReqAuth) { return this.service.solicitar(d, eu(req)); }
  @Post('solicitacoes/:id/decisao') @HttpCode(200) @Perfis(...ESCREVER)
  decidir(@Param('id', ParseIntPipe) id: number, @Body() d: DecisaoSolicitacaoDto, @Req() req: ReqAuth) { return this.service.decidir(id, d.aprovar, d.motivo, eu(req)); }

  @Post() @HttpCode(201) @Perfis(...ESCREVER)
  criar(@Body() d: ContratoDto, @Req() req: ReqAuth) { return this.service.criar(d, eu(req)); }

  @Get(':id') detalhe(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth) { return this.service.detalhe(id, eu(req)); }

  @Patch(':id') @Perfis(...ESCREVER)
  editar(@Param('id', ParseIntPipe) id: number, @Body() d: ContratoBaseDto, @Req() req: ReqAuth) { return this.service.editar(id, d, eu(req)); }

  @Get(':id/previa-mensalidade')
  previa(@Param('id', ParseIntPipe) id: number, @Query() q: PreviaQueryDto, @Req() req: ReqAuth) { return this.service.previa(id, q.referencia, eu(req)); }

  @Post(':id/aditivos') @HttpCode(201) @Perfis(...ESCREVER)
  aditivar(@Param('id', ParseIntPipe) id: number, @Body() d: AditivoDto, @Req() req: ReqAuth) { return this.service.aditivar(id, d, eu(req)); }

  @Post(':id/encerrar') @HttpCode(200) @Perfis(...ESCREVER)
  encerrar(@Param('id', ParseIntPipe) id: number, @Body() d: EncerrarDto, @Req() req: ReqAuth) { return this.service.encerrar(id, d.data, eu(req)); }

  @Post(':id/pdf') @HttpCode(200) @UseFilters(PdfGrandeFilter)
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  salvarPdf(@Param('id', ParseIntPipe) id: number, @UploadedFile() arquivo: Express.Multer.File | undefined, @Req() req: ReqAuth) { return this.service.salvarPdf(id, arquivo, eu(req)); }

  @Delete(':id/pdf') @Perfis(...ESCREVER)
  removerPdf(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth) { return this.service.removerPdf(id, eu(req)); }

  @Get(':id/pdf')
  async baixarPdf(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth, @Res() res: Response) {
    const { caminho, nome } = await this.service.arquivoPdf(id, eu(req));
    // attachment + nosniff: o navegador baixa o arquivo em vez de executar qualquer coisa dentro do PDF
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
    res.sendFile(caminho);
  }
}
