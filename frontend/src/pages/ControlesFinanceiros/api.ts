import { api, del, patch, post } from '../../lib/api';

export interface Conta {
  id: number; nome: string; tipo: 'caixa' | 'banco'; banco: string | null; agencia: string | null; numero: string | null; digito: string | null; tipoConta: string | null;
  chavePix: string | null; titular: string | null; observacoes: string | null; saldoInicial: number; saldo: number; ativa: boolean; movimentacoes: number;
}
export interface ResumoGeral { saldoTotal: number; receitasDoMes: number; despesasDoMes: number; contas: Conta[] }
export interface Movimentacao {
  id: number; data: string; tipo: 'receita' | 'despesa' | 'transferencia_entrada' | 'transferencia_saida' | 'estorno'; sinal: 1 | -1; categoria: string; historico: string; valor: number;
  saldoApos: number; conta: string; contaId: number; pagamentoId: number | null; estornaId: number | null; associado: string | null; responsavel: string | null; estornada: boolean;
}
export interface PaginaMov { itens: Movimentacao[]; total: number; pagina: number; porPagina: number; receitas: number; despesas: number }
export interface FiltroMov { contaId?: string; tipo?: string; categoria?: string; de?: string; ate?: string; busca?: string; ordem?: string; pagina?: number }
export interface DadosConta { nome: string; tipo: string; banco?: string; agencia?: string; numero?: string; digito?: string; tipoConta?: string; chavePix?: string; titular?: string; observacoes?: string; saldoInicial?: number }
export interface DadosLancamento { data: string; categoria: string; descricao: string; valor: number; contaId: number; associadoId?: number; observacao?: string }
export interface DadosTransferencia { data: string; origemId: number; destinoId: number; valor: number; historico: string }
type Msg = { mensagem: string };

export const resumo = () => api<ResumoGeral>('/controles-financeiros/resumo');
export const contas = () => api<Conta[]>('/controles-financeiros/contas');
export const categorias = () => api<{ receitas: string[]; despesas: string[] }>('/controles-financeiros/categorias');
export const movimentacoes = (f: FiltroMov) => {
  const q = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
  return api<PaginaMov>(`/controles-financeiros/movimentacoes?${q}`);
};
export const criarConta = (d: DadosConta) => post<Msg>('/controles-financeiros/contas', d);
export const atualizarConta = (id: number, d: DadosConta) => patch<Msg>(`/controles-financeiros/contas/${id}`, d);
export const situacaoConta = (id: number, ativa: boolean) => post<Msg>(`/controles-financeiros/contas/${id}/situacao`, { ativa });
export const removerConta = (id: number) => del<Msg>(`/controles-financeiros/contas/${id}`);
export const lancar = (tipo: 'receita' | 'despesa', d: DadosLancamento) => post<Msg>(`/controles-financeiros/${tipo === 'receita' ? 'receitas' : 'despesas'}`, d);
export const transferir = (d: DadosTransferencia) => post<Msg>('/controles-financeiros/transferencias', d);
export const estornar = (id: number, motivo: string) => post<Msg>(`/controles-financeiros/movimentacoes/${id}/estornar`, { motivo });
