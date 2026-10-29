import assert from 'node:assert/strict';
import { randomBytes } from 'crypto';
import { validarConfiguracao } from '../src/common/config';
import { opcoesCookie } from '../src/common/cookie';
import { buscaCpf, cifrarCpf, decifrarCpf, mascararCpf } from '../src/common/cpf';

// uso: npm test   (não precisa de banco)
const caso = (nome: string, fn: () => void) => { fn(); console.log('ok  -', nome); };
const CHAVE = randomBytes(32).toString('base64');
const BASE = { DATABASE_URL: 'x', JWT_SECRET: 'j'.repeat(40), CPF_CHAVE: CHAVE };
process.env.CPF_CHAVE = CHAVE;

// ---------- cookie seguro ----------
const comEnv = (vars: Record<string, string | undefined>, fn: () => void) => {
  const antes = { ...process.env };
  for (const [k, v] of Object.entries(vars)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  try { fn(); } finally { process.env = antes; }
};
caso('cookie é Secure quando o endereço da aplicação é https', () => comEnv({ APP_URL: 'https://ridely.exemplo.org', COOKIE_SEGURO: undefined }, () => {
  assert.equal(opcoesCookie().secure, true);
}));
caso('cookie não é Secure em endereço http (desenvolvimento)', () => comEnv({ APP_URL: 'http://localhost:5173', COOKIE_SEGURO: undefined }, () => {
  assert.equal(opcoesCookie().secure, false);
}));
caso('COOKIE_SEGURO sobrepõe o endereço da aplicação', () => {
  comEnv({ APP_URL: 'http://localhost:5173', COOKIE_SEGURO: 'true' }, () => assert.equal(opcoesCookie().secure, true));
  comEnv({ APP_URL: 'https://ridely.exemplo.org', COOKIE_SEGURO: 'false' }, () => assert.equal(opcoesCookie().secure, false));
});
caso('cookie sempre httpOnly, sameSite lax e validade de 8 horas', () => {
  const o = opcoesCookie();
  assert.equal(o.httpOnly, true); assert.equal(o.sameSite, 'lax'); assert.equal(o.maxAge, 8 * 60 * 60 * 1000);
});

// ---------- validação de configuração na inicialização ----------
caso('configuração completa não gera erros', () => {
  assert.deepEqual(validarConfiguracao({ ...BASE, NODE_ENV: 'production', APP_URL: 'https://ridely.exemplo.org' }), []);
});
caso('produção com APP_URL em http é recusada, a menos que PERMITIR_HTTP=true', () => {
  const e = validarConfiguracao({ ...BASE, NODE_ENV: 'production', APP_URL: 'http://ridely.exemplo.org' });
  assert.ok(e.some((x) => x.includes('https://')));
  assert.deepEqual(validarConfiguracao({ ...BASE, NODE_ENV: 'production', APP_URL: 'http://localhost', PERMITIR_HTTP: 'true' }), []);
});
caso('em desenvolvimento http é aceito', () => {
  assert.deepEqual(validarConfiguracao({ ...BASE, APP_URL: 'http://localhost:5173' }), []);
});
caso('CPF_CHAVE ausente ou com tamanho errado é recusada', () => {
  assert.ok(validarConfiguracao({ DATABASE_URL: 'x', JWT_SECRET: 'j' }).some((x) => x.includes('CPF_CHAVE')));
  assert.ok(validarConfiguracao({ ...BASE, CPF_CHAVE: Buffer.from('curta').toString('base64') }).some((x) => x.includes('32 bytes')));
});
caso('JWT_SECRET curto é recusado em produção', () => {
  assert.ok(validarConfiguracao({ ...BASE, JWT_SECRET: 'curto', NODE_ENV: 'production', APP_URL: 'https://x.org' }).some((x) => x.includes('32 caracteres')));
});
caso('HTTPS direto exige certificado e chave juntos', () => {
  assert.ok(validarConfiguracao({ ...BASE, TLS_CERT_FILE: '/c.pem' }).some((x) => x.includes('TLS_KEY_FILE')));
});

// ---------- cifra do CPF ----------
caso('CPF cifrado volta igual ao original', () => {
  assert.equal(decifrarCpf(cifrarCpf('123.456.789-09')), '12345678909');
});
caso('o mesmo CPF gera textos cifrados diferentes (IV aleatório) e nenhum contém os dígitos', () => {
  const a = cifrarCpf('12345678909'), b = cifrarCpf('12345678909');
  assert.notEqual(a, b);
  assert.ok(!a.includes('12345678909'));
});
caso('alterar o texto cifrado faz a decifragem falhar (autenticação GCM)', () => {
  const v = cifrarCpf('12345678909').split(':');
  const ct = Buffer.from(v[3], 'base64'); ct[0] ^= 1; v[3] = ct.toString('base64');
  assert.throws(() => decifrarCpf(v.join(':')));
});
caso('busca do CPF é determinística, diferencia CPFs e não revela o número', () => {
  assert.equal(buscaCpf('123.456.789-09'), buscaCpf('12345678909'));
  assert.notEqual(buscaCpf('12345678909'), buscaCpf('12345678910'));
  assert.ok(!buscaCpf('12345678909').includes('12345678909'));
});
caso('CPF com tamanho inválido é recusado', () => {
  assert.throws(() => cifrarCpf('123'));
  assert.throws(() => buscaCpf('123'));
});
caso('máscara mostra só o trecho central', () => {
  assert.equal(mascararCpf('12345678909'), '***.456.789-**');
});
console.log('todos os testes de segurança passaram');
