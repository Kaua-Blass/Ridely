/**
 * Teste de integração do CPF cifrado: fluxo real (cadastro, aprovação, edição, duplicidade, listagem)
 * e migração de um banco antigo, com CPF em texto. Apaga e recria o schema (nome do banco termina em _test).
 *   DATABASE_URL=postgres://ridely:ridely@localhost:5432/ridely_test npm run test:integracao:cpf
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
process.env.APP_URL = 'http://localhost:5173';
delete process.env.SMTP_URL;
const SENHA = 'Senha-de-teste-1';
const CPF_A = '12345678909', CPF_B = '11144477735';

async function main() {
  const pg = new Client({ connectionString: url }); await pg.connect();
  const sql = async (q: string, p: unknown[] = []) => (await pg.query(q, p)).rows;
  const schemaDir = join(__dirname, '../../database');
  await pg.query('drop schema public cascade; create schema public;');
  await pg.query(readFileSync(join(schemaDir, 'schema.sql'), 'utf8'));
  const { hashSenha } = await import('../src/common/password');
  const { buscaCpf, decifrarCpf } = await import('../src/common/cpf');
  await pg.query("insert into usuario(nome,email,senha_hash,perfil) values('Paula','paula@teste.com',$1,'presidente')", [await hashSenha(SENHA)]);
  const inst = (await sql("insert into instituicao(nome) values('Escola Central') returning id"))[0].id;

  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../src/app.module');
  const { configurarApp } = await import('../src/configurar-app');
  const app = await NestFactory.create(AppModule, { logger: false });
  configurarApp(app); await app.listen(0);
  const base = `http://127.0.0.1:${(app.getHttpServer().address() as any).port}`;
  const j = async (metodo: string, caminho: string, corpo?: unknown, cookie?: string) => {
    const r = await fetch(`${base}/api${caminho}`, { method: metodo, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: corpo !== undefined ? JSON.stringify(corpo) : undefined });
    const texto = await r.text(); let json: any = null; try { json = JSON.parse(texto); } catch { /* vazio */ }
    return { status: r.status, json, texto, headers: r.headers };
  };
  const r0 = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'paula@teste.com', senha: SENHA }) });
  const cookie = (r0.headers.get('set-cookie') ?? '').split(';')[0];

  const casos: [string, () => Promise<void>][] = [];
  const caso = (nome: string, fn: () => Promise<void>) => casos.push([nome, fn]);
  let idPedido = 0, idAssoc = 0, idOutro = 0;

  caso('cadastro público com CPF formatado é aceito', async () => {
    const r = await j('POST', '/auth/cadastro', { nome: 'Ana Costa', email: 'ana@teste.com', senha: SENHA, cpf: '123.456.789-09', instituicaoId: inst });
    assert.equal(r.status, 201, r.texto);
  });
  caso('o pedido de cadastro não guarda o CPF em texto, só cifrado e com a impressão digital', async () => {
    const s = (await sql("select id, dados from solicitacao where tipo='associacao'"))[0];
    idPedido = s.id;
    const bruto = JSON.stringify(s.dados);
    assert.ok(!bruto.includes(CPF_A), 'CPF em texto no pedido');
    assert.ok(!('cpf' in s.dados), 'chave cpf presente');
    assert.ok(s.dados.cpfCifrado && s.dados.cpfBusca === buscaCpf(CPF_A));
  });
  caso('aprovar o pedido cria o associado com o CPF cifrado', async () => {
    const r = await j('POST', `/administracao/solicitacoes/${idPedido}/decisao`, { aprovar: true }, cookie);
    assert.equal(r.status, 200, r.texto);
    const a = (await sql("select id, cpf_cifrado, cpf_busca from associado where email='ana@teste.com'"))[0];
    idAssoc = a.id;
    assert.equal(decifrarCpf(a.cpf_cifrado), CPF_A);
    assert.equal(a.cpf_busca, buscaCpf(CPF_A));
    assert.ok(!a.cpf_cifrado.includes(CPF_A));
  });
  caso('o banco não tem mais coluna de CPF em texto', async () => {
    const col = await sql("select column_name from information_schema.columns where table_name='associado' and column_name='cpf'");
    assert.equal(col.length, 0);
  });
  caso('segundo cadastro com o mesmo CPF é recusado na aprovação (409)', async () => {
    await j('POST', '/auth/cadastro', { nome: 'Ana Duplicada', email: 'ana2@teste.com', senha: SENHA, cpf: CPF_A, instituicaoId: inst });
    const id = (await sql("select id from solicitacao where dados->>'email'='ana2@teste.com'"))[0].id;
    const r = await j('POST', `/administracao/solicitacoes/${id}/decisao`, { aprovar: true }, cookie);
    assert.equal(r.status, 409);
  });
  caso('associado de outra pessoa com CPF já em uso é recusado na edição (409)', async () => {
    idOutro = (await sql("insert into associado(nome,email,situacao,cargo,cpf_cifrado,cpf_busca) values('Outro','outro@teste.com','ativo','associado',$1,$2) returning id", ['x', buscaCpf(CPF_B)]))[0].id;
    const r = await j('PATCH', `/associados/${idAssoc}`, { nome: 'Ana Costa', cargo: 'associado', instituicaoId: inst, cpf: CPF_B }, cookie);
    assert.equal(r.status, 409); assert.match(r.texto, /Esse CPF já está cadastrado/);
  });
  caso('editar sem informar CPF mantém o CPF atual', async () => {
    const antes = (await sql('select cpf_busca from associado where id=$1', [idAssoc]))[0].cpf_busca;
    const r = await j('PATCH', `/associados/${idAssoc}`, { nome: 'Ana Costa Silva', cargo: 'associado', instituicaoId: inst }, cookie);
    assert.equal(r.status, 200, r.texto);
    assert.equal((await sql('select cpf_busca from associado where id=$1', [idAssoc]))[0].cpf_busca, antes);
  });
  caso('editar com CPF novo cifra o novo valor', async () => {
    await pg.query('delete from associado where id=$1', [idOutro]);
    const r = await j('PATCH', `/associados/${idAssoc}`, { nome: 'Ana Costa Silva', cargo: 'associado', instituicaoId: inst, cpf: CPF_B }, cookie);
    assert.equal(r.status, 200, r.texto);
    const a = (await sql('select cpf_cifrado, cpf_busca from associado where id=$1', [idAssoc]))[0];
    assert.equal(decifrarCpf(a.cpf_cifrado), CPF_B); assert.equal(a.cpf_busca, buscaCpf(CPF_B));
  });
  caso('listagem e detalhes da API não expõem CPF', async () => {
    const lista = await j('GET', '/associados', undefined, cookie);
    assert.equal(lista.status, 200);
    for (const cpf of [CPF_A, CPF_B, '123.456.789-09', '111.444.777-35']) assert.ok(!lista.texto.includes(cpf), 'CPF exposto');
    assert.ok(!lista.texto.includes('"cpf"'));
  });

  // ---------- migração de um banco antigo ----------
  caso('migração: CPFs em texto de um banco antigo são cifrados, a coluna em texto sai e a migração pode rodar de novo', async () => {
    const { migrarCpfs } = await import('../src/scripts/cpf-migrar');
    await pg.query('alter table associado drop column cpf_cifrado, drop column cpf_busca');
    await pg.query('alter table associado add column cpf text unique');
    await pg.query("update associado set cpf=$1 where id=$2", [CPF_B, idAssoc]);
    await pg.query("insert into associado(nome,email,situacao,cargo,cpf) values('Velho','velho@teste.com','ativo','associado',$1)", [CPF_A]);
    await pg.query("insert into solicitacao(tipo,dados,usuario_id) values('associacao', $1, (select id from usuario where email='paula@teste.com'))",
      [JSON.stringify({ nome: 'Pedido antigo', email: 'antigo@teste.com', cpf: '98765432100', telefone: null, instituicaoId: inst })]);
    await pg.query(readFileSync(join(schemaDir, 'migrations/008_cpf_cifrado.sql'), 'utf8'));
    const r1 = await migrarCpfs(url);
    assert.deepEqual(r1, { associados: 2, pedidos: 1 });
    assert.equal((await sql("select count(*)::int n from information_schema.columns where table_name='associado' and column_name='cpf'"))[0].n, 0);
    const velho = (await sql("select cpf_cifrado, cpf_busca from associado where email='velho@teste.com'"))[0];
    assert.equal(decifrarCpf(velho.cpf_cifrado), CPF_A); assert.equal(velho.cpf_busca, buscaCpf(CPF_A));
    const pedido = (await sql("select dados from solicitacao where dados->>'email'='antigo@teste.com'"))[0].dados;
    assert.ok(!('cpf' in pedido) && decifrarCpf(pedido.cpfCifrado) === '98765432100');
    const r2 = await migrarCpfs(url);
    assert.deepEqual(r2, { associados: 0, pedidos: 0 }, 'segunda execução não altera nada');
  });

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
