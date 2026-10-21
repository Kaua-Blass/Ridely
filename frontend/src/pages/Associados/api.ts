import { api, patch, post } from '../../lib/api';

export interface Associado {
  id: number; nome: string; email: string | null; telefone: string | null; cargo: string; cargoCodigo: string;
  situacao: 'convite' | 'ativo' | 'inativo'; instituicao: string | null; instituicaoId: number | null;
  rota: string | null; rotaId: number | null; pontoEmbarque: string | null;
}
export interface NovoConvite { nome: string; email: string; cargo: string; perfil: string; instituicaoId: number }
export interface Edicao { nome: string; telefone?: string; cpf?: string; cargo: string; instituicaoId: number; rotaId?: number; pontoEmbarque?: string }
export interface Rota { id: number; nome: string; paradas: string[]; instituicoes: number[] }

export const listar = () => api<Associado[]>('/associados');
export const rotas = () => api<Rota[]>('/veiculos-rotas/rotas');
export const convidar = (d: NovoConvite) => post<{ mensagem: string }>('/associados/convite', d);
export const reenviar = (id: number) => post<{ mensagem: string }>(`/associados/${id}/reenviar-convite`);
export const editar = (id: number, d: Edicao) => patch<{ mensagem: string }>(`/associados/${id}`, d);
export const mudarSituacao = (id: number, ativo: boolean) => post<{ mensagem: string }>(`/associados/${id}/situacao`, { ativo });
