import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DbService } from '../../common/db.service';
import { tratarUnico } from '../../common/erros';
import { MailService } from '../../common/mail.service';
import { hashToken, novoToken } from '../../common/password';
import { InstituicaoDto, MotoristaConviteDto, RotaDto, VeiculoDto } from './dto/veiculos-rotas.dto';

const normalizarPlaca = (p: string) => p.replace('-', '').toUpperCase();

@Injectable()
export class VeiculosRotasService {
  constructor(private readonly db: DbService, private readonly mail: MailService) {}

  // ---------- leitura ----------
  instituicoesPublicas() { return this.db.query('select id, nome from instituicao order by nome'); }

  /** Rotas com paradas e instituições (usada pelos formulários de associado). */
  rotas() {
    return this.db.query(`
      select r.id, r.nome,
        coalesce((select json_agg(p.nome order by p.ordem) from rota_parada p where p.rota_id = r.id), '[]') as paradas,
        coalesce((select json_agg(ri.instituicao_id) from rota_instituicao ri where ri.rota_id = r.id), '[]') as instituicoes
      from rota r order by r.id`);
  }

  async visaoGeral() {
    const [rotas, veiculos, instituicoes, motoristas] = await Promise.all([
      this.db.query(`
        select r.id, r.nome, r.descricao,
          coalesce((select json_agg(p.nome order by p.ordem) from rota_parada p where p.rota_id = r.id), '[]') as paradas,
          coalesce((select json_agg(ri.instituicao_id order by ri.instituicao_id) from rota_instituicao ri where ri.rota_id = r.id), '[]') as instituicoes,
          (select count(*)::int from veiculo v where v.rota_id = r.id) as veiculos,
          (select coalesce(sum(v.capacidade), 0)::int from veiculo v where v.rota_id = r.id) as capacidade,
          (select count(*)::int from associado a where a.rota_id = r.id and a.situacao <> 'inativo') as associados
        from rota r order by r.id`),
      this.db.query(`
        select v.id, v.nome, v.placa, v.capacidade, v.rota_id as "rotaId", r.nome as rota, v.motorista_usuario_id as "motoristaId", u.nome as motorista
        from veiculo v left join rota r on r.id = v.rota_id left join usuario u on u.id = v.motorista_usuario_id order by v.nome`),
      this.db.query(`select i.id, i.nome, (select count(*)::int from associado a where a.instituicao_id = i.id) as associados from instituicao i order by i.nome`),
      this.db.query(`select id, nome, email, ativo, (senha_hash = 'pendente') as pendente from usuario where perfil = 'motorista' order by nome`),
    ]);
    return { rotas, veiculos, instituicoes, motoristas };
  }

  // ---------- instituições ----------
  async criarInstituicao(d: InstituicaoDto, quemId: number) {
    try {
      const i = await this.db.um('insert into instituicao(nome) values($1) returning id', [d.nome.trim()]);
      await this.db.auditar(quemId, 'instituicao_criada', 'instituicao', { id: i!.id, nome: d.nome.trim() });
      return { id: i!.id, mensagem: 'Instituição criada.' };
    } catch (e) { tratarUnico(e, 'Já existe uma instituição com esse nome.'); }
  }
  async atualizarInstituicao(id: number, d: InstituicaoDto, quemId: number) {
    try {
      const r = await this.db.query('update instituicao set nome=$2 where id=$1 returning id', [id, d.nome.trim()]);
      if (!r.length) throw new NotFoundException('Instituição não encontrada.');
    } catch (e) { if (e instanceof NotFoundException) throw e; tratarUnico(e, 'Já existe uma instituição com esse nome.'); }
    await this.db.auditar(quemId, 'instituicao_alterada', 'instituicao', { id, nome: d.nome.trim() });
    return { mensagem: 'Instituição atualizada.' };
  }
  async removerInstituicao(id: number, quemId: number) {
    const i = await this.db.um('select nome from instituicao where id=$1', [id]);
    if (!i) throw new NotFoundException('Instituição não encontrada.');
    const a = await this.db.um('select count(*)::int as n from associado where instituicao_id=$1', [id]);
    if (a!.n) throw new BadRequestException(`${a!.n} associado(s) usam esta instituição. Troque a instituição deles antes.`);
    const r = await this.db.query('select r.nome from rota_instituicao ri join rota r on r.id = ri.rota_id where ri.instituicao_id=$1', [id]);
    if (r.length) throw new BadRequestException(`Esta instituição é atendida por: ${r.map((x) => x.nome).join(', ')}. Tire-a das rotas antes.`);
    try { await this.db.query('delete from instituicao where id=$1', [id]); }
    catch (e) { if ((e as { code?: string }).code === '23503') throw new BadRequestException('Instituição com reservas registradas não pode ser removida.'); throw e; }
    await this.db.auditar(quemId, 'instituicao_removida', 'instituicao', { id, nome: i.nome });
    return { mensagem: 'Instituição removida.' };
  }

  // ---------- rotas ----------
  private async validarRota(d: RotaDto) {
    const paradas = d.paradas.map((p) => p.trim()).filter(Boolean);
    if (!paradas.length) throw new BadRequestException('Informe ao menos uma parada.');
    if (new Set(paradas.map((p) => p.toLowerCase())).size !== paradas.length) throw new BadRequestException('Há paradas repetidas na rota.');
    const ok = await this.db.um('select count(*)::int as n from instituicao where id = any($1::int[])', [d.instituicoes]);
    if (ok!.n !== d.instituicoes.length) throw new BadRequestException('Instituição inválida.');
    return paradas;
  }
  private async gravarRota(c: PoolClient, id: number, paradas: string[], instituicoes: number[]) {
    await c.query('delete from rota_parada where rota_id=$1', [id]);
    await c.query('delete from rota_instituicao where rota_id=$1', [id]);
    for (const [i, p] of paradas.entries()) await c.query('insert into rota_parada(rota_id, ordem, nome) values($1,$2,$3)', [id, i + 1, p]);
    for (const inst of instituicoes) await c.query('insert into rota_instituicao(rota_id, instituicao_id) values($1,$2)', [id, inst]);
  }
  /** Depois de mudar uma rota: associados cuja instituição ou ponto deixou de existir nela são ajustados. */
  private async reconciliar(c: PoolClient, rotaId: number) {
    const a = await c.query(`
      update associado a set
        rota_id = (select ri.rota_id from rota_instituicao ri where ri.instituicao_id = a.instituicao_id and ri.rota_id <> $1 order by ri.rota_id limit 1),
        ponto_embarque = null
      where a.rota_id = $1 and not exists (select 1 from rota_instituicao x where x.rota_id = $1 and x.instituicao_id = a.instituicao_id)`, [rotaId]);
    const b = await c.query(`
      update associado set ponto_embarque = null
      where rota_id = $1 and ponto_embarque is not null and ponto_embarque not in (select nome from rota_parada where rota_id = $1)`, [rotaId]);
    return (a.rowCount ?? 0) + (b.rowCount ?? 0);
  }

  async criarRota(d: RotaDto, quemId: number) {
    const paradas = await this.validarRota(d);
    const id = await this.db.tx(async (c) => {
      const r = (await c.query('insert into rota(nome, descricao) values($1,$2) returning id', [d.nome.trim(), d.descricao?.trim() || null])).rows[0];
      await this.gravarRota(c, r.id, paradas, d.instituicoes);
      return r.id as number;
    });
    await this.db.auditar(quemId, 'rota_criada', 'rota', { id, nome: d.nome.trim(), paradas, instituicoes: d.instituicoes });
    return { id, mensagem: 'Rota criada.' };
  }
  async atualizarRota(id: number, d: RotaDto, quemId: number) {
    if (!(await this.db.um('select 1 from rota where id=$1', [id]))) throw new NotFoundException('Rota não encontrada.');
    const paradas = await this.validarRota(d);
    const ajustados = await this.db.tx(async (c) => {
      await c.query('update rota set nome=$2, descricao=$3 where id=$1', [id, d.nome.trim(), d.descricao?.trim() || null]);
      await this.gravarRota(c, id, paradas, d.instituicoes);
      return this.reconciliar(c, id);
    });
    await this.db.auditar(quemId, 'rota_alterada', 'rota', { id, paradas, instituicoes: d.instituicoes, associadosAjustados: ajustados });
    return { mensagem: ajustados ? `Rota atualizada. ${ajustados} associado(s) tiveram rota ou ponto de embarque ajustados; confira em Associados.` : 'Rota atualizada.' };
  }
  async removerRota(id: number, quemId: number) {
    const r = await this.db.um('select nome from rota where id=$1', [id]);
    if (!r) throw new NotFoundException('Rota não encontrada.');
    const v = await this.db.um('select count(*)::int as n from veiculo where rota_id=$1', [id]);
    if (v!.n) throw new BadRequestException(`Há ${v!.n} veículo(s) nesta rota. Mude-os de rota antes.`);
    const a = await this.db.um('select count(*)::int as n from associado where rota_id=$1', [id]);
    if (a!.n) throw new BadRequestException(`${a!.n} associado(s) usam esta rota. Edite a rota deles antes.`);
    try { await this.db.query('delete from rota where id=$1', [id]); }
    catch (e) { if ((e as { code?: string }).code === '23503') throw new BadRequestException('Rota com viagens registradas não pode ser removida.'); throw e; }
    await this.db.auditar(quemId, 'rota_removida', 'rota', { id, nome: r.nome });
    return { mensagem: 'Rota removida.' };
  }

  // ---------- veículos ----------
  private async capacidadeRota(rotaId: number, excluirVeiculo: number) {
    return (await this.db.um('select coalesce(sum(capacidade), 0)::int as c from veiculo where rota_id=$1 and id<>$2', [rotaId, excluirVeiculo]))!.c as number;
  }
  /** Não deixa a capacidade da rota ficar menor que as reservas já feitas em dias futuros. */
  private async garantirCapacidade(rotaId: number | null, capacidade: number) {
    if (!rotaId) return;
    const r = await this.db.um(`
      select coalesce(max(n), 0)::int as pico from (
        select count(*) as n from reserva r join viagem v on v.id = r.viagem_id
        where v.rota_id = $1 and v.data >= current_date and r.status in ('confirmada','embarcou') group by v.id) t`, [rotaId]);
    if (r!.pico > capacidade) throw new BadRequestException(`Há dias futuros com ${r!.pico} reservas nessa rota e a capacidade restante seria ${capacidade}. Ajuste as reservas antes.`);
  }
  private async validarVeiculo(d: VeiculoDto, id?: number) {
    if (d.rotaId && !(await this.db.um('select 1 from rota where id=$1', [d.rotaId]))) throw new BadRequestException('Rota inválida.');
    if (d.motoristaId) {
      if (!(await this.db.um("select 1 from usuario where id=$1 and perfil='motorista'", [d.motoristaId]))) throw new BadRequestException('Motorista inválido.');
      if (await this.db.um('select 1 from veiculo where motorista_usuario_id=$1 and id<>$2', [d.motoristaId, id ?? 0])) throw new ConflictException('Esse motorista já está em outro veículo.');
    }
  }
  private erroVeiculo(e: unknown): never {
    const x = e as { code?: string; constraint?: string };
    if (x.code === '23505') throw new ConflictException(x.constraint?.includes('placa') ? 'Já existe um veículo com essa placa.' : 'Esse motorista já está em outro veículo.');
    throw e;
  }

  async criarVeiculo(d: VeiculoDto, quemId: number) {
    await this.validarVeiculo(d);
    try {
      const v = await this.db.um('insert into veiculo(nome, placa, capacidade, rota_id, motorista_usuario_id) values($1,$2,$3,$4,$5) returning id',
        [d.nome.trim(), normalizarPlaca(d.placa), d.capacidade, d.rotaId ?? null, d.motoristaId ?? null]);
      await this.db.auditar(quemId, 'veiculo_criado', 'veiculo', { id: v!.id, nome: d.nome.trim(), placa: normalizarPlaca(d.placa) });
      return { id: v!.id, mensagem: 'Veículo criado.' };
    } catch (e) { this.erroVeiculo(e); }
  }
  async atualizarVeiculo(id: number, d: VeiculoDto, quemId: number) {
    const v = await this.db.um('select * from veiculo where id=$1', [id]);
    if (!v) throw new NotFoundException('Veículo não encontrado.');
    await this.validarVeiculo(d, id);
    const rotaNova = d.rotaId ?? null;
    if (v.rota_id && (v.rota_id !== rotaNova || d.capacidade < v.capacidade)) {
      const restante = (await this.capacidadeRota(v.rota_id, id)) + (v.rota_id === rotaNova ? d.capacidade : 0);
      await this.garantirCapacidade(v.rota_id, restante);
    }
    try {
      await this.db.query('update veiculo set nome=$2, placa=$3, capacidade=$4, rota_id=$5, motorista_usuario_id=$6 where id=$1',
        [id, d.nome.trim(), normalizarPlaca(d.placa), d.capacidade, rotaNova, d.motoristaId ?? null]);
    } catch (e) { this.erroVeiculo(e); }
    await this.db.auditar(quemId, 'veiculo_alterado', 'veiculo', { id, rotaAntes: v.rota_id, rotaDepois: rotaNova, capacidadeAntes: v.capacidade, capacidadeDepois: d.capacidade });
    return { mensagem: 'Veículo atualizado.' };
  }
  async removerVeiculo(id: number, quemId: number) {
    const v = await this.db.um('select * from veiculo where id=$1', [id]);
    if (!v) throw new NotFoundException('Veículo não encontrado.');
    if (v.rota_id) await this.garantirCapacidade(v.rota_id, await this.capacidadeRota(v.rota_id, id));
    await this.db.query('delete from veiculo where id=$1', [id]);
    await this.db.auditar(quemId, 'veiculo_removido', 'veiculo', { id, nome: v.nome, placa: v.placa });
    return { mensagem: 'Veículo removido.' };
  }

  // ---------- motoristas ----------
  /** Motorista não é associado: a conta nasce sem senha (inativa) e a pessoa cria a senha pelo link do convite. */
  private async conviteMotorista(c: PoolClient, usuarioId: number) {
    const token = novoToken();
    await c.query("update token_usuario set usado_em=now() where usuario_id=$1 and tipo='convite' and usado_em is null", [usuarioId]);
    await c.query("insert into token_usuario(tipo, usuario_id, token_hash, expira_em, dados) values('convite',$1,$2, now() + interval '7 days','{\"motorista\":true}')", [usuarioId, hashToken(token)]);
    return token;
  }
  private enviarConviteMotorista(nome: string, email: string, token: string) {
    const url = `${process.env.APP_URL ?? 'http://localhost:5173'}/concluir-cadastro?token=${token}`;
    return this.mail.enviar(email, 'Ridely: convite para motorista', 'Você foi convidado(a)', [
      `Olá, ${nome}! A associação convidou você para usar o Ridely como motorista, para ver a lista de passageiros e marcar embarques.`,
      'Use o botão abaixo para criar sua senha. O convite vale por 7 dias.'], { texto: 'Concluir cadastro', url });
  }
  async convidarMotorista(d: MotoristaConviteDto, quemId: number) {
    const email = d.email.toLowerCase().trim();
    if (await this.db.um('select 1 from usuario where email=$1', [email])) throw new ConflictException('Já existe uma conta com este e-mail.');
    let token = '';
    try {
      await this.db.tx(async (c) => {
        const u = (await c.query("insert into usuario(nome, email, senha_hash, perfil, ativo) values($1,$2,'pendente','motorista',false) returning id", [d.nome.trim(), email])).rows[0];
        token = await this.conviteMotorista(c, u.id);
      });
    } catch (e) { tratarUnico(e, 'Já existe uma conta com este e-mail.'); }
    await this.db.auditar(quemId, 'motorista_convidado', 'usuario', { email });
    void this.enviarConviteMotorista(d.nome.trim(), email, token);
    return { mensagem: `Convite enviado para ${email}.` };
  }
  async reenviarConviteMotorista(id: number) {
    const u = await this.db.um("select id, nome, email from usuario where id=$1 and perfil='motorista' and senha_hash='pendente'", [id]);
    if (!u) throw new NotFoundException('Convite não encontrado.');
    const token = await this.db.tx((c) => this.conviteMotorista(c, id));
    void this.enviarConviteMotorista(u.nome, u.email, token);
    return { mensagem: `Convite reenviado para ${u.email}.` };
  }
}
