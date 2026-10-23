import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { Perfil } from '../../common/perfil.enum';
import { Perfis } from '../../common/roles.decorator';
import type { ReqAuth, UsuarioPublico } from '../../common/usuario';
import { ControlesFinanceirosService } from './controles-financeiros.service';
import { ContaBaseDto, ContaDto, LancamentoDto, MotivoEstornoDto, MovimentacoesQueryDto, SituacaoContaDto, TransferenciaDto } from './dto/controles.dto';

const LER: Perfil[] = ['presidente', 'vice-presidente', 'tesoureiro', 'conselheiro'];
const ESCREVER: Perfil[] = ['presidente', 'tesoureiro'];
const eu = (req: ReqAuth) => (req.usuario as UsuarioPublico).id;

/** Controles financeiros: contas, receitas, despesas, transferências e histórico. Só presidente e tesoureiro movimentam. */
@Controller('controles-financeiros')
@Perfis(...LER)
export class ControlesFinanceirosController {
  constructor(private readonly service: ControlesFinanceirosService) {}

  @Get('resumo') resumo() { return this.service.resumo(); }
  @Get('categorias') categorias() { return this.service.categorias(); }
  @Get('contas') contas() { return this.service.contas(); }
  @Get('movimentacoes') movimentacoes(@Query() q: MovimentacoesQueryDto) { return this.service.movimentacoes(q); }

  @Post('contas') @HttpCode(201) @Perfis(...ESCREVER)
  criarConta(@Body() d: ContaDto, @Req() req: ReqAuth) { return this.service.criarConta(d, eu(req)); }
  @Patch('contas/:id') @Perfis(...ESCREVER)
  atualizarConta(@Param('id', ParseIntPipe) id: number, @Body() d: ContaBaseDto, @Req() req: ReqAuth) { return this.service.atualizarConta(id, d, eu(req)); }
  @Post('contas/:id/situacao') @HttpCode(200) @Perfis(...ESCREVER)
  situacao(@Param('id', ParseIntPipe) id: number, @Body() d: SituacaoContaDto, @Req() req: ReqAuth) { return this.service.situacaoConta(id, d.ativa, eu(req)); }
  @Delete('contas/:id') @Perfis(...ESCREVER)
  removerConta(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth) { return this.service.removerConta(id, eu(req)); }

  @Post('receitas') @HttpCode(201) @Perfis(...ESCREVER)
  receita(@Body() d: LancamentoDto, @Req() req: ReqAuth) { return this.service.lancarSimples('receita', d, eu(req)); }
  @Post('despesas') @HttpCode(201) @Perfis(...ESCREVER)
  despesa(@Body() d: LancamentoDto, @Req() req: ReqAuth) { return this.service.lancarSimples('despesa', d, eu(req)); }
  @Post('transferencias') @HttpCode(201) @Perfis(...ESCREVER)
  transferir(@Body() d: TransferenciaDto, @Req() req: ReqAuth) { return this.service.transferir(d, eu(req)); }
  @Post('movimentacoes/:id/estornar') @HttpCode(200) @Perfis(...ESCREVER)
  estornar(@Param('id', ParseIntPipe) id: number, @Body() d: MotivoEstornoDto, @Req() req: ReqAuth) { return this.service.estornar(id, d.motivo, eu(req)); }
}
