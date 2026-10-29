import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow, types } from 'pg';

// colunas `date` chegam como texto 'AAAA-MM-DD' (sem fuso), nunca como Date
types.setTypeParser(1082, (v: string) => v);

@Injectable()
export class DbService implements OnModuleDestroy {
  readonly pool = new Pool({ connectionString: process.env.DATABASE_URL });

  async query<T extends QueryResultRow = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.pool.query<T>(sql, params)).rows;
  }
  async um<T extends QueryResultRow = any>(sql: string, params: unknown[] = []): Promise<T | null> {
    return (await this.query<T>(sql, params))[0] ?? null;
  }
  /** Transação: tudo é gravado junto ou nada é gravado. */
  async tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const r = await fn(c);
      await c.query('COMMIT');
      return r;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  async auditar(usuarioId: number | null, acao: string, entidade?: string, detalhes?: object) {
    try {
      await this.query('insert into auditoria(usuario_id, acao, entidade, detalhes) values($1,$2,$3,$4)',
        [usuarioId, acao, entidade ?? null, detalhes ? JSON.stringify(detalhes) : null]);
    } catch (e) {
      new Logger('Auditoria').error((e as Error).message);
    }
  }
  onModuleDestroy() { return this.pool.end(); }
}
