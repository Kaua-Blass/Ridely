import { api, post } from '../../lib/api';

export type StatusMens = 'baixado' | 'em_aberto' | 'atrasado' | 'cancelada';
export interface MensalidadeItem {
  id: number; associadoId: number; associado: string; referencia: string; vencimento: string; valor: number; status: StatusMens; multaDevida: number; totalAPagar: number;
  pagamentoId: number | null; pagoEm: string | null; pagoTotal: number | null; forma: string | null; conta: string | null; canceladaMotivo: string | null;
}
export interface ListaMensalidades { itens: MensalidadeItem[]; total: number; limite: number; multaPercentual: number }
export interface Resumo { abertas: { qtd: number; valor: number }; atrasadas: { qtd: number; valor: number; multa: number }; recebidasNoMes: { qtd: number; valor: number } }
export interface Filtro { busca?: string; referencia?: string; status?: string; de?: string; ate?: string }
export interface ContaResumo { id: number; nome: string; tipo: string; saldo: number; ativa: boolean }
type Msg = { mensagem: string };

export const mensalidades = (f: Filtro) => {
  const q = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v) q.set(k, v); });
  return api<ListaMensalidades>(`/financeiro/mensalidades?${q}`);
};
export const resumo = () => api<Resumo>('/financeiro/resumo');
export const contasAtivas = () => api<ContaResumo[]>('/controles-financeiros/contas').then((l) => l.filter((c) => c.ativa));
export const gerar = (referencia: string) => post<Msg>('/financeiro/mensalidades/gerar', { referencia });
export const baixar = (id: number, d: { data: string; forma: string; contaId: number; dispensarMulta?: boolean; motivo?: string }) => post<Msg>(`/financeiro/mensalidades/${id}/baixa`, d);
export const estornar = (pagamentoId: number, motivo: string) => post<Msg>(`/financeiro/pagamentos/${pagamentoId}/estornar`, { motivo });
export const cancelar = (id: number, motivo: string) => post<Msg>(`/financeiro/mensalidades/${id}/cancelar`, { motivo });
export const reativar = (id: number) => post<Msg>(`/financeiro/mensalidades/${id}/reativar`);
export const urlRecibo = (pagamentoId: number) => `/api/financeiro/recibos/${pagamentoId}`;
