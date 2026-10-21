import 'dotenv/config';
import { Pool } from 'pg';
import { hashSenha } from './common/password';

/** Cria o presidente inicial, instituições, rotas e contas de exemplo. Pode rodar mais de uma vez. */
async function main() {
  const { SEED_PRESIDENTE_NOME: nome, SEED_PRESIDENTE_EMAIL: email, SEED_PRESIDENTE_SENHA: senha } = process.env;
  if (!email || !senha || senha.length < 8) throw new Error('Preencha SEED_PRESIDENTE_EMAIL e SEED_PRESIDENTE_SENHA (mínimo 8 caracteres) no .env');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = (s: string, p: unknown[] = []) => pool.query(s, p);

  for (const n of ['E.M. Rui Barbosa', 'E.E. Padre Réus']) await q('insert into instituicao(nome) values($1) on conflict do nothing', [n]);
  if (!(await q('select 1 from rota')).rowCount) {
    const inst = async (n: string) => (await q('select id from instituicao where nome=$1', [n])).rows[0].id;
    const r1 = (await q("insert into rota(nome, descricao) values('Rota 1 · direta','Para somente na última parada.') returning id")).rows[0].id;
    const r2 = (await q("insert into rota(nome, descricao) values('Rota 2 · com paradas','Passa por todas as paradas.') returning id")).rows[0].id;
    await q("insert into rota_parada(rota_id, ordem, nome) values($1,1,'Escola Rui Barbosa')", [r1]);
    ['Praça Central', 'Av. Brasil', 'Escola Rui Barbosa'].forEach(async () => {});
    for (const [i, p] of ['Praça Central', 'Av. Brasil', 'Escola Rui Barbosa'].entries()) await q('insert into rota_parada(rota_id, ordem, nome) values($1,$2,$3)', [r2, i + 1, p]);
    await q('insert into rota_instituicao values($1,$2)', [r1, await inst('E.M. Rui Barbosa')]);
    await q('insert into rota_instituicao values($1,$2)', [r2, await inst('E.M. Rui Barbosa')]);
    await q('insert into rota_instituicao values($1,$2)', [r2, await inst('E.E. Padre Réus')]);
  }
  if (!(await q('select 1 from conta_financeira')).rowCount) {
    await q("insert into conta_financeira(nome, tipo, saldo_inicial) values('Caixa','caixa',0)");
    await q("insert into conta_financeira(nome, tipo, banco, saldo_inicial) values('Banco principal','banco','a definir',0)");
  }
  if ((await q('select 1 from usuario where email=$1', [email.toLowerCase()])).rowCount) {
    console.log('Presidente já existe. Nada a fazer.');
  } else {
    const a = (await q("insert into associado(nome, email, cargo, situacao) values($1,$2,'presidente','ativo') returning id", [nome ?? 'Presidente', email.toLowerCase()])).rows[0];
    await q("insert into usuario(associado_id, nome, email, senha_hash, perfil, ativo, email_verificado_em) values($1,$2,$3,$4,'presidente',true,now())",
      [a.id, nome ?? 'Presidente', email.toLowerCase(), await hashSenha(senha)]);
    console.log(`Presidente criado: ${email}`);
  }
  await pool.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
