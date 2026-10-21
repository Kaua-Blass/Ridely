import { api, post } from '../../lib/api';

export interface Associado { id: number; nome: string; email: string | null; telefone: string | null; cargo: string; situacao: 'convite' | 'ativo' | 'inativo'; instituicao: string | null; rota: string | null }
export interface NovoConvite { nome: string; email: string; cargo: string; perfil: string; instituicaoId: number }

export const listar = () => api<Associado[]>('/associados');
export const convidar = (d: NovoConvite) => post<{ mensagem: string }>('/associados/convite', d);
export const reenviar = (id: number) => post<{ mensagem: string }>(`/associados/${id}/reenviar-convite`);
