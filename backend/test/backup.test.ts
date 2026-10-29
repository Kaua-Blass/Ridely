/**
 * Teste do backup e da restauração: gera dados e um upload, faz o backup, restaura num banco novo e compara.
 * Usa os bancos ridely_backup_test e ridely_restore_test (recriados a cada execução).
 *   DATABASE_URL=postgres://ridely:ridely@localhost:5432/ridely_test npm run test:backup
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';

const base = process.env.DATABASE_URL ?? '';
if (!base) { console.error('Defina DATABASE_URL (usuário com permissão para criar bancos).'); process.exit(2); }
const url = (db: string) => base.replace(/\/[^/?]+(\?|$)/, `/${db}$1`);
const ORIGEM = 'ridely_backup_test', DESTINO = 'ridely_restore_test';
process.env.CPF_CHAVE = randomBytes(32).toString('base64');
const BACKEND = join(__dirname, '..');

/** Executa comandos de administração um a um (DROP/CREATE DATABASE não podem ir juntos numa transação). */
async function admin(sql: string) {
  const c = new Client({ connectionString: url('postgres') }); await c.connect();
  try { for (const cmd of sql.split(';').map((x) => x.trim()).filter(Boolean)) await c.query(cmd); } finally { await c.end(); }
}
const rodar = (script: string, args: string[], env: Record<string, string>) =>
  execFileSync('bash', [join(BACKEND, script), ...args], { cwd: BACKEND, env: { ...process.env, ...env }, stdio: 'pipe' }).toString();
const falha = (fn: () => void): boolean => { try { fn(); return false; } catch { return true; } };

async function main() {
  const tmp = mkdtempSync(join(tmpdir(), 'ridely-bk-'));
  const uploadsOrigem = join(tmp, 'uploads-origem'), backups = join(tmp, 'backups'), uploadsDestino = join(tmp, 'uploads-destino');
  mkdirSync(join(uploadsOrigem, 'fotos'), { recursive: true });
  writeFileSync(join(uploadsOrigem, 'fotos', 'foto.jpg'), Buffer.from('conteudo-da-foto-de-teste'));

  // ---------- dados de origem ----------
  await admin(`drop database if exists ${ORIGEM} with (force); create database ${ORIGEM};`);
  const o = new Client({ connectionString: url(ORIGEM) }); await o.connect();
  const { readFileSync: rf } = await import('node:fs');
  await o.query(rf(join(BACKEND, '../database/schema.sql'), 'utf8'));
  const { cifrarCpf, buscaCpf } = await import('../src/common/cpf');
  await o.query("insert into usuario(nome,email,senha_hash,perfil) values('Paula','paula@teste.com','x','presidente')");
  await o.query("insert into instituicao(nome) values('Escola Central')");
  await o.query("insert into associado(nome,email,situacao,cargo,cpf_cifrado,cpf_busca) values('Ana','ana@teste.com','ativo','associado',$1,$2)", [cifrarCpf('12345678909'), buscaCpf('12345678909')]);
  await o.query("insert into conta_financeira(nome,tipo,saldo_inicial) values('Caixa','caixa',500)");
  const contagemOrigem = async (c: Client) => (await c.query(`
    select (select count(*) from associado)::int a, (select count(*) from usuario)::int u,
           (select count(*) from instituicao)::int i, (select count(*) from conta_financeira)::int c`)).rows[0];
  const antes = await contagemOrigem(o);
  const cpfOrigem = (await o.query('select cpf_cifrado from associado')).rows[0].cpf_cifrado;
  await o.end();

  const casos: [string, () => void | Promise<void>][] = [];
  const caso = (n: string, f: () => void | Promise<void>) => casos.push([n, f]);

  caso('o backup gera o banco, os uploads e o arquivo de checksums', () => {
    rodar('scripts/backup.sh', [], { DATABASE_URL: url(ORIGEM), UPLOAD_DIR: uploadsOrigem, BACKUP_DIR: backups });
    const arquivos = readdirSync(backups);
    assert.ok(arquivos.some((a) => /^ridely-\d{8}-\d{6}\.dump$/.test(a)), 'falta o .dump');
    assert.ok(arquivos.some((a) => /-uploads\.tar\.gz$/.test(a)), 'falta o tar dos uploads');
    assert.ok(arquivos.some((a) => a.endsWith('.sha256')), 'falta o .sha256');
  });
  let dump = '';
  caso('o checksum confere com os arquivos gerados', () => {
    dump = join(backups, readdirSync(backups).find((a) => a.endsWith('.dump'))!);
    const sha = readdirSync(backups).find((a) => a.endsWith('.sha256'))!;
    execFileSync('sha256sum', ['-c', sha], { cwd: backups, stdio: 'pipe' }); // lança erro se algum arquivo não bater
  });
  caso('a restauração não roda sem confirmação explícita', () => {
    assert.ok(falha(() => rodar('scripts/restaura.sh', [dump], { DATABASE_URL: url(DESTINO) })));
  });
  caso('restaura num banco novo e os dados batem com a origem', async () => {
    await admin(`drop database if exists ${DESTINO} with (force); create database ${DESTINO};`);
    rodar('scripts/restaura.sh', [dump], { CONFIRMAR_RESTAURACAO: 'sim', DATABASE_URL: url(DESTINO), UPLOAD_DIR: uploadsDestino });
    const d = new Client({ connectionString: url(DESTINO) }); await d.connect();
    assert.deepEqual(await contagemOrigem(d), antes);
    assert.equal((await d.query('select cpf_cifrado from associado')).rows[0].cpf_cifrado, cpfOrigem, 'CPF cifrado deve chegar intacto');
    await d.end();
  });
  caso('o CPF restaurado continua legível com a mesma chave', async () => {
    const { decifrarCpf } = await import('../src/common/cpf');
    const d = new Client({ connectionString: url(DESTINO) }); await d.connect();
    const v = (await d.query('select cpf_cifrado from associado')).rows[0].cpf_cifrado;
    await d.end();
    assert.equal(decifrarCpf(v), '12345678909');
  });
  caso('os uploads voltam para a pasta de destino com o mesmo conteúdo', () => {
    assert.equal(readFileSync(join(uploadsDestino, 'fotos', 'foto.jpg'), 'utf8'), 'conteudo-da-foto-de-teste');
  });
  caso('backup adulterado é recusado antes de qualquer restauração', async () => {
    const copia = join(tmp, 'adulterado.dump');
    writeFileSync(copia, readFileSync(dump));
    writeFileSync(copia, Buffer.concat([readFileSync(copia), Buffer.from('lixo')]));
    writeFileSync(copia + '.sha256', readFileSync(join(backups, readdirSync(backups).find((a) => a.endsWith('.sha256'))!)).toString().replace(/^(\w+)\s+\S+\.dump$/m, (_, h) => `${h}  adulterado.dump`));
    await admin(`drop database if exists ${DESTINO}_b with (force); create database ${DESTINO}_b;`);
    let saida = '';
    try { rodar('scripts/restaura.sh', [copia], { CONFIRMAR_RESTAURACAO: 'sim', DATABASE_URL: url(DESTINO + '_b') }); }
    catch (e: any) { saida = `${e.stdout ?? ''}${e.stderr ?? ''}`; }
    assert.match(saida, /FAILED|FALHOU|FALHA/i, 'a recusa deve vir da verificação de checksum');
    const c = new Client({ connectionString: url(DESTINO + '_b') }); await c.connect();
    assert.equal((await c.query("select count(*)::int n from information_schema.tables where table_schema='public'")).rows[0].n, 0, 'nada deve ter sido restaurado');
    await c.end();
    await admin(`drop database ${DESTINO}_b with (force)`);
  });
  caso('retenção: backups mais antigos que o prazo são removidos, os recentes ficam', () => {
    const velho = join(backups, 'ridely-20200101-000000.dump');
    writeFileSync(velho, 'antigo');
    const trintaDias = new Date(Date.now() - 30 * 86400_000);
    utimesSync(velho, trintaDias, trintaDias);
    rodar('scripts/backup.sh', [], { DATABASE_URL: url(ORIGEM), UPLOAD_DIR: uploadsOrigem, BACKUP_DIR: backups, BACKUP_RETENCAO_DIAS: '14' });
    assert.equal(existsSync(velho), false, 'o backup de 30 dias deveria ter sido apagado');
    assert.ok(readdirSync(backups).some((a) => a.endsWith('.dump') && a !== 'ridely-20200101-000000.dump'), 'o backup recente deve continuar');
  });

  let falhas = 0;
  for (const [n, f] of casos) {
    try { await f(); console.log('ok  -', n); }
    catch (e) { falhas++; console.log('ERRO -', n, '\n      ', (e as Error).message.split('\n').slice(0, 3).join('\n       ')); }
  }
  await admin(`drop database if exists ${ORIGEM} with (force); drop database if exists ${DESTINO} with (force);`);
  console.log(`\n${casos.length - falhas}/${casos.length} casos aprovados${falhas ? `, ${falhas} com erro` : ''}`);
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
