import { api, del, patch, post } from '../../lib/api';
import type { Usuario } from '../../lib/auth';

export interface PerfilCompleto extends Usuario {
  cargo: string | null; instituicaoId: number | null; instituicao: string | null; rota: string | null; pontoEmbarque: string | null;
}
export const obter = () => api<PerfilCompleto>('/perfil');
export const atualizar = (d: { nome: string; telefone?: string; endereco?: string; contatoEmergencia?: string; instituicaoId?: number }) =>
  patch<{ mensagem: string }>('/perfil', d);
export const trocarSenha = (senhaAtual: string, novaSenha: string) => post<{ mensagem: string }>('/perfil/senha', { senhaAtual, novaSenha });
export const trocarEmail = (novoEmail: string, senhaAtual: string) => post<{ mensagem: string }>('/perfil/email', { novoEmail, senhaAtual });
export const enviarFoto = (arquivo: File) => {
  const f = new FormData();
  f.append('foto', arquivo);
  return api<{ mensagem: string }>('/perfil/foto', { method: 'POST', body: f });
};
export const removerFoto = () => del<{ mensagem: string }>('/perfil/foto');
