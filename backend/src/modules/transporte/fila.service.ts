import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { hoje } from '../../common/datas';
import { DbService } from '../../common/db.service';
import { MailService } from '../../common/mail.service';

export interface Promovido { reservaId: number; associadoId: number }
const OCUPAM = "('confirmada','embarcou','faltou')"; // estados que ocupam um lugar no veículo

/** Distribui os passageiros entre os veículos da rota e faz a lista de espera andar. */
@Injectable()
export class FilaService {
  constructor(private readonly db: DbService, private readonly mail: MailService) {}

  /** Primeiro veículo da rota com lugar livre na viagem (ou null se estiver tudo cheio). */
  async veiculoComVaga(c: PoolClient, viagemId: number, rotaId: number): Promise<{ id: number; nome: string } | null> {
    const r = await c.query(
      `select v.id, v.nome from veiculo v where v.rota_id = $2
         and (select count(*) from reserva r where r.viagem_id = $1 and r.veiculo_id = v.id and r.status in ${OCUPAM}) < v.capacidade
       order by v.id limit 1`, [viagemId, rotaId]);
    return r.rows[0] ?? null;
  }

  /**
   * Deixa a viagem consistente: quem está sem veículo (ou num veículo que saiu da rota ou encolheu) recebe lugar em outro,
   * e a lista de espera é promovida, na ordem de chegada, enquanto houver lugar. Chamar com a viagem travada.
   */
  async reorganizar(c: PoolClient, viagemId: number): Promise<Promovido[]> {
    const v = (await c.query('select id, rota_id from viagem where id=$1', [viagemId])).rows[0];
    if (!v) return [];
    const veics: { id: number; capacidade: number }[] = (await c.query('select id, capacidade from veiculo where rota_id=$1 order by id', [v.rota_id])).rows;
    const usados = new Map(veics.map((x) => [x.id, 0]));
    const cap = new Map(veics.map((x) => [x.id, x.capacidade]));
    const vaga = () => veics.find((x) => usados.get(x.id)! < cap.get(x.id)!);

    const confirmadas = (await c.query(`select id, veiculo_id from reserva where viagem_id=$1 and status in ${OCUPAM} order by criado_em, id`, [viagemId])).rows;
    const soltas: { id: number; veiculo_id: number | null }[] = [];
    for (const r of confirmadas) {
      if (r.veiculo_id != null && usados.has(r.veiculo_id) && usados.get(r.veiculo_id)! < cap.get(r.veiculo_id)!) usados.set(r.veiculo_id, usados.get(r.veiculo_id)! + 1);
      else soltas.push(r);
    }
    for (const r of soltas) {
      const x = vaga();
      if (x) { usados.set(x.id, usados.get(x.id)! + 1); await c.query('update reserva set veiculo_id=$2, atualizado_em=now() where id=$1', [r.id, x.id]); }
      else if (r.veiculo_id != null) await c.query('update reserva set veiculo_id=null, atualizado_em=now() where id=$1', [r.id]);
    }

    const promovidos: Promovido[] = [];
    const fila = (await c.query("select id, associado_id from reserva where viagem_id=$1 and status='espera' order by criado_em, id", [viagemId])).rows;
    for (const f of fila) {
      const x = vaga();
      if (!x) break;
      usados.set(x.id, usados.get(x.id)! + 1);
      await c.query("update reserva set status='confirmada', veiculo_id=$2, atualizado_em=now() where id=$1", [f.id, x.id]);
      await c.query("insert into reserva_evento(reserva_id, de, para, motivo) values($1,'espera','confirmada','Vaga liberada: promovido(a) da lista de espera')", [f.id]);
      promovidos.push({ reservaId: f.id, associadoId: f.associado_id });
    }
    return promovidos;
  }

  /** Avisa por e-mail quem saiu da lista de espera. */
  async avisarPromovidos(promovidos: Promovido[]) {
    for (const p of promovidos) {
      const r = await this.db.um(
        `select u.email, u.nome, r.data, ro.nome as rota, ve.nome as veiculo
         from reserva r join viagem vg on vg.id = r.viagem_id join rota ro on ro.id = vg.rota_id
         join usuario u on u.associado_id = r.associado_id left join veiculo ve on ve.id = r.veiculo_id where r.id = $1`, [p.reservaId]);
      if (!r) continue;
      const dia = String(r.data).split('-').reverse().join('/');
      void this.mail.enviar(r.email, 'Ridely: sua vaga foi confirmada', 'Vaga confirmada', [
        `Olá, ${r.nome}! Uma vaga abriu e a sua reserva do dia ${dia} saiu da lista de espera e está confirmada.`,
        `Rota: ${r.rota}${r.veiculo ? ` · Veículo: ${r.veiculo}` : ''}.`]);
    }
  }

  /** Depois de mudar os veículos de uma rota: reorganiza as viagens de hoje em diante e promove a fila. */
  async promoverRota(rotaId: number | null) {
    if (!rotaId) return;
    const viagens = await this.db.query('select id from viagem where rota_id=$1 and data >= $2', [rotaId, hoje()]);
    const todos: Promovido[] = [];
    for (const { id } of viagens) {
      todos.push(...(await this.db.tx(async (c) => {
        await c.query('select id from viagem where id=$1 for update', [id]);
        return this.reorganizar(c, id);
      })));
    }
    void this.avisarPromovidos(todos);
  }
}
