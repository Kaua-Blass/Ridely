import assert from 'node:assert/strict';
import {
  chaveCobranca, chaveContrato, chaveLembrete, dentroDoLembrete, faixaCobranca, faixaContrato, prazo, prazoContrato, resumir,
  textoCobranca, textoLembrete,
} from '../src/modules/comunicacao/regras';

// uso: npm test   (não precisa de banco)
const caso = (nome: string, fn: () => void) => { fn(); console.log('ok  -', nome); };

caso('lembrete: vale do próprio dia até N dias antes; 0 desliga', () => {
  assert.equal(dentroDoLembrete(0, 3), true);
  assert.equal(dentroDoLembrete(3, 3), true);
  assert.equal(dentroDoLembrete(4, 3), false);
  assert.equal(dentroDoLembrete(-1, 3), false, 'já venceu: é caso de cobrança, não de lembrete');
  assert.equal(dentroDoLembrete(1, 0), false);
});
caso('cobrança: uma faixa a cada 7 dias de atraso, a partir do 1º dia', () => {
  assert.equal(faixaCobranca(0, 7), null, 'vence hoje: ainda não é atraso');
  assert.equal(faixaCobranca(1, 7), 0);
  assert.equal(faixaCobranca(7, 7), 0);
  assert.equal(faixaCobranca(8, 7), 1);
  assert.equal(faixaCobranca(14, 7), 1);
  assert.equal(faixaCobranca(15, 7), 2);
  assert.equal(faixaCobranca(28, 7), 3);
  assert.equal(faixaCobranca(29, 7), 4);
});
caso('cobrança: intervalo 0 desliga; intervalo 1 cobra todo dia', () => {
  assert.equal(faixaCobranca(10, 0), null);
  assert.equal(faixaCobranca(3, 1), 2);
});
caso('contrato: aviso dentro do prazo, urgente nos últimos 7 dias, nada fora', () => {
  assert.equal(faixaContrato(31, 30), null);
  assert.equal(faixaContrato(30, 30), 'aviso');
  assert.equal(faixaContrato(8, 30), 'aviso');
  assert.equal(faixaContrato(7, 30), 'urgente');
  assert.equal(faixaContrato(0, 30), 'urgente');
  assert.equal(faixaContrato(-1, 30), null, 'já terminou');
  assert.equal(faixaContrato(5, 0), null, 'alerta desligado');
});
caso('contrato: prazo de alerta curto (7 dias ou menos) nunca vira "urgente" separado', () => {
  assert.equal(faixaContrato(5, 7), 'aviso');
  assert.equal(faixaContrato(3, 5), 'aviso');
});
caso('chaves de deduplicação: mudam com a faixa e com a data de término, não com o dia da execução', () => {
  assert.equal(chaveLembrete(12), 'lembrete:m12');
  assert.equal(chaveCobranca(12, 3), 'cobranca:m12:f3');
  assert.notEqual(chaveCobranca(12, 3), chaveCobranca(12, 4));
  assert.equal(chaveContrato(5, '2026-12-10', 'aviso'), 'contrato:c5:2026-12-10:aviso');
  assert.notEqual(chaveContrato(5, '2026-12-10', 'aviso'), chaveContrato(5, '2026-12-31', 'aviso'), 'prorrogar abre novo ciclo');
});
caso('prazos em português', () => {
  assert.equal(prazo(0), 'vence hoje'); assert.equal(prazo(1), 'vence amanhã'); assert.equal(prazo(3), 'vence em 3 dias');
  assert.equal(prazoContrato(0), 'termina hoje'); assert.equal(prazoContrato(1), 'termina amanhã'); assert.equal(prazoContrato(20), 'termina em 20 dias');
});
caso('texto da cobrança: valor + multa de 5% = total', () => {
  const t = textoCobranca({ referencia: '2026-10', vencimento: '2026-10-10', valor: 250 }, 28, 5);
  assert.equal(t.titulo, 'Mensalidade de 10/2026 em atraso');
  assert.match(t.mensagem, /venceu em 10\/10\/2026 \(28 dias de atraso\)\. Valor: R\$ 250,00 \+ multa de 5% \(R\$ 12,50\) = R\$ 262,50\./);
  assert.match(textoCobranca({ referencia: '2026-10', vencimento: '2026-10-10', valor: 250 }, 1, 5).mensagem, /\(1 dia de atraso\)/);
});
caso('texto da cobrança sem multa e arredondamento de centavos', () => {
  assert.doesNotMatch(textoCobranca({ referencia: '2026-10', vencimento: '2026-10-10', valor: 250 }, 3, 0).mensagem, /multa/);
  assert.match(textoCobranca({ referencia: '2026-10', vencimento: '2026-10-10', valor: 183.33 }, 3, 5).mensagem, /multa de 5% \(R\$ 9,17\) = R\$ 192,50\./);
});
caso('texto do lembrete', () => {
  const t = textoLembrete({ referencia: '2026-11', vencimento: '2026-11-10', valor: 250 }, 3, 5);
  assert.equal(t.titulo, 'Sua mensalidade vence em 3 dias');
  assert.match(t.mensagem, /11\/2026.*R\$ 250,00.*10\/11\/2026.*multa de 5%/);
  assert.doesNotMatch(textoLembrete({ referencia: '2026-11', vencimento: '2026-11-10', valor: 250 }, 0, 0).mensagem, /multa/);
});
caso('resumo da mensagem para o painel', () => {
  assert.equal(resumir('  curto   e\n bom '), 'curto e bom');
  const r = resumir('a'.repeat(300));
  assert.equal(r.length, 160); assert.ok(r.endsWith('…'));
});
console.log('todos os testes das rotinas passaram');
