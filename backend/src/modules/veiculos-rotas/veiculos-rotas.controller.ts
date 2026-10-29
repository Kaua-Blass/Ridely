import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { Publico } from '../../common/auth.guard';
import type { Perfil } from '../../common/perfil.enum';
import { Perfis } from '../../common/roles.decorator';
import type { ReqAuth, UsuarioPublico } from '../../common/usuario';
import { InstituicaoDto, MotoristaConviteDto, RotaDto, VeiculoDto } from './dto/veiculos-rotas.dto';
import { VeiculosRotasService } from './veiculos-rotas.service';

const LER: Perfil[] = ['presidente', 'vice-presidente', 'tesoureiro', 'conselheiro', 'auxiliar', 'motorista'];
const ESCREVER: Perfil[] = ['presidente', 'vice-presidente'];
const quem = (req: ReqAuth) => (req.usuario as UsuarioPublico).id;

/** Veículos e rotas: veículos, rotas, paradas, instituições atendidas e motoristas. */
@Controller('veiculos-rotas')
export class VeiculosRotasController {
  constructor(private readonly service: VeiculosRotasService) {}

  /** Pública: a tela de cadastro lista as instituições antes do login. */
  @Publico() @Get('instituicoes') instituicoes() { return this.service.instituicoesPublicas(); }
  /** Qualquer usuário logado: usada pelos formulários de associado e perfil. */
  @Get('rotas') rotas() { return this.service.rotas(); }
  @Get() @Perfis(...LER) visaoGeral() { return this.service.visaoGeral(); }

  @Post('instituicoes') @HttpCode(201) @Perfis(...ESCREVER)
  criarInstituicao(@Body() d: InstituicaoDto, @Req() req: ReqAuth) { return this.service.criarInstituicao(d, quem(req)); }
  @Patch('instituicoes/:id') @Perfis(...ESCREVER)
  atualizarInstituicao(@Param('id', ParseIntPipe) id: number, @Body() d: InstituicaoDto, @Req() req: ReqAuth) { return this.service.atualizarInstituicao(id, d, quem(req)); }
  @Delete('instituicoes/:id') @Perfis(...ESCREVER)
  removerInstituicao(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth) { return this.service.removerInstituicao(id, quem(req)); }

  @Post('rotas') @HttpCode(201) @Perfis(...ESCREVER)
  criarRota(@Body() d: RotaDto, @Req() req: ReqAuth) { return this.service.criarRota(d, quem(req)); }
  @Patch('rotas/:id') @Perfis(...ESCREVER)
  atualizarRota(@Param('id', ParseIntPipe) id: number, @Body() d: RotaDto, @Req() req: ReqAuth) { return this.service.atualizarRota(id, d, quem(req)); }
  @Delete('rotas/:id') @Perfis(...ESCREVER)
  removerRota(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth) { return this.service.removerRota(id, quem(req)); }

  @Post('veiculos') @HttpCode(201) @Perfis(...ESCREVER)
  criarVeiculo(@Body() d: VeiculoDto, @Req() req: ReqAuth) { return this.service.criarVeiculo(d, quem(req)); }
  @Patch('veiculos/:id') @Perfis(...ESCREVER)
  atualizarVeiculo(@Param('id', ParseIntPipe) id: number, @Body() d: VeiculoDto, @Req() req: ReqAuth) { return this.service.atualizarVeiculo(id, d, quem(req)); }
  @Delete('veiculos/:id') @Perfis(...ESCREVER)
  removerVeiculo(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth) { return this.service.removerVeiculo(id, quem(req)); }

  @Post('motoristas/convite') @HttpCode(201) @Perfis(...ESCREVER)
  convidarMotorista(@Body() d: MotoristaConviteDto, @Req() req: ReqAuth) { return this.service.convidarMotorista(d, quem(req)); }
  @Post('motoristas/:id/reenviar-convite') @HttpCode(200) @Perfis(...ESCREVER)
  reenviarMotorista(@Param('id', ParseIntPipe) id: number) { return this.service.reenviarConviteMotorista(id); }
}
