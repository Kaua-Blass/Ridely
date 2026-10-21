import { api, post } from '../../lib/api';

export interface Solicitacao {
  id: number; tipo: string; criadoEm: string; emailVerificado: boolean;
  dados: { nome: string; email: string; telefone: string | null; instituicaoId: number };
}
export const solicitacoes = () => api<Solicitacao[]>('/administracao/solicitacoes');
export const decidir = (id: number, aprovar: boolean) => post<{ mensagem: string }>(`/administracao/solicitacoes/${id}/decisao`, { aprovar });
