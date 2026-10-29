/** Regras puras da comunicação e das rotinas: sem banco e sem relógio, por isso testáveis em test/rotinas.test.ts. */

export const TIPOS = ['aviso', 'noticia', 'rota', 'cobranca'] as const;
export type TipoComunicado = (typeof TIPOS)[number];
export const ROTULO_TIPO: Record<TipoComunicado, string> = { aviso: 'Aviso', noticia: 'Notícia', rota: 'Rota', cobranca: 'Cobrança' };
/** O tesoureiro só envia cobrança e aviso; presidente e vice enviam qualquer tipo. */
export const TIPOS_TESOUREIRO: TipoComunicado[] = ['aviso', 'cobranca'];

export type TipoNotificacao = 'comunicado' | 'lembrete_vencimento' | 'cobranca_atraso' | 'contrato_a_vencer' | 'resumo_rotina';

/** Quantas vezes o sistema tenta entregar um e-mail que falhou. */
export const MAX_TENTATIVAS_EMAIL = 3;
/** Faixa "urgente" do aviso de contrato: faltam este número de dias ou menos. */
export const DIAS_URGENTE_CONTRATO = 7;

const arred = (v: number) => Math.round(v * 100) / 100;
export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ');
export const dataBr = (iso: string) => iso.split('-').reverse().join('/');
export const refBr = (r: string) => `${r.slice(5)}/${r.slice(0, 4)}`;

/** Resumo curto da mensagem para o painel (a mensagem inteira fica no comunicado). */
export function resumir(texto: string, max = 160): string {
  const t = texto.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Lembrete: vale de `antecedencia` dias antes até o próprio dia do vencimento. 0 desliga a rotina. */
export function dentroDoLembrete(diasParaVencer: number, antecedencia: number): boolean {
  return antecedencia > 0 && diasParaVencer >= 0 && diasParaVencer <= antecedencia;
}

/** Cobrança: uma por faixa de `intervalo` dias de atraso (faixa 0 = 1º ao `intervalo`-ésimo dia). Vale mesmo se o servidor ficou parado dias. 0 desliga. */
export function faixaCobranca(diasAtraso: number, intervalo: number): number | null {
  if (intervalo <= 0 || diasAtraso < 1) return null;
  return Math.floor((diasAtraso - 1) / intervalo);
}

/** Contrato: 'aviso' dentro do prazo do parâmetro; 'urgente' nos últimos dias (se o prazo for maior que isso). null = nada a avisar. */
export function faixaContrato(diasParaFim: number, alertaDias: number): 'aviso' | 'urgente' | null {
  if (alertaDias <= 0 || diasParaFim < 0 || diasParaFim > alertaDias) return null;
  return diasParaFim <= DIAS_URGENTE_CONTRATO && alertaDias > DIAS_URGENTE_CONTRATO ? 'urgente' : 'aviso';
}

export const prazo = (dias: number) => (dias <= 0 ? 'vence hoje' : dias === 1 ? 'vence amanhã' : `vence em ${dias} dias`);
export const prazoContrato = (dias: number) => (dias <= 0 ? 'termina hoje' : dias === 1 ? 'termina amanhã' : `termina em ${dias} dias`);

// ---------- chaves de deduplicação (uma por pessoa e motivo) ----------
export const chaveLembrete = (mensalidadeId: number) => `lembrete:m${mensalidadeId}`;
export const chaveCobranca = (mensalidadeId: number, faixa: number) => `cobranca:m${mensalidadeId}:f${faixa}`;
export const chaveContrato = (contratoId: number, fim: string, faixa: string) => `contrato:c${contratoId}:${fim}:${faixa}`;
export const chaveResumo = (rotina: string, dia: string) => `resumo:${rotina}:${dia}`;

// ---------- textos ----------
export function textoLembrete(m: { referencia: string; vencimento: string; valor: number }, diasParaVencer: number, multaPct: number) {
  return {
    titulo: `Sua mensalidade ${prazo(diasParaVencer)}`,
    mensagem: `A mensalidade de ${refBr(m.referencia)}, no valor de ${brl(m.valor)}, vence em ${dataBr(m.vencimento)}.`
      + (multaPct > 0 ? ` Pagando depois do vencimento, incide multa de ${multaPct}%.` : ''),
  };
}
export function textoCobranca(m: { referencia: string; vencimento: string; valor: number }, diasAtraso: number, multaPct: number) {
  const multa = arred((m.valor * multaPct) / 100);
  const dias = diasAtraso === 1 ? '1 dia de atraso' : `${diasAtraso} dias de atraso`;
  return {
    titulo: `Mensalidade de ${refBr(m.referencia)} em atraso`,
    mensagem: `A mensalidade de ${refBr(m.referencia)} venceu em ${dataBr(m.vencimento)} (${dias}). Valor: ${brl(m.valor)}`
      + (multa > 0 ? ` + multa de ${multaPct}% (${brl(multa)}) = ${brl(arred(m.valor + multa))}.` : '.')
      + ' Procure a tesouraria para regularizar.',
  };
}
export function textoContratoAssociado(fim: string, diasParaFim: number) {
  return {
    titulo: `Seu contrato ${prazoContrato(diasParaFim)}`,
    mensagem: `Seu contrato de transporte termina em ${dataBr(fim)}. Para renovar, fale com a associação ou peça a alteração na tela Contratos.`,
  };
}
export function textoContratoEquipe(nome: string, fim: string, diasParaFim: number) {
  return {
    titulo: `Contrato de ${nome} ${prazoContrato(diasParaFim)}`,
    mensagem: `O contrato de ${nome} termina em ${dataBr(fim)}. Avalie a renovação (botão Prorrogar na tela Contratos).`,
  };
}
export function textoResumoCobranca(notificados: number, total: number) {
  return {
    titulo: 'Cobrança automática executada',
    mensagem: `${notificados} ${notificados === 1 ? 'associado foi avisado' : 'associados foram avisados'} de mensalidades em atraso, somando ${brl(total)} em mensalidades.`,
  };
}
