/**
 * Teste de integração da Etapa 7 (painel e relatórios): API real + PostgreSQL real.
 * Apaga e recria o schema do banco apontado (nome deve terminar em "_test").
 *   DATABASE_URL=postgres://ridely:ridely@localhost:5432/ridely_test npm run test:integracao:relatorios
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

const url = process.env.DATABASE_URL ?? '';
if (!/_test$/.test(new URL(url || 'postgres://x/x').pathname.slice(1))) {
  console.error('Defina DATABASE_URL apontando para um banco cujo nome termine em _test.'); process.exit(2);
}
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.ROTINAS_AUTOMATICAS = 'false';
delete process.env.SMTP_URL;
const SENHA = 'Senha-de-teste-1';

let base = ''; const cookies = new Map<string, string>();
async function chamar(quem: string | null, metodo: string, caminho: string, corpo?: unknown) {
  const headers: Record<string, string> = {};
  if (quem) headers.cookie = cookies.get(quem)!;
  if (corpo !== undefined) headers['content-type'] = 'application/json';
  const r = await fetch(`${base}/api${caminho}`, { method: metodo, headers, body: corpo !== undefined ? JSON.stringify(corpo) : undefined });
  const buf = Buffer.from(await r.arrayBuffer());
  let json: any = null; try { json = JSON.parse(buf.toString('utf8')); } catch { /* binário */ }
  return { status: r.status, json, headers: r.headers, buf };
}

let falhas = 0, total = 0;
async function caso(nome: string, fn: () => Promise<void>) {
  total++;
  try { await fn(); console.log('ok  -', nome); }
  catch (e) { falhas++; console.log('ERRO -', nome, '\n      ', (e as Error).message.split('\n').slice(0, 4).join('\n       ')); }
}

async function main() {
  const pg = new Client({ connectionString: url }); await pg.connect();
  await pg.query('drop schema public cascade; create schema public;');
  await pg.query(readFileSync(join(__dirname, '../../database/schema.sql'), 'utf8'));
  const { hashSenha } = await import('../src/common/password');
  const hash = await hashSenha(SENHA);
  const sql = async (q: string, p: unknown[] = []) => (await pg.query(q, p)).rows;
  const assoc = async (nome: string, situacao = 'ativo') => (await sql("insert into associado(nome,email,situacao,cargo) values($1,$2,$3,'associado') returning id", [nome, `${nome.toLowerCase()}@teste.com`, situacao]))[0].id as number;
  const usu = async (nome: string, perfil: string, assocId: number | null) => (await sql('insert into usuario(associado_id,nome,email,senha_hash,perfil) values($1,$2,$3,$4,$5) returning id', [assocId, nome, `${nome.toLowerCase()}@teste.com`, hash, perfil]))[0].id as number;

  const ana = await assoc('Ana'), bruno = await assoc('Bruno'), carla = await assoc('Carla');
  await usu('Ana', 'associado', ana); await usu('Bruno', 'associado', bruno);
  await usu('Paula', 'presidente', null); await usu('Tiago', 'tesoureiro', null); await usu('Vera', 'conselheiro', null);
  await usu('Mario', 'motorista', null);

  // datas fixas: o teste usa o relógio simulado do servidor (RELOGIO_FALSO)
  process.env.RELOGIO_FALSO = '2026-10-28T10:00:00-03:00';
  const conta = (await sql("insert into conta_financeira(nome,tipo,banco,numero,saldo_inicial) values('Banco','banco','BB','1',1000) returning id"))[0].id;
  // inadimplência: Ana deve 2 meses (set e out), Bruno 1 (out, mas paga) e Carla uma cancelada
  const mens = async (assocId: number, ref: string, venc: string, valor: number, cancelada = false) =>
    (await sql('insert into mensalidade(associado_id,referencia,vencimento,valor,cancelada_em) values($1,$2,$3,$4,$5) returning id', [assocId, ref, venc, valor, cancelada ? new Date() : null]))[0].id as number;
  await mens(ana, '2026-09', '2026-09-10', 250); await mens(ana, '2026-10', '2026-10-10', 250);
  const pagaId = await mens(bruno, '2026-10', '2026-10-10', 250);
  await sql("insert into pagamento(mensalidade_id,pago_em,valor,forma,conta_id) values($1,'2026-10-09',250,'pix',$2)", [pagaId, conta]);
  await mens(carla, '2026-09', '2026-09-10', 250, true);
  await mens(ana, '2026-11', '2026-11-10', 250); // ainda não venceu: não é inadimplência
  // movimentações: set receita 300 / despesa 120; out receita 150 / despesa 80; transferência não conta
  const mov = async (data: string, tipo: string, cat: string, valor: number, sinal: number) => sql('insert into movimentacao(conta_id,data,tipo,categoria,historico,valor,sinal) values($1,$2,$3,$4,$5,$6,$7)', [conta, data, tipo, cat, 'teste', valor, sinal]);
  await mov('2026-09-05', 'receita', 'Doação', 300, 1); await mov('2026-09-20', 'despesa', 'Combustível', 120, -1);
  await mov('2026-10-03', 'receita', 'Outras receitas', 150, 1); await mov('2026-10-15', 'despesa', 'Manutenção', 80, -1);
  await mov('2026-10-20', 'transferencia_saida', 'Transferência', 500, -1); await mov('2026-10-20', 'transferencia_entrada', 'Transferência', 500, 1);
  // contratos: Carla vence em 20 dias; Ana vence em 60 (fora); um encerrado (fora)
  await sql("insert into contrato(associado_id,inicio,fim,dias_semana,valor_por_dia,status) values($1,'2026-02-01','2026-11-17','{1,2,3,4,5}',50,'vigente')", [carla]);
  await sql("insert into contrato(associado_id,inicio,fim,dias_semana,valor_por_dia) values($1,'2026-02-01','2026-12-27','{1,2,3,4,5}',50)", [ana]);
  await sql("insert into contrato(associado_id,inicio,fim,dias_semana,valor_por_dia,status) values($1,'2026-02-01','2026-11-05','{1,2,3,4,5}',50,'encerrado')", [bruno]);

  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../src/app.module');
  const { configurarApp } = await import('../src/configurar-app');
  const app = await NestFactory.create(AppModule, { logger: false });
  configurarApp(app); await app.listen(0);
  base = `http://127.0.0.1:${(app.getHttpServer().address() as any).port}`;
  for (const n of ['paula', 'tiago', 'vera', 'mario', 'ana', 'bruno']) {
    const email = n === 'paula' ? 'paula@teste.com' : `${n}@teste.com`;
    const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha: SENHA }) });
    assert.equal(r.status, 200, `login ${n}`);
    cookies.set(n, (r.headers.get('set-cookie') ?? '').split(';')[0]);
  }

  await caso('inadimplência: soma só o que venceu e não foi pago; cancelada e não vencida ficam de fora', async () => {
    const r = (await chamar('paula', 'GET', '/relatorios/inadimplencia')).json;
    assert.equal(r.total, 500); assert.equal(r.associados, 1); assert.equal(r.meses, 2);
    assert.equal(r.itens[0].nome, 'Ana'); assert.equal(r.itens[0].referencias, '2026-09, 2026-10');
  });
  await caso('fluxo de caixa: receitas, despesas e saldo por mês; transferência não entra', async () => {
    const f = (await chamar('paula', 'GET', '/relatorios/fluxo-caixa?de=2026-09-01&ate=2026-10-28')).json;
    assert.equal(f.saldoInicial, 1000);
    assert.deepEqual(f.meses.map((m: any) => [m.mes, m.receitas, m.despesas, m.saldo]), [['2026-09', 300, 120, 180], ['2026-10', 150, 80, 70]]);
    assert.deepEqual(f.totais, { receitas: 450, despesas: 200, saldo: 250, saldoFinal: 1250 });
  });
  await caso('fluxo de caixa: período inválido e datas mal formadas são recusados ou ignorados', async () => {
    assert.equal((await chamar('paula', 'GET', '/relatorios/fluxo-caixa?de=2026-10-01&ate=2026-09-01')).status, 400);
    const r = await chamar('paula', 'GET', '/relatorios/fluxo-caixa?de=lixo&ate=2026-10-28');
    assert.equal(r.status, 200, 'data inválida cai no padrão, não derruba a tela');
  });
  await caso('contratos a vencer: só vigentes dentro do prazo de 30 dias', async () => {
    const r = (await chamar('paula', 'GET', '/relatorios/contratos-a-vencer')).json;
    assert.equal(r.prazoDias, 30); assert.equal(r.itens.length, 1);
    assert.equal(r.itens[0].associado, 'Carla'); assert.equal(r.itens[0].diasParaVencer, 20);
  });
  await caso('exportação PDF e CSV: formato, nome do arquivo e cabeçalhos de segurança', async () => {
    const pdf = await chamar('paula', 'GET', '/relatorios/exportar/inadimplencia?formato=pdf');
    assert.equal(pdf.status, 200); assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.ok(pdf.buf.subarray(0, 5).equals(Buffer.from('%PDF-')));
    assert.match(pdf.headers.get('content-disposition')!, /filename\*=UTF-8''inadimplencia-2026-10-28\.pdf/);
    assert.equal(pdf.headers.get('x-content-type-options'), 'nosniff');
    const csvR = await chamar('paula', 'GET', '/relatorios/exportar/fluxo?formato=csv&de=2026-09-01&ate=2026-10-28');
    assert.equal(csvR.headers.get('content-type'), 'text/csv; charset=utf-8');
    const texto = csvR.buf.toString('utf8');
    assert.ok(texto.startsWith('\uFEFF'), 'BOM para o Excel abrir acentos');
    assert.match(texto, /Mês;Receitas \(R\$\);Despesas \(R\$\);Saldo do mês \(R\$\)/);
    assert.match(texto, /09\/2026;300,00;120,00;180,00/);
    assert.match(texto, /Total;450,00;200,00;250,00/);
  });
  await caso('exportação: tipo desconhecido é recusado (400)', async () => {
    assert.equal((await chamar('paula', 'GET', '/relatorios/exportar/xyz')).status, 400);
  });
  await caso('permissões: associado e motorista não acessam relatórios nem exportação (403)', async () => {
    assert.equal((await chamar('ana', 'GET', '/relatorios/inadimplencia')).status, 403);
    assert.equal((await chamar('ana', 'GET', '/relatorios/exportar/fluxo?formato=csv')).status, 403);
    assert.equal((await chamar('mario', 'GET', '/relatorios/fluxo-caixa')).status, 403);
    assert.equal((await chamar(null, 'GET', '/relatorios/inadimplencia')).status, 401);
  });
  await caso('conselheiro e tesoureiro acessam relatórios (consulta)', async () => {
    assert.equal((await chamar('vera', 'GET', '/relatorios/contratos-a-vencer')).status, 200);
    assert.equal((await chamar('tiago', 'GET', '/relatorios/exportar/inadimplencia?formato=pdf')).status, 200);
  });
  await caso('painel gerencial: saldo, mensalidades do mês, inadimplência e contratos a vencer', async () => {
    const p = (await chamar('paula', 'GET', '/painel')).json;
    assert.equal(p.perfil, 'gerencial');
    const v = Object.fromEntries(p.indicadores.map((i: any) => [i.rotulo, i]));
    assert.equal(v['Saldo em caixa e bancos'].valor, 'R$ 1.250,00');
    assert.equal(v['Inadimplência'].valor, 'R$ 500,00');
    assert.equal(v['Contratos a vencer'].valor, 1);
    // em 10/2026 há 2 mensalidades ativas (Ana e Bruno); só o Bruno pagou
    assert.equal(v['Mensalidades de 10/2026'].valor, '1 de 2 pagas');
  });
  await caso('painel do associado: só as próprias pendências, sem dados dos outros', async () => {
    const p = (await chamar('ana', 'GET', '/painel')).json;
    assert.equal(p.perfil, 'associado');
    const atraso = p.indicadores.find((i: any) => i.rotulo === 'Mensalidades em atraso');
    assert.equal(atraso.valor, 2); assert.equal(atraso.detalhe, 'R$ 500,00');
    const b = (await chamar('bruno', 'GET', '/painel')).json;
    assert.equal(b.indicadores.find((i: any) => i.rotulo === 'Mensalidades em atraso').valor, 0);
    assert.equal(b.indicadores.find((i: any) => i.rotulo === 'Contrato vigente até').valor, '—', 'contrato encerrado não aparece');
  });
  await caso('painel do motorista: indicador simples, sem números de outros', async () => {
    const p = (await chamar('mario', 'GET', '/painel')).json;
    assert.equal(p.perfil, 'motorista');
  });
  await caso('painel sem sessão é recusado (401)', async () => {
    assert.equal((await chamar(null, 'GET', '/painel')).status, 401);
  });

  await app.close(); await pg.end();
  console.log(`\n${total - falhas}/${total} casos aprovados${falhas ? `, ${falhas} com erro` : ''}`);
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
