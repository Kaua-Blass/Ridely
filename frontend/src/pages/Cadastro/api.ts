import { api, post } from '../../lib/api';

export interface Instituicao { id: number; nome: string }
export const instituicoes = () => api<Instituicao[]>('/veiculos-rotas/instituicoes');
export const cadastrar = (dados: { nome: string; email: string; cpf?: string; telefone?: string; instituicaoId: number; senha: string }) =>
  post<{ mensagem: string }>('/auth/cadastro', dados);
