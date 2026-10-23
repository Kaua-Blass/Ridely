/** Cálculo da mensalidade proporcional ao contrato. Funções puras, sem banco. */

export interface Versao { desde: string; dias: number[]; valorDia: number }
export interface Segmento { de: string; ate: string; dias: number[]; valorDia: number; diasNoSegmento: number; diasNoMes: number; valor: number }
export interface AditivoCalc { vigencia_a_partir: string; novos_dias: number[] | null; novo_valor_por_dia: string | number | null }

const asc = (a: number, b: number) => a - b;

/** Linha do tempo do contrato: a versão inicial e uma nova versão a cada aditivo que muda dias ou valor. */
export function versoes(base: { inicio: string; dias_semana: number[]; valor_por_dia: string | number }, aditivos: AditivoCalc[]): Versao[] {
  const v: Versao[] = [{ desde: base.inicio, dias: [...base.dias_semana].sort(asc), valorDia: Number(base.valor_por_dia) }];
  for (const a of aditivos) { // já ordenados por vigência e criação
    if (a.novos_dias == null && a.novo_valor_por_dia == null) continue;
    const ant = v[v.length - 1];
    v.push({
      desde: a.vigencia_a_partir,
      dias: a.novos_dias ? [...a.novos_dias].sort(asc) : ant.dias,
      valorDia: a.novo_valor_por_dia != null ? Number(a.novo_valor_por_dia) : ant.valorDia,
    });
  }
  return v;
}

export function versaoEm(vs: Versao[], data: string): Versao | null {
  let r: Versao | null = null;
  for (const x of vs) if (x.desde <= data) r = x;
  return r;
}

/**
 * Mensalidade de um mês (AAAA-MM). Cada dia do mês em que o contrato está em vigor vale
 * (dias por semana × valor por dia) ÷ dias do mês, com a versão do contrato daquele dia.
 * Mês inteiro e sem mudança: dias por semana × valor por dia. Início, fim ou aditivo no meio do mês: proporcional.
 */
export function mensalidadeProporcional(referencia: string, inicio: string, fim: string, vs: Versao[]): { total: number; segmentos: Segmento[] } {
  const [ano, mes] = referencia.split('-').map(Number);
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const blocos: { v: Versao; de: string; ate: string; n: number }[] = [];
  for (let d = 1; d <= diasNoMes; d++) {
    const data = `${referencia}-${String(d).padStart(2, '0')}`;
    if (data < inicio || data > fim) continue;
    const v = versaoEm(vs, data);
    if (!v) continue;
    const ult = blocos[blocos.length - 1];
    if (ult && ult.v === v) { ult.ate = data; ult.n++; } else blocos.push({ v, de: data, ate: data, n: 1 });
  }
  const segmentos = blocos.map((b) => ({
    de: b.de, ate: b.ate, dias: b.v.dias, valorDia: b.v.valorDia, diasNoSegmento: b.n, diasNoMes,
    valor: Math.round((b.n * b.v.dias.length * Math.round(b.v.valorDia * 100)) / diasNoMes) / 100,
  }));
  return { total: Math.round(segmentos.reduce((s, x) => s + x.valor, 0) * 100) / 100, segmentos };
}
