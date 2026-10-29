import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { dataValida, diaSemana, hoje, minutosAgora, somarDias } from '../../common/datas';
import { DbService } from '../../common/db.service';
import type { UsuarioPublico } from '../../common/usuario';
import { versaoEm, versoes } from '../contratos/calculo';
import { FilaService } from './fila.service';
import { ReservaDto } from './dto/transporte.dto';

/** Quantos dias à frente o associado pode reservar. */
export const MAX_DIAS_ANTECEDENCIA = 30;
const OCUPAM = "('confirmada','embarcou','faltou')";
const EQUIPE = ['presidente', 'vice-presidente', 'auxiliar'];

type Contratado = 'ok' | 'sem_contrato' | 'dia_fora';
const MOTIVO: Record<Exclude<Contratado, 'ok'>, string> = {
  sem_contrato: 'Sem contrato em vigor nesta data.',
  dia_fora: 'Este dia da semana não está no seu contrato.',
};

@Injectable()
export class TransporteService {
  constructor(private readonly db: DbService, private readonly fila: FilaService) {}

  // ---------- apoio ----------
  private async horaLimite() {
    return Number((await this.db.um("select valor from parametro where chave='hora_limite_reserva'"))?.valor ?? 15);
  }
  /** Reservar e cancelar vale até a hora limite do próprio dia da viagem (15:00 por padrão). */
  private prazoAberto(data: string, hora: number) {
    const h = hoje();
    return data > h || (data === h && minutosAgora() < hora * 60);
  }
  private diaUtil(data: string) {
    const w = diaSemana(data);
    return w >= 1 && w <= 5;
  }
  /** Contratos do associado que tocam o período, com os aditivos, para decidir se cada dia está contratado. */
  private async contratos(associadoId: number, de: string, ate: string) {
    const cs = await this.db.query('select id, inicio, fim, dias_semana, valor_por_dia from contrato where associado_id=$1 and inicio <= $3 and fim >= $2 order by inicio', [associadoId, de, ate]);
    const ads = cs.length ? await this.db.query('select contrato_id, vigencia_a_partir, novos_dias, novo_valor_por_dia from aditivo where contrato_id = any($1::int[]) order by vigencia_a_partir, id', [cs.map((c) => c.id)]) : [];
    return { cs, ads };
  }
  private contratado(k: { cs: any[]; ads: any[] }, data: string): Contratado {
    const c = k.cs.find((x) => x.inicio <= data && x.fim >= data);
    if (!c) return 'sem_contrato';
    const v = versaoEm(versoes(c, k.ads.filter((a) => a.contrato_id === c.id)), data);
    return v && v.dias.includes(diaSemana(data)) ? 'ok' : 'dia_fora';
  }
  /** A rota é escolhida pela instituição e pelo ponto de embarque: a primeira rota que atende a instituição e passa por esse ponto. */
  private async rotaPara(instituicaoId: number, ponto: string) {
    return this.db.um(
      `select r.id, r.nome from rota r
       join rota_instituicao ri on ri.rota_id = r.id and ri.instituicao_id = $1
       join rota_parada p on p.rota_id = r.id and p.nome = $2 order by r.id limit 1`, [instituicaoId, ponto]);
  }
  private async capacidade(rotaId: number) {
    return (await this.db.um('select coalesce(sum(capacidade), 0)::int as c from veiculo where rota_id=$1', [rotaId]))!.c as number;
  }

  // ---------- reservar ----------
  async reservar(d: ReservaDto, quem: UsuarioPublico) {
    if (!quem.associadoId) throw new BadRequestException('Sua conta não está ligada a um associado.');
    const a = await this.db.um('select situacao from associado where id=$1', [quem.associadoId]);
    if (a?.situacao !== 'ativo') throw new BadRequestException('Só associados ativos reservam viagens.');
    const h = hoje();
    if (!dataValida(d.data) || !this.diaUtil(d.data)) throw new BadRequestException('Escolha um dia de segunda a sexta.');
    if (d.data < h) throw new BadRequestException('Esse dia já passou.');
    if (d.data > somarDias(h, MAX_DIAS_ANTECEDENCIA)) throw new BadRequestException(`Só é possível reservar até ${MAX_DIAS_ANTECEDENCIA} dias à frente.`);
    const hora = await this.horaLimite();
    if (!this.prazoAberto(d.data, hora)) throw new BadRequestException(`O prazo para reservar esse dia terminou (vai até as ${hora}h do próprio dia).`);
    const k = await this.contratos(quem.associadoId, d.data, d.data);
    const c = this.contratado(k, d.data);
    if (c !== 'ok') throw new BadRequestException(MOTIVO[c]);
    const rota = await this.rotaPara(d.instituicaoId, d.pontoEmbarque);
    if (!rota) throw new BadRequestException('Nenhuma rota atende essa instituição nesse ponto de embarque.');
    const cap = await this.capacidade(rota.id);
    if (!cap) throw new BadRequestException('Ainda não há veículo nessa rota. Fale com a associação.');

    try {
      const r = await this.db.tx(async (c2) => {
        await c2.query('insert into viagem(data, rota_id) values($1,$2) on conflict (data, rota_id) do nothing', [d.data, rota.id]);
        const vg = (await c2.query('select id from viagem where data=$1 and rota_id=$2 for update', [d.data, rota.id])).rows[0]; // uma reserva por vez em cada viagem
        if ((await c2.query("select 1 from reserva where associado_id=$1 and data=$2 and status <> 'cancelada'", [quem.associadoId, d.data])).rowCount) throw new ConflictException('Você já tem reserva nesse dia.');
        const ocupados = (await c2.query(`select count(*)::int as n from reserva where viagem_id=$1 and status in ${OCUPAM}`, [vg.id])).rows[0].n as number;
        const veic = await this.fila.veiculoComVaga(c2, vg.id, rota.id);
        const status = veic && ocupados < cap ? 'confirmada' : 'espera';
        const ins = (await c2.query(
          'insert into reserva(viagem_id, associado_id, instituicao_id, ponto_embarque, status, data, veiculo_id) values($1,$2,$3,$4,$5,$6,$7) returning id',
          [vg.id, quem.associadoId, d.instituicaoId, d.pontoEmbarque, status, d.data, status === 'confirmada' ? veic!.id : null])).rows[0];
        await c2.query('insert into reserva_evento(reserva_id, de, para, por) values($1,null,$2,$3)', [ins.id, status, quem.id]);
        const posicao = status === 'espera' ? (await c2.query("select count(*)::int as n from reserva where viagem_id=$1 and status='espera'", [vg.id])).rows[0].n as number : null;
        return { id: ins.id as number, status, veiculo: status === 'confirmada' ? veic!.nome : null, posicao };
      });
      await this.db.auditar(quem.id, 'reserva_criada', 'reserva', { id: r.id, data: d.data, rota: rota.nome, status: r.status });
      const dia = d.data.split('-').reverse().join('/');
      return {
        ...r, rota: rota.nome,
        mensagem: r.status === 'confirmada' ? `Reserva confirmada para ${dia} · ${rota.nome} · ${r.veiculo}.` : `A viagem de ${dia} está lotada: você entrou na lista de espera (posição ${r.posicao}). Se alguém cancelar, a sua vaga é confirmada automaticamente.`,
      };
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new ConflictException('Você já tem reserva nesse dia.');
      throw e;
    }
  }

  // ---------- cancelar ----------
  /** O associado cancela a própria reserva até a hora limite; a equipe cancela a qualquer hora. Vaga liberada → fila anda. */
  async cancelar(id: number, motivo: string | undefined, quem: UsuarioPublico) {
    const r0 = await this.db.um('select r.id, r.viagem_id, r.associado_id, r.data, r.status from reserva r where r.id=$1', [id]);
    if (!r0) throw new NotFoundException('Reserva não encontrada.');
    const propria = r0.associado_id === quem.associadoId;
    if (!propria && !EQUIPE.includes(quem.perfil)) throw new NotFoundException('Reserva não encontrada.');
    if (propria && !EQUIPE.includes(quem.perfil) && !this.prazoAberto(r0.data, await this.horaLimite())) {
      throw new BadRequestException(`O prazo para cancelar terminou (até as ${await this.horaLimite()}h do dia da viagem). Fale com a associação.`);
    }
    const promovidos = await this.db.tx(async (c) => {
      await c.query('select id from viagem where id=$1 for update', [r0.viagem_id]);
      const r = (await c.query('select id, status from reserva where id=$1 for update', [id])).rows[0];
      if (r.status !== 'confirmada' && r.status !== 'espera') throw new BadRequestException(r.status === 'cancelada' ? 'Esta reserva já foi cancelada.' : 'Esta viagem já aconteceu e não pode ser cancelada.');
      await c.query("update reserva set status='cancelada', cancelada_em=now(), cancelada_por=$2, veiculo_id=null, atualizado_em=now() where id=$1", [id, quem.id]);
      await c.query("insert into reserva_evento(reserva_id, de, para, por, motivo) values($1,$2,'cancelada',$3,$4)", [id, r.status, quem.id, motivo?.trim() || null]);
      return r.status === 'confirmada' ? this.fila.reorganizar(c, r0.viagem_id) : []; // só libera lugar quem estava confirmado
    });
    await this.db.auditar(quem.id, 'reserva_cancelada', 'reserva', { id, data: r0.data, promovidos: promovidos.length });
    void this.fila.avisarPromovidos(promovidos);
    return {
      mensagem: promovidos.length && EQUIPE.includes(quem.perfil) ? 'Reserva cancelada. O primeiro da lista de espera foi confirmado automaticamente.' : 'Reserva cancelada.',
      promovidos: promovidos.length,
    };
  }

  // ---------- motorista e equipe ----------
  private async veiculosDoMotorista(usuarioId: number) {
    return this.db.query('select id, rota_id from veiculo where motorista_usuario_id=$1', [usuarioId]);
  }

  /** Embarcou / não compareceu / desfazer. Só até o dia da viagem; o motorista só mexe nos passageiros do próprio veículo. */
  async marcar(id: number, status: string, quem: UsuarioPublico) {
    const r = await this.db.um('select id, data, status, veiculo_id from reserva where id=$1', [id]);
    if (!r) throw new NotFoundException('Reserva não encontrada.');
    if (quem.perfil === 'motorista') {
      const meus = await this.veiculosDoMotorista(quem.id);
      if (!meus.some((v) => v.id === r.veiculo_id)) throw new ForbiddenException('Este passageiro não está no seu veículo.');
    }
    if (r.data > hoje()) throw new BadRequestException('Só é possível marcar embarque no dia da viagem ou depois.');
    if (!['confirmada', 'embarcou', 'faltou'].includes(r.status)) throw new BadRequestException(r.status === 'espera' ? 'Esse passageiro está na lista de espera.' : 'Reserva cancelada.');
    if (r.status === status) return { mensagem: 'Nada a mudar.' };
    await this.db.tx(async (c) => {
      await c.query('update reserva set status=$2, atualizado_em=now() where id=$1', [id, status]);
      await c.query('insert into reserva_evento(reserva_id, de, para, por) values($1,$2,$3,$4)', [id, r.status, status, quem.id]);
    });
    return { mensagem: status === 'embarcou' ? 'Embarque marcado.' : status === 'faltou' ? 'Falta marcada.' : 'Marcação desfeita.' };
  }

  /** Distribuição manual: leva o passageiro para outro veículo da mesma rota, se houver lugar. */
  async moverVeiculo(id: number, veiculoId: number, quem: UsuarioPublico) {
    await this.db.tx(async (c) => {
      const r0 = (await c.query('select viagem_id from reserva where id=$1', [id])).rows[0];
      if (!r0) throw new NotFoundException('Reserva não encontrada.');
      await c.query('select id from viagem where id=$1 for update', [r0.viagem_id]);
      const r = (await c.query('select r.id, r.status, r.veiculo_id, vg.rota_id from reserva r join viagem vg on vg.id = r.viagem_id where r.id=$1', [id])).rows[0];
      if (!['confirmada', 'embarcou', 'faltou'].includes(r.status)) throw new BadRequestException('Só passageiros confirmados têm veículo.');
      const v = (await c.query('select id, nome, capacidade, rota_id from veiculo where id=$1', [veiculoId])).rows[0];
      if (!v || v.rota_id !== r.rota_id) throw new BadRequestException('Esse veículo não é da rota desta viagem.');
      const n = (await c.query(`select count(*)::int as n from reserva where viagem_id=$1 and veiculo_id=$2 and status in ${OCUPAM} and id <> $3`, [r0.viagem_id, veiculoId, id])).rows[0].n as number;
      if (n >= v.capacidade) throw new BadRequestException(`${v.nome} está lotado.`);
      await c.query('update reserva set veiculo_id=$2, atualizado_em=now() where id=$1', [id, veiculoId]);
      await c.query('insert into reserva_evento(reserva_id, de, para, por, motivo) values($1,$2,$2,$3,$4)', [id, r.status, quem.id, `Movido para ${v.nome}`]);
    });
    await this.db.auditar(quem.id, 'reserva_veiculo_alterado', 'reserva', { id, veiculoId });
    return { mensagem: 'Passageiro movido de veículo.' };
  }

  // ---------- consultas ----------
  /** Lista de passageiros de uma viagem, por veículo e na ordem das paradas. */
  async lista(data: string, rotaId: number | undefined, quem: UsuarioPublico) {
    if (!dataValida(data)) throw new BadRequestException('Data inválida.');
    let rota = rotaId;
    let meus: { id: number; rota_id: number }[] | null = null;
    if (quem.perfil === 'motorista') {
      meus = await this.veiculosDoMotorista(quem.id);
      if (!meus.length) throw new ForbiddenException('Você ainda não foi vinculado a um veículo. Fale com a associação.');
      if (rota == null) rota = meus[0].rota_id;
      if (!meus.some((v) => v.rota_id === rota)) throw new ForbiddenException('Essa rota não é a do seu veículo.');
    }
    const rotas = await this.db.query('select id, nome from rota order by id');
    if (rota == null) rota = rotas[0]?.id;
    const rt = rotas.find((x) => x.id === rota);
    if (!rt) throw new NotFoundException('Rota não encontrada.');

    const veiculos = await this.db.query(
      `select v.id, v.nome, v.placa, v.capacidade, u.nome as motorista from veiculo v left join usuario u on u.id = v.motorista_usuario_id
       where v.rota_id=$1 ${meus ? 'and v.motorista_usuario_id = $2' : ''} order by v.id`, meus ? [rota, quem.id] : [rota]);
    const todos = await this.db.query(
      `select r.id, r.status, r.veiculo_id, r.criado_em, a.nome as associado, i.nome as instituicao, r.ponto_embarque as ponto,
              coalesce(array_position(array(select nome from rota_parada where rota_id = $2 order by ordem), r.ponto_embarque), 999) as ordem_parada
       from reserva r join viagem vg on vg.id = r.viagem_id join associado a on a.id = r.associado_id left join instituicao i on i.id = r.instituicao_id
       where vg.data=$1 and vg.rota_id=$2 and r.status <> 'cancelada' order by ordem_parada, a.nome`, [data, rota]);
    const linha = (r: any) => ({ id: r.id, associado: r.associado, instituicao: r.instituicao, ponto: r.ponto, status: r.status });
    const capacidade = (await this.capacidade(rota!));
    const ocupados = todos.filter((r) => r.status !== 'espera');
    const resp: any = {
      data, rota: { id: rt.id, nome: rt.nome }, rotas: meus ? rotas.filter((x) => meus!.some((v) => v.rota_id === x.id)) : rotas,
      veiculos: veiculos.map((v) => ({ ...v, passageiros: ocupados.filter((r) => r.veiculo_id === v.id).map(linha) })),
    };
    if (!meus) {
      resp.semVeiculo = ocupados.filter((r) => r.veiculo_id == null).map(linha);
      resp.espera = todos.filter((r) => r.status === 'espera').sort((a, b) => +new Date(a.criado_em) - +new Date(b.criado_em)).map(linha);
      resp.capacidade = capacidade;
      resp.confirmadas = ocupados.length;
      resp.canceladas = (await this.db.um("select count(*)::int as n from reserva r join viagem vg on vg.id=r.viagem_id where vg.data=$1 and vg.rota_id=$2 and r.status='cancelada'", [data, rota]))!.n;
    }
    return resp;
  }

  /** Lotação por dia e rota. Alerta: lotada ou com fila de espera (precisa de outro veículo?). */
  async painel(de: string | undefined, ate: string | undefined) {
    const h = hoje();
    const ini = de ?? h, fim = ate ?? somarDias(ini, 13);
    if (!dataValida(ini) || !dataValida(fim) || fim < ini) throw new BadRequestException('Período inválido.');
    const linhas = await this.db.query(
      `select vg.data, vg.rota_id as "rotaId", ro.nome as rota,
              count(*) filter (where re.status in ${OCUPAM})::int as confirmadas, count(*) filter (where re.status = 'espera')::int as espera,
              count(*) filter (where re.status = 'cancelada')::int as canceladas, count(*) filter (where re.status = 'embarcou')::int as embarcaram,
              count(*) filter (where re.status = 'faltou')::int as faltaram
       from viagem vg join rota ro on ro.id = vg.rota_id left join reserva re on re.viagem_id = vg.id
       where vg.data between $1 and $2 group by vg.data, vg.rota_id, ro.nome order by vg.data, vg.rota_id`, [ini, fim]);
    const caps = new Map((await this.db.query('select rota_id, sum(capacidade)::int as c from veiculo where rota_id is not null group by rota_id')).map((x) => [x.rota_id, x.c as number]));
    return linhas.map((l) => {
      const capacidade = caps.get(l.rotaId) ?? 0;
      return { ...l, capacidade, vagas: Math.max(0, capacidade - l.confirmadas), lotada: capacidade > 0 && l.confirmadas >= capacidade, precisaDeVeiculo: l.espera > 0 };
    });
  }

  /** Alertas dos próximos 7 dias para quem decide sobre veículos. */
  async alertas() {
    const h = hoje();
    return (await this.painel(h, somarDias(h, 7))).filter((l) => l.lotada || l.espera > 0)
      .map((l) => ({ data: l.data, rotaId: l.rotaId, rota: l.rota, capacidade: l.capacidade, confirmadas: l.confirmadas, espera: l.espera, tipo: l.espera > 0 ? 'fila' : 'lotada' }));
  }

  /** "Minhas viagens": próximos 15 dias úteis com a situação de cada um, e o histórico recente. */
  async minhas(quem: UsuarioPublico) {
    const hora = await this.horaLimite();
    if (!quem.associadoId) return { horaLimite: hora, padrao: null, dias: [], historico: [] };
    const h = hoje(), fimJanela = somarDias(h, 14);
    const datas: string[] = [];
    for (let i = 0; i <= 14; i++) { const d = somarDias(h, i); if (this.diaUtil(d)) datas.push(d); }
    const pad = await this.db.um('select instituicao_id, ponto_embarque, rota_id from associado where id=$1', [quem.associadoId]);
    const k = await this.contratos(quem.associadoId, h, fimJanela);
    const reservas = await this.db.query(
      `select r.id, r.data, r.status, ro.nome as rota, ve.nome as veiculo,
              case when r.status = 'espera' then (select count(*)::int from reserva e where e.viagem_id = r.viagem_id and e.status = 'espera' and (e.criado_em, e.id) <= (r.criado_em, r.id)) end as posicao
       from reserva r join viagem vg on vg.id = r.viagem_id join rota ro on ro.id = vg.rota_id left join veiculo ve on ve.id = r.veiculo_id
       where r.associado_id=$1 and r.data between $2 and $3 and r.status <> 'cancelada'`, [quem.associadoId, h, fimJanela]);
    const cap = pad?.rota_id ? await this.capacidade(pad.rota_id) : 0;
    const ocup = new Map((pad?.rota_id ? await this.db.query(`select vg.data, count(*)::int as n from reserva r join viagem vg on vg.id = r.viagem_id where vg.rota_id=$1 and vg.data between $2 and $3 and r.status in ${OCUPAM} group by vg.data`, [pad.rota_id, h, fimJanela]) : []).map((x) => [x.data, x.n as number]));
    const dias = datas.map((data) => {
      const c = this.contratado(k, data);
      const res = reservas.find((r) => r.data === data);
      return {
        data, permitido: c === 'ok', motivo: c === 'ok' ? null : MOTIVO[c], prazoAberto: this.prazoAberto(data, hora),
        vagas: pad?.rota_id && cap ? Math.max(0, cap - (ocup.get(data) ?? 0)) : null,
        reserva: res ? { id: res.id, status: res.status, rota: res.rota, veiculo: res.veiculo, posicao: res.posicao } : null,
      };
    });
    const historico = await this.db.query(
      `select r.id, r.data, r.status, ro.nome as rota from reserva r join viagem vg on vg.id = r.viagem_id join rota ro on ro.id = vg.rota_id
       where r.associado_id=$1 and r.data < $2 and r.data >= $3 order by r.data desc`, [quem.associadoId, h, somarDias(h, -60)]);
    return { horaLimite: hora, padrao: { instituicaoId: pad?.instituicao_id ?? null, pontoEmbarque: pad?.ponto_embarque ?? null }, dias, historico };
  }
}
