import { api, del, patch, post } from '../../lib/api';

export interface RotaAdm { id: number; nome: string; descricao: string | null; paradas: string[]; instituicoes: number[]; veiculos: number; capacidade: number; associados: number }
export interface VeiculoAdm { id: number; nome: string; placa: string; capacidade: number; rotaId: number | null; rota: string | null; motoristaId: number | null; motorista: string | null }
export interface InstituicaoAdm { id: number; nome: string; associados: number }
export interface MotoristaAdm { id: number; nome: string; email: string; ativo: boolean; pendente: boolean }
export interface Visao { rotas: RotaAdm[]; veiculos: VeiculoAdm[]; instituicoes: InstituicaoAdm[]; motoristas: MotoristaAdm[] }
export interface DadosVeiculo { nome: string; placa: string; capacidade: number; rotaId?: number; motoristaId?: number }
export interface DadosRota { nome: string; descricao?: string; paradas: string[]; instituicoes: number[] }
type Msg = { mensagem: string };

const base = '/veiculos-rotas';
export const visao = () => api<Visao>(base);
export const criarVeiculo = (d: DadosVeiculo) => post<Msg>(`${base}/veiculos`, d);
export const atualizarVeiculo = (id: number, d: DadosVeiculo) => patch<Msg>(`${base}/veiculos/${id}`, d);
export const removerVeiculo = (id: number) => del<Msg>(`${base}/veiculos/${id}`);
export const criarRota = (d: DadosRota) => post<Msg>(`${base}/rotas`, d);
export const atualizarRota = (id: number, d: DadosRota) => patch<Msg>(`${base}/rotas/${id}`, d);
export const removerRota = (id: number) => del<Msg>(`${base}/rotas/${id}`);
export const criarInstituicao = (nome: string) => post<Msg>(`${base}/instituicoes`, { nome });
export const atualizarInstituicao = (id: number, nome: string) => patch<Msg>(`${base}/instituicoes/${id}`, { nome });
export const removerInstituicao = (id: number) => del<Msg>(`${base}/instituicoes/${id}`);
export const convidarMotorista = (nome: string, email: string) => post<Msg>(`${base}/motoristas/convite`, { nome, email });
export const reenviarMotorista = (id: number) => post<Msg>(`${base}/motoristas/${id}/reenviar-convite`);
