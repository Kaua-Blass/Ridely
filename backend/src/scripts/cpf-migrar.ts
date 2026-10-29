import 'dotenv/config';
import { Pool } from 'pg';
import { buscaCpf, cifrarCpf, digitos } from '../common/cpf';

export interface ResultadoMigracao { associados: number; pedidos: number }

/** Cifra os CPFs que ainda estão em texto (associados e pedidos de cadastro pendentes) e remove a coluna em texto.
 *  Tudo numa única transação: se algo falhar, nada muda. Pode ser executado de novo sem efeito. */
export async function migrarCpfs(databaseUrl: string): Promise<ResultadoMigracao> {
  const pool = new Pool({ connectionString: databaseUrl });
  const c = await pool.connect();
  try {
    await c.query('begin');
    const colunaExiste = (await c.query(
      "select 1 from information_schema.columns where table_name='associado' and column_name='cpf'")).rowCount! > 0;
    let associados = 0;
    if (colunaExiste) {
      const linhas = (await c.query('select id, cpf from associado where cpf is not null order by id for update')).rows;
      for (const r of linhas) {
        const d = digitos(r.cpf);
        await c.query('update associado set cpf_cifrado = $2, cpf_busca = $3, cpf = null where id = $1', [r.id, cifrarCpf(d), buscaCpf(d)]);
      }
      associados = linhas.length;
      await c.query('alter table associado drop column cpf');
    }
    const pedidos = (await c.query("select id, dados from solicitacao where dados ? 'cpf' for update")).rows;
    for (const p of pedidos) {
      const { cpf, ...resto } = p.dados;
      const novo = cpf ? { ...resto, cpfCifrado: cifrarCpf(digitos(cpf)), cpfBusca: buscaCpf(digitos(cpf)) } : resto;
      await c.query('update solicitacao set dados = $2 where id = $1', [p.id, JSON.stringify(novo)]);
    }
    await c.query('commit');
    return { associados, pedidos: pedidos.length };
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}

// uso: npm run cpf:migrar
if (require.main === module) {
  if (!process.env.DATABASE_URL) { console.error('Defina DATABASE_URL.'); process.exit(1); }
  migrarCpfs(process.env.DATABASE_URL)
    .then((r) => console.log(`CPFs cifrados: ${r.associados} associado(s), ${r.pedidos} pedido(s) de cadastro. Coluna em texto removida.`))
    .catch((e) => { console.error('Falha na migração de CPF (nada foi alterado):', (e as Error).message); process.exit(1); });
}
