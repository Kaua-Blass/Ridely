import assert from 'node:assert/strict';
import { mensalidadeProporcional, versoes } from '../src/modules/contratos/calculo';

// uso: npm test   (não precisa de banco)
const seg = [1, 2, 3, 4, 5];
const base = (inicio: string, dias = seg, valor = 50) => ({ inicio, dias_semana: dias, valor_por_dia: valor });
const total = (ref: string, inicio: string, fim: string, vs: ReturnType<typeof versoes>) => mensalidadeProporcional(ref, inicio, fim, vs).total;

const caso = (nome: string, fn: () => void) => { fn(); console.log('ok  -', nome); };

caso('mês inteiro: 5 dias × R$ 50 = R$ 250', () => assert.equal(total('2026-11', '2026-02-01', '2027-12-31', versoes(base('2026-02-01'), [])), 250));
caso('mês inteiro: 3 dias × R$ 50 = R$ 150', () => assert.equal(total('2026-11', '2026-02-01', '2027-12-31', versoes(base('2026-02-01', [1, 3, 5]), [])), 150));
caso('contrato começa dia 16 de nov (15 de 30 dias)', () => assert.equal(total('2026-11', '2026-11-16', '2027-12-31', versoes(base('2026-11-16'), [])), 125));
caso('contrato termina dia 10 de nov (10 de 30 dias)', () => assert.equal(total('2026-11', '2026-02-01', '2026-11-10', versoes(base('2026-02-01'), [])), 83.33));
caso('aditivo dia 11 troca 5 dias por 3 dias', () => {
  const vs = versoes(base('2026-02-01'), [{ vigencia_a_partir: '2026-11-11', novos_dias: [1, 3, 5], novo_valor_por_dia: null }]);
  const r = mensalidadeProporcional('2026-11', '2026-02-01', '2027-12-31', vs);
  assert.equal(r.total, 183.33); // 10/30 de R$ 250 + 20/30 de R$ 150
  assert.equal(r.segmentos.length, 2);
});
caso('aditivo muda o valor por dia no meio do mês', () => {
  const vs = versoes(base('2026-02-01', [1, 3, 5]), [{ vigencia_a_partir: '2026-11-16', novos_dias: null, novo_valor_por_dia: 60 }]);
  assert.equal(total('2026-11', '2026-02-01', '2027-12-31', vs), 165); // 15/30 de R$ 150 + 15/30 de R$ 180
});
caso('aditivo que só prorroga o fim não cria versão nova', () => {
  const vs = versoes(base('2026-02-01'), [{ vigencia_a_partir: '2026-11-11', novos_dias: null, novo_valor_por_dia: null }]);
  assert.equal(vs.length, 1);
  assert.equal(total('2026-11', '2026-02-01', '2027-12-31', vs), 250);
});
caso('mês fora do contrato = 0', () => {
  const vs = versoes(base('2026-02-01'), []);
  assert.equal(total('2026-01', '2026-02-01', '2026-12-31', vs), 0);
  assert.equal(total('2027-01', '2026-02-01', '2026-12-31', vs), 0);
});
caso('fevereiro tem 28 dias (2027)', () => {
  assert.equal(total('2027-02', '2026-02-01', '2027-12-31', versoes(base('2026-02-01'), [])), 250);
  assert.equal(total('2027-02', '2027-02-15', '2027-12-31', versoes(base('2027-02-15'), [])), 125); // 14 de 28 dias
});
caso('fevereiro de ano bissexto tem 29 dias (2028): 14 de 29 dias', () => assert.equal(total('2028-02', '2028-02-16', '2028-12-31', versoes(base('2028-02-16'), [])), 120.69));
caso('dois aditivos no mesmo mês', () => {
  const vs = versoes(base('2026-02-01'), [
    { vigencia_a_partir: '2026-11-11', novos_dias: [1, 2, 3], novo_valor_por_dia: null },
    { vigencia_a_partir: '2026-11-21', novos_dias: [1], novo_valor_por_dia: null },
  ]);
  assert.equal(total('2026-11', '2026-02-01', '2027-12-31', vs), 150); // 10/30×250 + 10/30×150 + 10/30×50 = 83.33+50+16.67
});
console.log('todos os testes do cálculo passaram');
