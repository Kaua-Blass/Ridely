import { api, del, patch, post } from '../../lib/api';
import type { Comunicado, Destinatario, Pagina, PaginaNotificacoes, SituacaoRotinas } from './types';

// ---- comunicados
export const comunicados = (pagina = 1) => api<Pagina<Comunicado>>(`/comunicacao?pagina=${pagina}&porPagina=10`);
export const destinatarios = () => api<Destinatario[]>('/comunicacao/destinatarios');
export interface NovoComunicado { tipo: string; titulo: string; mensagem: string; destinatarioId: number | null; enviarEmail: boolean }
export const criarComunicado = (d: NovoComunicado) => post<{ id: number; mensagem: string }>('/comunicacao', d);
export const editarComunicado = (id: number, d: { tipo: string; titulo: string; mensagem: string }) => patch<{ mensagem: string }>(`/comunicacao/${id}`, d);
export const removerComunicado = (id: number) => del<{ mensagem: string }>(`/comunicacao/${id}`);
export const enviarAnexo = (id: number, arquivo: File) => {
  const f = new FormData();
  f.append('arquivo', arquivo);
  return api<{ mensagem: string }>(`/comunicacao/${id}/anexo`, { method: 'POST', body: f });
};
export const removerAnexo = (id: number) => del<{ mensagem: string }>(`/comunicacao/${id}/anexo`);
export const urlAnexo = (id: number) => `/api/comunicacao/${id}/anexo`;

// ---- notificações do painel
export const notificacoes = (pagina = 1, apenasNaoLidas = false) => api<PaginaNotificacoes>(`/comunicacao/notificacoes?pagina=${pagina}&porPagina=15${apenasNaoLidas ? '&apenasNaoLidas=true' : ''}`);
export const resumoNotificacoes = () => api<{ naoLidas: number }>('/comunicacao/notificacoes/resumo');
export const marcarLida = (id: number) => post<{ naoLidas: number }>(`/comunicacao/notificacoes/${id}/lida`);
export const marcarTodasLidas = () => post<{ marcadas: number }>('/comunicacao/notificacoes/lidas');
/** Avisa o sino do menu que o contador mudou. */
export const atualizarSino = () => window.dispatchEvent(new Event('ridely:notificacoes'));

// ---- rotinas automáticas
export const rotinas = () => api<SituacaoRotinas>('/comunicacao/rotinas');
export const executarRotina = (id: string) => post<{ criadas: number; ignoradas: number; mensagem: string }>(`/comunicacao/rotinas/${id}/executar`);
