import { api, patch, post, put } from '../../lib/api';
import type { Perfil } from '../../lib/permissoes';

export interface Solicitacao {
  id: number; tipo: string; criadoEm: string; emailVerificado: boolean;
  dados: { nome: string; email: string; telefone: string | null; instituicaoId: number };
}
export interface UsuarioAdm { id: number; nome: string; email: string; perfil: Perfil; ativo: boolean; ultimoAcesso: string | null; emailVerificado: boolean; cargo: string | null }
export interface Parametros { valorPorDia: number; multaPercentual: number; alertaRenovacaoDias: number }
export interface RegistroAuditoria { id: number; em: string; acao: string; entidade: string | null; detalhes: Record<string, unknown> | null; usuario: string | null }
export interface PaginaAuditoria { itens: RegistroAuditoria[]; total: number; pagina: number; porPagina: number }
export interface FiltroAuditoria { acao?: string; de?: string; ate?: string; pagina?: number }

export const solicitacoes = () => api<Solicitacao[]>('/administracao/solicitacoes');
export const decidir = (id: number, aprovar: boolean) => post<{ mensagem: string }>(`/administracao/solicitacoes/${id}/decisao`, { aprovar });
export const usuarios = () => api<UsuarioAdm[]>('/administracao/usuarios');
export const atualizarUsuario = (id: number, d: { perfil?: string; ativo?: boolean }) => patch<{ mensagem: string }>(`/administracao/usuarios/${id}`, d);
export const parametros = () => api<Parametros>('/administracao/parametros');
export const salvarParametros = (d: Parametros) => put<{ mensagem: string }>('/administracao/parametros', d);
export const acoesAuditoria = () => api<string[]>('/administracao/auditoria/acoes');
export const auditoria = (f: FiltroAuditoria) => {
  const q = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
  return api<PaginaAuditoria>(`/administracao/auditoria?${q}`);
};
