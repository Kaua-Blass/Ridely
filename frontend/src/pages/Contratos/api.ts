import { api, del, patch, post } from '../../lib/api';

export type Situacao = 'agendado' | 'vigente' | 'a_renovar' | 'vencido' | 'encerrado';
export interface ContratoItem {
  id: number; associadoId: number; associado: string; inicio: string; fim: string; status: 'vigente' | 'encerrado'; situacao: Situacao; diasParaVencer: number;
  diasAtuais: number[]; valorDiaAtual: number; mensalidadeAtual: number; aditivos: number; temPdf: boolean; pdfNome: string | null; podeEditarDireto: boolean;
}
export interface AditivoItem { id: number; vigenciaAPartir: string; novoFim: string | null; novosDias: number[] | null; novoValorPorDia: string | null; observacao: string | null; criadoEm: string; criadoPor: string | null }
export interface ContratoDetalhe extends ContratoItem { aditivosLista: AditivoItem[] }
export interface Segmento { de: string; ate: string; dias: number[]; valorDia: number; diasNoSegmento: number; diasNoMes: number; valor: number }
export interface Previa { referencia: string; total: number; segmentos: Segmento[] }
export interface Solicitacao {
  id: number; status: 'pendente' | 'aprovada' | 'rejeitada'; criadoEm: string; associado: string;
  dados: { contratoId: number; novosDias: number[]; vigenciaAPartir: string; observacao: string | null; motivo?: string };
}
export interface DadosContrato { inicio: string; fim: string; diasSemana: number[]; valorPorDia?: number }
export interface DadosAditivo { vigenciaAPartir: string; novosDias?: number[]; novoValorPorDia?: number; novoFim?: string; observacao?: string }
type Msg = { mensagem: string };

export const listar = () => api<ContratoItem[]>('/contratos');
export const detalhe = (id: number) => api<ContratoDetalhe>(`/contratos/${id}`);
export const previa = (id: number, referencia: string) => api<Previa>(`/contratos/${id}/previa-mensalidade?referencia=${referencia}`);
export const criar = (d: DadosContrato & { associadoId: number }) => post<Msg>('/contratos', d);
export const editar = (id: number, d: DadosContrato) => patch<Msg>(`/contratos/${id}`, d);
export const aditivar = (id: number, d: DadosAditivo) => post<Msg>(`/contratos/${id}/aditivos`, d);
export const encerrar = (id: number, data: string) => post<Msg>(`/contratos/${id}/encerrar`, { data });
export const enviarPdf = (id: number, arquivo: File) => {
  const f = new FormData();
  f.append('arquivo', arquivo);
  return api<Msg>(`/contratos/${id}/pdf`, { method: 'POST', body: f });
};
export const removerPdf = (id: number) => del<Msg>(`/contratos/${id}/pdf`);
export const urlPdf = (id: number) => `/api/contratos/${id}/pdf`;
export const solicitacoes = () => api<Solicitacao[]>('/contratos/solicitacoes');
export const solicitar = (d: { contratoId: number; novosDias: number[]; vigenciaAPartir: string; observacao?: string }) => post<Msg>('/contratos/solicitacoes', d);
export const decidir = (id: number, aprovar: boolean, motivo?: string) => post<Msg>(`/contratos/solicitacoes/${id}/decisao`, { aprovar, motivo });
