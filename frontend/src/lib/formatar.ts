export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
/** 'AAAA-MM-DD' → 'DD/MM/AAAA' sem passar por Date (evita o deslocamento de fuso). */
export const dataBr = (iso: string) => iso.split('-').reverse().join('/');
const NOMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const diasTexto = (dias: number[]) => dias.map((d) => NOMES[d]).join(', ');
export const hojeIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
/** 'AAAA-MM' → 'MM/AAAA'. */
export const refBr = (r: string) => `${r.slice(5)}/${r.slice(0, 4)}`;
export const FORMAS: [string, string][] = [['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['transferencia', 'Transferência bancária'], ['cartao', 'Cartão']];
export const formaNome = (f: string | null) => FORMAS.find(([k]) => k === f)?.[1] ?? f ?? '—';
