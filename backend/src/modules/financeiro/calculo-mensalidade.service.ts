import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { arred } from '../../common/caixa';
import { hoje } from '../../common/datas';
import { DbService } from '../../common/db.service';
import { mensalidadeProporcional, versoes } from '../contratos/calculo';

/** Marca as mensalidades canceladas pelo sistema (e que o sistema pode reativar). */
export const AUTO = 'auto: ';

/** Valor das mensalidades a partir dos contratos. Usado ao gerar e quando um contrato muda. */
@Injectable()
export class CalculoMensalidadeService {
  constructor(private readonly db: DbService) {}

  /** Soma, para o mês, tudo que os contratos do associado valem (cada um proporcional aos seus dias). */
  async valorDoMes(q: Pool | PoolClient, associadoId: number, referencia: string): Promise<{ total: number; contratoId: number | null }> {
    const [ano, mes] = referencia.split('-').map(Number);
    const inicioMes = `${referencia}-01`;
    const fimMes = `${referencia}-${String(new Date(Date.UTC(ano, mes, 0)).getUTCDate()).padStart(2, '0')}`;
    const cs = (await q.query('select id, inicio, fim, dias_semana, valor_por_dia from contrato where associado_id=$1 and inicio <= $3 and fim >= $2 order by inicio', [associadoId, inicioMes, fimMes])).rows;
    if (!cs.length) return { total: 0, contratoId: null };
    const ads = (await q.query('select contrato_id, vigencia_a_partir, novos_dias, novo_valor_por_dia from aditivo where contrato_id = any($1::int[]) order by vigencia_a_partir, id', [cs.map((c) => c.id)])).rows;
    let total = 0;
    for (const c of cs) total += mensalidadeProporcional(referencia, c.inicio, c.fim, versoes(c, ads.filter((a) => a.contrato_id === c.id))).total;
    return { total: arred(total), contratoId: cs[cs.length - 1].id };
  }

  /**
   * Depois de uma mudança de contrato: refaz o valor das mensalidades em aberto do mês atual em diante.
   * Mensalidade já paga não muda. Se o mês deixou de ter valor, a mensalidade é cancelada (e volta se o contrato voltar a cobrir o mês).
   */
  async recalcularAbertas(q: Pool | PoolClient, associadoId: number): Promise<number> {
    const abertas = (await q.query(
      `select m.id, m.referencia, m.valor, m.cancelada_em from mensalidade m
       where m.associado_id = $1 and m.referencia >= $2 and (m.cancelada_em is null or m.cancelada_motivo like $3)
         and not exists (select 1 from pagamento p where p.mensalidade_id = m.id and p.estornado_em is null)`,
      [associadoId, hoje().slice(0, 7), `${AUTO}%`])).rows;
    let mudou = 0;
    for (const m of abertas) {
      const { total, contratoId } = await this.valorDoMes(q, associadoId, m.referencia);
      if (total <= 0 && !m.cancelada_em) {
        await q.query('update mensalidade set cancelada_em = now(), cancelada_motivo = $2 where id = $1', [m.id, `${AUTO}contrato encerrado ou reduzido: sem valor neste mês`]);
        mudou++;
      } else if (total > 0 && (m.cancelada_em || arred(Number(m.valor)) !== total)) {
        await q.query('update mensalidade set valor = $2, contrato_id = $3, cancelada_em = null, cancelada_motivo = null where id = $1', [m.id, total, contratoId]);
        mudou++;
      }
    }
    return mudou;
  }
}
