/**
 * Teste de integração da Etapa 6 (comunicados, notificações e rotinas).
 * Sobe a API de verdade, com HTTP, cookies de sessão e PostgreSQL.
 *
 * ATENÇÃO: apaga e recria o schema do banco apontado. Por segurança só roda se o nome do banco terminar em "_test".
 *   createdb ridely_test
 *   DATABASE_URL=postgres://ridely:ridely@localhost:5432/ridely_test npm run test:integracao
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';

const url = process.env.DATABASE_URL ?? '';
if (!/_test$/.test(new URL(url || 'postgres://x/x').pathname.slice(1))) {
  console.error('Defina DATABASE_URL apontando para um banco cujo nome termine em _test (o teste apaga os dados).');
  process.exit(2);
}
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'ridely-up-'));
process.env.ROTINAS_AUTOMATICAS = 'false';
process.env.APP_URL = 'http://teste.local';
delete process.env.SMTP_URL;

const SENHA = 'Senha-de-teste-1';
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('conteudo de teste '.repeat(20))]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);

type Resp = { status: number; json: any; headers: Headers; buf: Buffer };
let base = '';
const cookies = new Map<string, string>();
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function chamar(quem: string | null, metodo: string, caminho: string, corpo?: unknown, form?: FormData): Promise<Resp> {
  const headers: Record<string, string> = {};
  if (quem) headers.cookie = cookies.get(quem)!;
  if (corpo !== undefined) headers['content-type'] = 'application/json';
  const r = await fetch(`${base}/api${caminho}`, { method: metodo, headers, body: form ?? (corpo !== undefined ? JSON.stringify(corpo) : undefined) });
  const buf = Buffer.from(await r.arrayBuffer());
  let json: any = null;
  try { json = JSON.parse(buf.toString('utf8')); } catch { /* arquivo */ }
  return { status: r.status, json, headers: r.headers, buf };
}
const anexo = (b: Buffer, nome: string, tipo: string) => { const f = new FormData(); f.append('arquivo', new Blob([new Uint8Array(b)], { type: tipo }), nome); return f; };

let falhas = 0, total = 0;
async function caso(nome: string, fn: () => Promise<void>) {
  total++;
  try { await fn(); console.log('ok  -', nome); } catch (e) { falhas++; console.log('ERRO -', nome, '\n      ', (e as Error).message.split('\n').slice(0, 4).join('\n       ')); }
}

async function main() {
  // ---------- banco limpo + dados ----------
  const pg = new Client({ connectionString: url });
  await pg.connect();
  await pg.query('drop schema public cascade; create schema public;');
  await pg.query(readFileSync(join(__dirname, '../../database/schema.sql'), 'utf8'));
  const { hashSenha } = await import('../src/common/password');
  const hash = await hashSenha(SENHA);
  const assoc = async (nome: string, situacao = 'ativo') => (await pg.query("insert into associado(nome, email, situacao, cargo) values($1,$2,$3,'associado') returning id", [nome, `${nome.toLowerCase()}@teste.com`, situacao])).rows[0].id as number;
  const usu = async (nome: string, perfil: string, associadoId: number | null, ativo = true) =>
    (await pg.query('insert into usuario(associado_id, nome, email, senha_hash, perfil, ativo) values($1,$2,$3,$4,$5,$6) returning id', [associadoId, nome, `${nome.toLowerCase()}@teste.com`, hash, perfil, ativo])).rows[0].id as number;
  const idAna = await assoc('Ana'), idBruno = await assoc('Bruno'), idCarla = await assoc('Carla'), idDavi = await assoc('Davi', 'inativo');
  const idPaula = await assoc('Paula'), idTiago = await assoc('Tiago'), idVera = await assoc('Vera'), idAline = await assoc('Aline');
  const u = {
    ana: await usu('Ana', 'associado', idAna), bruno: await usu('Bruno', 'associado', idBruno), davi: await usu('Davi', 'associado', idDavi, false),
    paula: await usu('Paula', 'presidente', idPaula), tiago: await usu('Tiago', 'tesoureiro', idTiago), vera: await usu('Vera', 'vice_presidente', idVera),
    aline: await usu('Aline', 'auxiliar', idAline), mario: await usu('Mario', 'motorista', null),
  };
  const ativos = 7; // todos menos o Davi (inativo)

  // ---------- e-mail simulado (conta envios e permite simular falha) ----------
  const { MailService } = await import('../src/common/mail.service');
  const enviados: string[] = [];
  let falharPara: string | null = null, semSmtp = false;
  (MailService.prototype as any).enviar = async function (para: string) {
    if (semSmtp) return { status: 'sem_smtp' };
    if (falharPara === para) return { status: 'falhou', erro: 'SMTP fora do ar' };
    enviados.push(para); return { status: 'enviado' };
  };

  // ---------- app de verdade ----------
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../src/app.module');
  const { configurarApp } = await import('../src/configurar-app');
  const app = await NestFactory.create(AppModule, { logger: false });
  configurarApp(app);
  await app.listen(0);
  base = `http://127.0.0.1:${(app.getHttpServer().address() as any).port}`;
  for (const n of ['ana', 'bruno', 'paula', 'tiago', 'vera', 'aline', 'mario']) {
    const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${n}@teste.com`, senha: SENHA }) });
    assert.equal(r.status, 200, `login de ${n}`);
    cookies.set(n, (r.headers.get('set-cookie') ?? '').split(';')[0]);
  }
  const sql = async (q: string, p: unknown[] = []) => (await pg.query(q, p)).rows;
  const esperarEmails = async (comunicadoId: number) => {
    for (let i = 0; i < 50; i++) {
      if (!(await sql("select 1 from notificacao where comunicado_id=$1 and email_status='pendente'", [comunicadoId])).length) return;
      await dormir(100);
    }
  };

  // =====================================================================
  // COMUNICADOS
  // =====================================================================
  let idCobranca = 0, idAviso = 0, idParaCarla = 0;

  await caso('associado não publica comunicado (403)', async () => {
    const r = await chamar('ana', 'POST', '/comunicacao', { tipo: 'aviso', titulo: 'x', mensagem: 'y' });
    assert.equal(r.status, 403);
  });
  await caso('motorista e associado não acessam destinatários nem rotinas (403)', async () => {
    assert.equal((await chamar('mario', 'GET', '/comunicacao/destinatarios')).status, 403);
    assert.equal((await chamar('ana', 'GET', '/comunicacao/rotinas')).status, 403);
    assert.equal((await chamar('ana', 'POST', '/comunicacao/rotinas/cobranca-atrasados/executar')).status, 403);
  });
  await caso('tesoureiro não publica notícia (403), mas publica cobrança para uma pessoa', async () => {
    assert.equal((await chamar('tiago', 'POST', '/comunicacao', { tipo: 'noticia', titulo: 'x', mensagem: 'y' })).status, 403);
    const r = await chamar('tiago', 'POST', '/comunicacao', { tipo: 'cobranca', titulo: 'Mensalidade em aberto', mensagem: 'Ana, falta a de outubro.', destinatarioId: idAna });
    assert.equal(r.status, 201); idCobranca = r.json.id;
    assert.match(r.json.mensagem, /enviado a 1 pessoa/);
    assert.equal((await sql('select count(*)::int n from notificacao where comunicado_id=$1', [idCobranca]))[0].n, 1);
    assert.equal((await sql('select usuario_id from notificacao where comunicado_id=$1', [idCobranca]))[0].usuario_id, u.ana);
  });
  await caso('aviso para todos (destinatarioId nulo) avisa todos os ativos, menos o autor e os inativos', async () => {
    const r = await chamar('paula', 'POST', '/comunicacao', { tipo: 'aviso', titulo: 'Reunião sábado', mensagem: 'Reunião da diretoria às 9h.', destinatarioId: null });
    assert.equal(r.status, 201); idAviso = r.json.id;
    const n = await sql('select usuario_id from notificacao where comunicado_id=$1', [idAviso]);
    assert.equal(n.length, ativos - 1);
    assert.ok(!n.some((x) => x.usuario_id === u.paula), 'o autor não é avisado');
    assert.ok(!n.some((x) => x.usuario_id === u.davi), 'usuário inativo não é avisado');
    assert.ok(n.some((x) => x.usuario_id === u.mario), 'motorista também recebe aviso para todos');
  });
  await caso('e-mail sai para cada pessoa e a entrega fica registrada', async () => {
    await esperarEmails(idAviso); await esperarEmails(idCobranca);
    const st = await sql("select email_status, count(*)::int n from notificacao where comunicado_id in ($1,$2) group by 1", [idAviso, idCobranca]);
    assert.deepEqual(st, [{ email_status: 'enviado', n: ativos }]); // 6 do aviso + 1 da cobrança
    assert.ok(enviados.includes('ana@teste.com') && enviados.includes('mario@teste.com'));
  });
  await caso('visibilidade: Ana vê o aviso e a cobrança dela; Bruno só o aviso; gerente vê tudo com as entregas', async () => {
    const ana = (await chamar('ana', 'GET', '/comunicacao')).json, bruno = (await chamar('bruno', 'GET', '/comunicacao')).json, pres = (await chamar('paula', 'GET', '/comunicacao')).json;
    assert.deepEqual(ana.itens.map((c: any) => c.id).sort(), [idCobranca, idAviso].sort());
    assert.deepEqual(bruno.itens.map((c: any) => c.id), [idAviso]);
    assert.equal(ana.itens[0].entregas, null, 'quem recebe não vê estatística de entrega');
    const av = pres.itens.find((c: any) => c.id === idAviso);
    assert.deepEqual(av.entregas, { total: ativos - 1, lidas: 0, emailsFalharam: 0 });
    assert.equal(pres.total, 2);
  });
  await caso('comunicado para associado sem acesso ao sistema: publica e avisa que ninguém foi notificado', async () => {
    const r = await chamar('paula', 'POST', '/comunicacao', { tipo: 'rota', titulo: 'Mudança de rota', mensagem: 'Passa pela praça.', destinatarioId: idCarla });
    assert.equal(r.status, 201); idParaCarla = r.json.id;
    assert.match(r.json.mensagem, /ainda não tem acesso/);
    assert.equal((await sql('select count(*)::int n from notificacao where comunicado_id=$1', [idParaCarla]))[0].n, 0);
  });
  await caso('validações: título vazio, tipo inválido, associado inativo ou inexistente (400)', async () => {
    const t = await chamar('paula', 'POST', '/comunicacao', { tipo: 'aviso', titulo: '  ', mensagem: 'y' });
    assert.equal(t.status, 400); assert.match(JSON.stringify(t.json.message), /Informe o título/);
    assert.equal((await chamar('paula', 'POST', '/comunicacao', { tipo: 'sorteio', titulo: 'a', mensagem: 'b' })).status, 400);
    assert.equal((await chamar('paula', 'POST', '/comunicacao', { tipo: 'aviso', titulo: 'a', mensagem: 'b', destinatarioId: idDavi })).status, 400);
    assert.equal((await chamar('paula', 'POST', '/comunicacao', { tipo: 'aviso', titulo: 'a', mensagem: 'b', destinatarioId: 99999 })).status, 400);
    assert.equal((await chamar('paula', 'POST', '/comunicacao', { tipo: 'aviso', titulo: 'a'.repeat(121), mensagem: 'b' })).status, 400);
  });
  await caso('editar: presidente corrige e o painel de quem já foi avisado mostra o texto novo, sem novo e-mail', async () => {
    const antes = enviados.length;
    const r = await chamar('paula', 'PATCH', `/comunicacao/${idAviso}`, { titulo: 'Reunião domingo', mensagem: 'Mudou para domingo, 9h.' });
    assert.equal(r.status, 200);
    const n = await sql('select titulo, mensagem from notificacao where comunicado_id=$1', [idAviso]);
    assert.ok(n.every((x) => x.titulo === 'Reunião domingo' && x.mensagem === 'Mudou para domingo, 9h.'));
    assert.equal((await sql('select atualizado_em is not null as ok from comunicado where id=$1', [idAviso]))[0].ok, true);
    await dormir(200); assert.equal(enviados.length, antes, 'editar não reenvia e-mail');
  });
  await caso('editar: tesoureiro não mexe em notícia/rota e não promove cobrança a notícia; associado não edita', async () => {
    const nova = (await chamar('paula', 'POST', '/comunicacao', { tipo: 'noticia', titulo: 'Novidade', mensagem: 'Ônibus novo.', enviarEmail: false })).json.id;
    assert.equal((await chamar('tiago', 'PATCH', `/comunicacao/${nova}`, { titulo: 'x' })).status, 403);
    assert.equal((await chamar('tiago', 'DELETE', `/comunicacao/${nova}`)).status, 403);
    assert.equal((await chamar('tiago', 'PATCH', `/comunicacao/${idCobranca}`, { tipo: 'noticia' })).status, 403);
    assert.equal((await chamar('tiago', 'PATCH', `/comunicacao/${idCobranca}`, { titulo: 'Mensalidade de outubro' })).status, 200);
    assert.equal((await chamar('ana', 'PATCH', `/comunicacao/${idCobranca}`, { titulo: 'x' })).status, 403);
    assert.equal((await chamar('paula', 'PATCH', '/comunicacao/99999', { titulo: 'x' })).status, 404);
    // "e-mail dispensado": enviarEmail=false grava só no painel
    assert.equal((await sql('select email_status from notificacao where comunicado_id=$1 limit 1', [nova]))[0].email_status, 'dispensado');
    const p = (await chamar('tiago', 'GET', '/comunicacao')).json.itens.find((c: any) => c.id === nova);
    assert.equal(p.podeEditar, false, 'tesoureiro vê a notícia, mas a tela não oferece editar');
  });
  await caso('anexo: PDF e imagem entram; texto disfarçado de PDF é recusado (400)', async () => {
    assert.equal((await chamar('paula', 'POST', `/comunicacao/${idCobranca}/anexo`, undefined, anexo(Buffer.from('isto é só texto, não um pdf de verdade'), 'boleto.pdf', 'application/pdf'))).status, 400);
    assert.equal((await chamar('paula', 'POST', `/comunicacao/${idCobranca}/anexo`)).status, 400, 'sem arquivo');
    const ok = await chamar('tiago', 'POST', `/comunicacao/${idCobranca}/anexo`, undefined, anexo(PDF, 'Boleto outubro.pdf', 'application/pdf'));
    assert.equal(ok.status, 200);
    const c = (await sql('select anexo_path, anexo_nome from comunicado where id=$1', [idCobranca]))[0];
    assert.equal(c.anexo_nome, 'Boleto outubro.pdf'); assert.ok(existsSync(join(process.env.UPLOAD_DIR!, 'comunicados', c.anexo_path)));
    assert.match(c.anexo_path, /^\d+-[0-9a-f]{16}\.pdf$/, 'nome aleatório, nunca o do usuário');
  });
  await caso('anexo: só quem é destinatário baixa; vem como anexo, sem interpretação pelo navegador', async () => {
    const ok = await chamar('ana', 'GET', `/comunicacao/${idCobranca}/anexo`);
    assert.equal(ok.status, 200); assert.equal(ok.headers.get('content-type'), 'application/pdf');
    assert.match(ok.headers.get('content-disposition')!, /^attachment; filename\*=UTF-8''Boleto%20outubro\.pdf$/);
    assert.equal(ok.headers.get('x-content-type-options'), 'nosniff'); assert.ok(ok.buf.equals(PDF));
    assert.equal((await chamar('bruno', 'GET', `/comunicacao/${idCobranca}/anexo`)).status, 404, 'comunicado de outra pessoa');
    assert.equal((await chamar('paula', 'GET', `/comunicacao/${idCobranca}/anexo`)).status, 200, 'gerente baixa');
    assert.equal((await chamar('ana', 'GET', `/comunicacao/${idAviso}/anexo`)).status, 404, 'sem anexo');
    assert.equal((await chamar('ana', 'GET', '/comunicacao/abc/anexo')).status, 400);
  });
  await caso('anexo: substituir apaga o arquivo antigo; imagem aceita; maior que 5 MB recusado (413)', async () => {
    const dir = join(process.env.UPLOAD_DIR!, 'comunicados');
    const antigo = (await sql('select anexo_path p from comunicado where id=$1', [idCobranca]))[0].p;
    assert.equal((await chamar('paula', 'POST', `/comunicacao/${idCobranca}/anexo`, undefined, anexo(PNG, 'comprovante.png', 'image/png'))).status, 200);
    const novo = (await sql('select anexo_path p from comunicado where id=$1', [idCobranca]))[0].p;
    assert.match(novo, /\.png$/); assert.ok(!existsSync(join(dir, antigo)), 'arquivo antigo removido'); assert.ok(existsSync(join(dir, novo)));
    assert.equal((await chamar('ana', 'GET', `/comunicacao/${idCobranca}/anexo`)).headers.get('content-type'), 'image/png');
    const grande = await chamar('paula', 'POST', `/comunicacao/${idCobranca}/anexo`, undefined, anexo(Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(5 * 1024 * 1024 + 10)]), 'grande.pdf', 'application/pdf'));
    assert.equal(grande.status, 413); assert.equal(grande.json.message, 'O anexo deve ter até 5 MB.');
    assert.equal((await sql('select anexo_path p from comunicado where id=$1', [idCobranca]))[0].p, novo, 'o anexo anterior continua valendo');
  });
  await caso('anexo: remover só o anexo apaga o arquivo e o link some', async () => {
    const dir = join(process.env.UPLOAD_DIR!, 'comunicados');
    const p = (await sql('select anexo_path p from comunicado where id=$1', [idCobranca]))[0].p;
    assert.equal((await chamar('tiago', 'DELETE', `/comunicacao/${idCobranca}/anexo`)).status, 200);
    assert.ok(!existsSync(join(dir, p)));
    assert.equal((await chamar('ana', 'GET', `/comunicacao/${idCobranca}/anexo`)).status, 404);
    assert.equal((await chamar('ana', 'GET', '/comunicacao')).json.itens.find((c: any) => c.id === idCobranca).anexoNome, null);
  });
  await caso('remover comunicado: notificações e arquivo saem junto; fica na auditoria', async () => {
    await chamar('tiago', 'POST', `/comunicacao/${idCobranca}/anexo`, undefined, anexo(PDF, 'x.pdf', 'application/pdf'));
    const p = (await sql('select anexo_path p from comunicado where id=$1', [idCobranca]))[0].p;
    assert.equal((await chamar('tiago', 'DELETE', `/comunicacao/${idCobranca}`)).status, 200);
    assert.equal((await sql('select count(*)::int n from notificacao where comunicado_id=$1', [idCobranca]))[0].n, 0);
    assert.ok(!existsSync(join(process.env.UPLOAD_DIR!, 'comunicados', p)));
    assert.equal((await chamar('ana', 'GET', '/comunicacao')).json.itens.some((c: any) => c.id === idCobranca), false);
    assert.equal((await sql("select count(*)::int n from auditoria where acao in ('comunicado_criado','comunicado_editado','comunicado_removido')"))[0].n >= 3, true);
    assert.equal((await chamar('tiago', 'DELETE', `/comunicacao/${idCobranca}`)).status, 404);
  });

  // =====================================================================
  // NOTIFICAÇÕES DO PAINEL
  // =====================================================================
  await caso('painel: contador, listagem paginada e marcar como lida (só as próprias)', async () => {
    const antes = (await chamar('bruno', 'GET', '/comunicacao/notificacoes/resumo')).json.naoLidas;
    assert.ok(antes >= 1);
    const lista = (await chamar('bruno', 'GET', '/comunicacao/notificacoes?porPagina=1')).json;
    assert.equal(lista.itens.length, 1); assert.equal(lista.pagina, 1); assert.ok(lista.total >= 1); assert.equal(lista.naoLidas, antes);
    const id = lista.itens[0].id;
    const alheia = (await sql('select id from notificacao where usuario_id=$1 limit 1', [u.ana]))[0].id;
    assert.equal((await chamar('bruno', 'POST', `/comunicacao/notificacoes/${alheia}/lida`)).status, 404, 'notificação de outra pessoa');
    const r = await chamar('bruno', 'POST', `/comunicacao/notificacoes/${id}/lida`);
    assert.equal(r.status, 200); assert.equal(r.json.naoLidas, antes - 1);
    assert.equal((await chamar('bruno', 'POST', `/comunicacao/notificacoes/${id}/lida`)).json.naoLidas, antes - 1, 'marcar de novo não muda nada');
    assert.equal((await chamar('bruno', 'GET', '/comunicacao/notificacoes?apenasNaoLidas=true')).json.itens.every((n: any) => !n.lida), true);
    assert.equal((await chamar('bruno', 'POST', '/comunicacao/notificacoes/lidas')).json.naoLidas, 0);
    assert.equal((await chamar('bruno', 'GET', '/comunicacao/notificacoes/resumo')).json.naoLidas, 0);
    assert.equal((await chamar(null, 'GET', '/comunicacao/notificacoes/resumo')).status, 401, 'sem sessão');
  });
  await caso('painel: a estatística de leitura aparece para quem publicou', async () => {
    const av = (await chamar('paula', 'GET', '/comunicacao')).json.itens.find((c: any) => c.id === idAviso);
    assert.equal(av.entregas.lidas, 1); // só o Bruno leu
  });

  // =====================================================================
  // ROTINAS AUTOMÁTICAS (com relógio simulado)
  // =====================================================================
  const dia = (iso: string) => { process.env.RELOGIO_FALSO = `${iso}T10:00:00-03:00`; };
  const rodar = async (quem: string, rotina: string) => { const r = await chamar(quem, 'POST', `/comunicacao/rotinas/${rotina}/executar`); assert.equal(r.status, 200, JSON.stringify(r.json)); return r.json; };
  const conta = (await sql("insert into conta_financeira(nome, tipo) values('Caixa','caixa') returning id"))[0].id;
  await sql("insert into mensalidade(associado_id, referencia, vencimento, valor) values($1,'2026-11','2026-11-10',250)", [idAna]);            // vence em 3 dias
  await sql("insert into mensalidade(associado_id, referencia, vencimento, valor) values($1,'2026-10','2026-10-10',250)", [idBruno]);          // atrasada
  await sql("insert into mensalidade(associado_id, referencia, vencimento, valor) values($1,'2026-10','2026-10-10',250)", [idAna]);            // paga
  await sql("insert into pagamento(mensalidade_id, pago_em, valor, forma, conta_id) select id,'2026-10-09',250,'pix',$2 from mensalidade where associado_id=$1 and referencia='2026-10'", [idAna, conta]);
  await sql("insert into mensalidade(associado_id, referencia, vencimento, valor, cancelada_em) values($1,'2026-09','2026-09-10',250, now())", [idBruno]); // cancelada
  await sql("insert into mensalidade(associado_id, referencia, vencimento, valor) values($1,'2026-10','2026-10-10',250)", [idDavi]);          // associado inativo
  await sql("insert into mensalidade(associado_id, referencia, vencimento, valor) values($1,'2026-10','2026-10-10',250)", [idCarla]);         // sem acesso ao sistema

  await caso('lembrete: avisa quem vence em até 3 dias; não avisa pagas, canceladas, inativos nem quem não tem conta', async () => {
    dia('2026-11-07');
    const r = await rodar('paula', 'lembrete-vencimento');
    assert.equal(r.criadas, 1);
    const n = (await sql("select usuario_id, titulo, mensagem, link from notificacao where tipo='lembrete_vencimento'"));
    assert.equal(n.length, 1); assert.equal(n[0].usuario_id, u.ana); assert.equal(n[0].link, '/financeiro');
    assert.equal(n[0].titulo, 'Sua mensalidade vence em 3 dias');
    assert.match(n[0].mensagem, /11\/2026.*R\$ 250,00.*10\/11\/2026.*multa de 5%/);
  });
  await caso('lembrete: rodar de novo (no mesmo dia ou nos seguintes) não duplica', async () => {
    const r1 = await rodar('paula', 'lembrete-vencimento'); assert.equal(r1.criadas, 0); assert.equal(r1.ignoradas, 1);
    dia('2026-11-09'); const r2 = await rodar('paula', 'lembrete-vencimento'); assert.equal(r2.criadas, 0);
    assert.equal((await sql("select count(*)::int n from notificacao where tipo='lembrete_vencimento'"))[0].n, 1);
  });
  await caso('lembrete: fora da janela não avisa (vence em 10 dias)', async () => {
    dia('2026-10-31'); // vence em 10 dias; a notificação anterior já existe, então nada novo
    assert.equal((await rodar('paula', 'lembrete-vencimento')).criadas, 0);
  });
  await caso('cobrança: avisa só o atrasado com valor, multa e total; resume para presidente e tesoureiro', async () => {
    dia('2026-11-07');
    const r = await rodar('tiago', 'cobranca-atrasados');
    assert.equal(r.criadas, 1);
    const n = (await sql("select usuario_id, titulo, mensagem from notificacao where tipo='cobranca_atraso'"));
    assert.equal(n.length, 1); assert.equal(n[0].usuario_id, u.bruno);
    assert.equal(n[0].titulo, 'Mensalidade de 10/2026 em atraso');
    assert.match(n[0].mensagem, /venceu em 10\/10\/2026 \(28 dias de atraso\)\. Valor: R\$ 250,00 \+ multa de 5% \(R\$ 12,50\) = R\$ 262,50\./);
    const resumo = await sql("select usuario_id, email_status, mensagem from notificacao where tipo='resumo_rotina' order by usuario_id");
    assert.deepEqual(resumo.map((x) => x.usuario_id), [u.paula, u.tiago]); assert.ok(resumo.every((x) => x.email_status === 'dispensado'));
    assert.match(resumo[0].mensagem, /1 associado foi avisado.*R\$ 250,00/);
  });
  await caso('cobrança: no mesmo dia e dentro da mesma semana não repete; passada a faixa de 7 dias, cobra de novo', async () => {
    const porPessoa = async (id: number) => (await sql("select count(*)::int n from notificacao where tipo='cobranca_atraso' and usuario_id=$1", [id]))[0].n;
    assert.equal((await rodar('tiago', 'cobranca-atrasados')).criadas, 0);                    // 07/11: Bruno com 28 dias, faixa 3 (já cobrado)
    dia('2026-11-08'); assert.equal((await rodar('tiago', 'cobranca-atrasados')).criadas, 1); // 29 dias: faixa 4
    dia('2026-11-09'); assert.equal((await rodar('tiago', 'cobranca-atrasados')).criadas, 0); // 30 dias: ainda faixa 4
    assert.equal(await porPessoa(u.bruno), 2);
    dia('2026-11-14'); assert.equal((await rodar('tiago', 'cobranca-atrasados')).criadas, 1); // só a Ana: a de novembro venceu dia 10 (4 dias, faixa 0); Bruno segue na faixa 4
    assert.equal(await porPessoa(u.ana), 1); assert.equal(await porPessoa(u.bruno), 2);
    dia('2026-11-15'); assert.equal((await rodar('tiago', 'cobranca-atrasados')).criadas, 1); // 36 dias: Bruno na faixa 5; Ana continua na faixa 0
    assert.equal(await porPessoa(u.bruno), 3); assert.equal(await porPessoa(u.ana), 1);
  });
  await caso('cobrança: parar de cobrar quem pagou; estorno volta a cobrar', async () => {
    dia('2026-11-22'); // Bruno com 43 dias (faixa 6) e Ana com 12 (faixa 1), mas os dois pagam antes
    const ids = async (assocId: number, ref: string) => (await sql('select id from mensalidade where associado_id=$1 and referencia=$2', [assocId, ref]))[0].id;
    const pgBruno = (await sql("insert into pagamento(mensalidade_id, pago_em, valor, forma, conta_id) values($1,'2026-11-21',250,'pix',$2) returning id", [await ids(idBruno, '2026-10'), conta]))[0].id;
    await sql("insert into pagamento(mensalidade_id, pago_em, valor, forma, conta_id) values($1,'2026-11-21',250,'pix',$2)", [await ids(idAna, '2026-11'), conta]);
    assert.equal((await rodar('tiago', 'cobranca-atrasados')).criadas, 0);
    await sql('update pagamento set estornado_em = now() where id=$1', [pgBruno]);
    assert.equal((await rodar('tiago', 'cobranca-atrasados')).criadas, 1, 'só o Bruno volta a ser cobrado');
  });
  await caso('parâmetro 0 desliga a rotina; a tela de parâmetros grava e valida os limites', async () => {
    const atual = (await chamar('paula', 'GET', '/administracao/parametros')).json;
    assert.equal(atual.lembreteVencimentoDias, 3); assert.equal(atual.cobrancaIntervaloDias, 7);
    const put = (o: object) => chamar('paula', 'PUT', '/administracao/parametros', { ...atual, ...o });
    assert.equal((await put({ lembreteVencimentoDias: 31 })).status, 400);
    assert.equal((await put({ cobrancaIntervaloDias: -1 })).status, 400);
    assert.equal((await put({ cobrancaIntervaloDias: 0 })).status, 200);
    dia('2026-12-30'); const off = await rodar('paula', 'cobranca-atrasados');
    assert.equal(off.criadas, 0); assert.match(off.mensagem, /desligada/);
    assert.equal((await put({ cobrancaIntervaloDias: 7 })).status, 200);
    assert.equal((await chamar('tiago', 'PUT', '/administracao/parametros', atual)).status, 403, 'só o presidente altera parâmetros');
  });
  await caso('contratos a vencer: avisa o associado e a equipe uma vez por faixa e por data de término', async () => {
    dia('2026-11-07');
    await sql("insert into contrato(associado_id, inicio, fim, dias_semana, valor_por_dia) values($1,'2026-02-01','2026-11-27','{1,2,3,4,5}',50)", [idAna]); // 20 dias
    await sql("insert into contrato(associado_id, inicio, fim, dias_semana, valor_por_dia) values($1,'2026-02-01','2026-12-30','{1,2,3,4,5}',50)", [idBruno]); // 53 dias: fora
    const r = await rodar('paula', 'contratos-a-vencer');
    assert.equal(r.criadas, 4); // Ana + presidente + vice + auxiliar
    const n = await sql("select usuario_id, titulo from notificacao where tipo='contrato_a_vencer' order by usuario_id");
    assert.deepEqual(n.map((x) => x.usuario_id), [u.ana, u.paula, u.vera, u.aline].sort((a, b) => a - b));
    assert.equal(n.find((x) => x.usuario_id === u.ana)!.titulo, 'Seu contrato termina em 20 dias');
    assert.equal(n.find((x) => x.usuario_id === u.paula)!.titulo, 'Contrato de Ana termina em 20 dias');
    assert.equal((await rodar('paula', 'contratos-a-vencer')).criadas, 0, 'não repete');
    assert.ok(!n.some((x) => x.usuario_id === u.tiago || x.usuario_id === u.bruno), 'tesoureiro e Bruno não são avisados');
  });
  await caso('contratos a vencer: nos últimos 7 dias vem o aviso urgente; prorrogar abre novo ciclo', async () => {
    dia('2026-11-22'); // 5 dias
    assert.equal((await rodar('paula', 'contratos-a-vencer')).criadas, 4);
    assert.equal((await sql("select count(*)::int n from notificacao where tipo='contrato_a_vencer' and titulo like '%termina em 5 dias'"))[0].n, 4);
    await sql("update contrato set fim='2026-12-10' where associado_id=$1", [idAna]); // prorrogado: 18 dias
    assert.equal((await rodar('paula', 'contratos-a-vencer')).criadas, 4, 'nova data de término = novo aviso');
  });
  await caso('contrato encerrado não gera aviso (só o contrato vigente do Bruno entra na janela)', async () => {
    const idCtAna = (await sql('select id from contrato where associado_id=$1', [idAna]))[0].id;
    await sql("update contrato set status='encerrado' where id=$1", [idCtAna]);
    dia('2026-12-05'); // Ana terminaria em 10/12 (5 dias); Bruno termina em 30/12 (25 dias)
    const doContrato = async () => (await sql('select count(*)::int n from notificacao where chave like $1', [`contrato:c${idCtAna}:%`]))[0].n;
    const antes = await doContrato();
    const r = await rodar('paula', 'contratos-a-vencer');
    assert.equal(r.criadas, 4); // Bruno + presidente + vice + auxiliar
    assert.equal(await doContrato(), antes, 'nada novo para o contrato encerrado');
    assert.equal((await sql("select count(*)::int n from notificacao where tipo='contrato_a_vencer' and titulo like '%25 dias'"))[0].n, 4);
  });

  // =====================================================================
  // FALHA NA ENTREGA, REENVIO, TRAVA E HISTÓRICO
  // =====================================================================
  await caso('falha de e-mail: notificação do painel existe, entrega fica "falhou" com o motivo', async () => {
    falharPara = 'bruno@teste.com';
    const r = await chamar('paula', 'POST', '/comunicacao', { tipo: 'aviso', titulo: 'Teste de falha', mensagem: 'Sem e-mail para o Bruno.' });
    assert.equal(r.status, 201); await esperarEmails(r.json.id);
    const n = (await sql("select email_status, email_tentativas, email_erro from notificacao where comunicado_id=$1 and usuario_id=$2", [r.json.id, u.bruno]))[0];
    assert.deepEqual(n, { email_status: 'falhou', email_tentativas: 1, email_erro: 'SMTP fora do ar' });
    const lista = (await chamar('paula', 'GET', '/comunicacao')).json.itens.find((c: any) => c.id === r.json.id);
    assert.equal(lista.entregas.emailsFalharam, 1, 'a tela do gerente mostra a falha');
    assert.equal((await chamar('bruno', 'GET', '/comunicacao/notificacoes')).json.itens[0].titulo, 'Teste de falha', 'o painel do Bruno recebeu mesmo assim');
  });
  await caso('reenvio: tenta de novo as falhas, entrega quando o e-mail volta e para após 3 tentativas', async () => {
    const r = await rodar('paula', 'reenviar-emails'); // ainda fora do ar: tentativa 2
    assert.equal(r.ignoradas, 1); assert.equal((await sql("select email_tentativas t from notificacao where email_status='falhou'"))[0].t, 2);
    await rodar('paula', 'reenviar-emails'); // tentativa 3
    assert.equal((await sql("select email_tentativas t from notificacao where email_status='falhou'"))[0].t, 3);
    assert.equal((await rodar('paula', 'reenviar-emails')).ignoradas, 0, 'depois de 3 tentativas desiste');
    falharPara = null;
    await sql("update notificacao set email_tentativas = 1 where email_status = 'falhou'");
    const ok = await rodar('paula', 'reenviar-emails'); assert.equal(ok.criadas, 1);
    assert.equal((await sql("select email_status from notificacao where usuario_id=$1 order by id desc limit 1", [u.bruno]))[0].email_status, 'enviado');
  });
  await caso('sem SMTP configurado: a entrega é registrada como "sem_smtp", não como falha', async () => {
    semSmtp = true;
    const r = await chamar('paula', 'POST', '/comunicacao', { tipo: 'aviso', titulo: 'Sem SMTP', mensagem: 'Ambiente de desenvolvimento.', destinatarioId: idAna });
    await esperarEmails(r.json.id); semSmtp = false;
    assert.equal((await sql('select email_status s from notificacao where comunicado_id=$1', [r.json.id]))[0].s, 'sem_smtp');
  });
  await caso('trava: com outra rotina em execução a segunda é recusada (409) e depois libera', async () => {
    const outro = new Client({ connectionString: url }); await outro.connect();
    await outro.query('select pg_advisory_lock(740006)');
    const r = await chamar('paula', 'POST', '/comunicacao/rotinas/lembrete-vencimento/executar');
    assert.equal(r.status, 409); assert.match(r.json.message, /Já existe uma rotina em execução/);
    await outro.query('select pg_advisory_unlock(740006)'); await outro.end();
    assert.equal((await chamar('paula', 'POST', '/comunicacao/rotinas/lembrete-vencimento/executar')).status, 200);
    assert.equal((await chamar('paula', 'POST', '/comunicacao/rotinas/inexistente/executar')).status, 404);
  });
  await caso('histórico: cada rotina mostra a última execução, a origem e quem rodou; estado do SMTP e do agendamento', async () => {
    const s = (await chamar('tiago', 'GET', '/comunicacao/rotinas')).json;
    assert.equal(s.smtpConfigurado, false); assert.equal(s.agendamento, 'desligado');
    assert.deepEqual(s.rotinas.map((r: any) => r.id), ['lembrete-vencimento', 'cobranca-atrasados', 'contratos-a-vencer', 'reenviar-emails']);
    assert.ok(s.rotinas.every((r: any) => r.ultima && r.ultima.origem === 'manual' && r.ultima.concluidaEm && r.ultima.erro === null));
    assert.equal((await sql('select count(*)::int n from rotina_execucao where por is not null'))[0].n >= 10, true);
  });
  await caso('o agendador diário executa todas as rotinas como "agendada" (e respeita ROTINAS_AUTOMATICAS=false)', async () => {
    const { RotinasService } = await import('../src/modules/comunicacao/rotinas.service');
    const svc = app.get(RotinasService);
    await svc.diarias(); assert.equal((await sql("select count(*)::int n from rotina_execucao where origem='agendada'"))[0].n, 0, 'desligado: não roda');
    process.env.ROTINAS_AUTOMATICAS = 'true'; dia('2026-12-30');
    await svc.diarias(); process.env.ROTINAS_AUTOMATICAS = 'false';
    assert.deepEqual((await sql("select rotina from rotina_execucao where origem='agendada' order by id")).map((r) => r.rotina), ['lembrete-vencimento', 'cobranca-atrasados', 'contratos-a-vencer', 'reenviar-emails']);
    const { SchedulerRegistry } = await import('@nestjs/schedule');
    assert.equal(app.get(SchedulerRegistry).getCronJob('rotinas-diarias').running, true, 'tarefa registrada no agendador');
  });

  await app.close(); await pg.end();
  console.log(`\n${total - falhas}/${total} casos aprovados${falhas ? `, ${falhas} com erro` : ''}`);
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
