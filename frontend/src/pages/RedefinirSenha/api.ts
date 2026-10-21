import { post } from '../../lib/api';

export const redefinir = (token: string, senha: string) => post<{ mensagem: string }>('/auth/redefinir-senha', { token, senha });
