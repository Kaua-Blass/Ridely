import { post } from '../../lib/api';

export const concluir = (token: string, senha: string, telefone?: string) =>
  post<{ mensagem: string }>('/auth/concluir-cadastro', { token, senha, telefone });
