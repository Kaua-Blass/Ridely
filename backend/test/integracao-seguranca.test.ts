/**
 * Teste de integração da segurança de transporte: cabeçalho Set-Cookie do login e cabeçalhos HTTP.
 * Apaga e recria o schema do banco apontado (nome deve terminar em "_test").
 *   DATABASE_URL=postgres://ridely:ridely@localhost:5432/ridely_test npm run test:integracao:seguranca
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

const url = process.env.DATABASE_URL ?? '';
if (!/_test$/.test(new URL(url || 'postgres://x/x').pathname.slice(1))) {
  console.error('Defina DATABASE_URL apontando para um banco cujo nome termine em _test.'); process.exit(2);
}
process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';
process.env.CPF_CHAVE = randomBytes(32).toString('base64');
process.env.ROTINAS_AUTOMATICAS = 'false';
delete process.env.SMTP_URL;
const SENHA = 'Senha-de-teste-1';

async function main() {
  const pg = new Client({ connectionString: url }); await pg.connect();
  await pg.query('drop schema public cascade; create schema public;');
  await pg.query(readFileSync(join(__dirname, '../../database/schema.sql'), 'utf8'));
  const { hashSenha } = await import('../src/common/password');
  const hash = await hashSenha(SENHA);
  await pg.query("insert into usuario(nome,email,senha_hash,perfil) values('Paula','paula@teste.com',$1,'presidente')", [hash]);

  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../src/app.module');
  const { configurarApp } = await import('../src/configurar-app');
  const app = await NestFactory.create(AppModule, { logger: false });
  configurarApp(app); await app.listen(0);
  const base = `http://127.0.0.1:${(app.getHttpServer().address() as any).port}`;

  const login = async (appUrl: string, cookieSeguro?: string) => {
    process.env.APP_URL = appUrl;
    if (cookieSeguro === undefined) delete process.env.COOKIE_SEGURO; else process.env.COOKIE_SEGURO = cookieSeguro;
    return fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'paula@teste.com', senha: SENHA }) });
  };

  const casos: [string, () => Promise<void>][] = [
    ['login em endereço https emite cookie com Secure', async () => {
      const r = await login('https://ridely.exemplo.org');
      assert.equal(r.status, 200);
      assert.match(r.headers.get('set-cookie') ?? '', /ridely_token=[^;]+;.*Secure/i);
    }],
    ['login em endereço http (desenvolvimento) emite cookie sem Secure', async () => {
      const r = await login('http://localhost:5173');
      assert.equal(r.status, 200);
      assert.doesNotMatch(r.headers.get('set-cookie') ?? '', /Secure/i);
    }],
    ['COOKIE_SEGURO=true força Secure mesmo em http', async () => {
      const r = await login('http://localhost:5173', 'true');
      assert.match(r.headers.get('set-cookie') ?? '', /Secure/i);
    }],
    ['cookie sempre HttpOnly e SameSite=Lax', async () => {
      const r = await login('https://ridely.exemplo.org');
      const c = r.headers.get('set-cookie') ?? '';
      assert.match(c, /HttpOnly/i); assert.match(c, /SameSite=Lax/i);
    }],
    ['respostas trazem cabeçalhos de segurança e não revelam o servidor', async () => {
      const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      assert.equal(r.headers.get('x-powered-by'), null);
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(r.headers.get('x-frame-options'), 'SAMEORIGIN');
      assert.match(r.headers.get('content-security-policy') ?? '', /default-src 'self'/);
      assert.match(r.headers.get('strict-transport-security') ?? '', /max-age=/);
    }],
    ['o cookie emitido autentica as requisições seguintes', async () => {
      const r = await login('http://localhost:5173');
      const cookie = (r.headers.get('set-cookie') ?? '').split(';')[0];
      const eu = await fetch(`${base}/api/auth/me`, { headers: { cookie } });
      assert.equal(eu.status, 200);
      assert.equal((await eu.json()).email, 'paula@teste.com');
    }],
  ];

  let falhas = 0;
  for (const [nome, fn] of casos) {
    try { await fn(); console.log('ok  -', nome); }
    catch (e) { falhas++; console.log('ERRO -', nome, '\n      ', (e as Error).message.split('\n').slice(0, 3).join('\n       ')); }
  }
  await app.close(); await pg.end();
  console.log(`\n${casos.length - falhas}/${casos.length} casos aprovados${falhas ? `, ${falhas} com erro` : ''}`);
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
