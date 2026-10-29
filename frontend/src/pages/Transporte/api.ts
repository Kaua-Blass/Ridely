import { api, post } from '../../lib/api';

export type StatusReserva = 'confirmada' | 'espera' | 'embarcou' | 'faltou' | 'cancelada';
export interface ReservaResumo { id: number; status: StatusReserva; rota: string; veiculo: string | null; posicao: number | null }
export interface DiaMinhas { data: string; permitido: boolean; motivo: string | null; prazoAberto: boolean; vagas: number | null; reserva: ReservaResumo | null }
export interface Historico { id: number; data: string; status: StatusReserva; rota: string }
export interface Minhas { horaLimite: number; padrao: { instituicaoId: number | null; pontoEmbarque: string | null } | null; dias: DiaMinhas[]; historico: Historico[] }
export interface Passageiro { id: number; associado: string; instituicao: string | null; ponto: string | null; status: StatusReserva }
export interface VeiculoLista { id: number; nome: string; placa: string; capacidade: number; motorista: string | null; passageiros: Passageiro[] }
export interface Lista {
  data: string; rota: { id: number; nome: string }; rotas: { id: number; nome: string }[]; veiculos: VeiculoLista[];
  semVeiculo?: Passageiro[]; espera?: Passageiro[]; capacidade?: number; confirmadas?: number; canceladas?: number;
}
export interface LinhaPainel { data: string; rotaId: number; rota: string; confirmadas: number; espera: number; canceladas: number; embarcaram: number; faltaram: number; capacidade: number; vagas: number; lotada: boolean; precisaDeVeiculo: boolean }
export interface Alerta { data: string; rotaId: number; rota: string; capacidade: number; confirmadas: number; espera: number; tipo: 'fila' | 'lotada' }
type Msg = { mensagem: string };

export const minhas = () => api<Minhas>('/transporte/minhas');
export const reservar = (d: { data: string; instituicaoId: number; pontoEmbarque: string }) => post<Msg & { status: StatusReserva }>('/transporte/reservas', d);
export const cancelar = (id: number, motivo?: string) => post<Msg>(`/transporte/reservas/${id}/cancelar`, { motivo });
export const marcar = (id: number, status: 'confirmada' | 'embarcou' | 'faltou') => post<Msg>(`/transporte/reservas/${id}/situacao`, { status });
export const moverVeiculo = (id: number, veiculoId: number) => post<Msg>(`/transporte/reservas/${id}/veiculo`, { veiculoId });
export const lista = (data: string, rotaId?: number) => api<Lista>(`/transporte/lista?data=${data}${rotaId ? `&rotaId=${rotaId}` : ''}`);
export const painel = (de?: string, ate?: string) => api<LinhaPainel[]>(`/transporte/painel${de ? `?de=${de}${ate ? `&ate=${ate}` : ''}` : ''}`);
export const alertas = () => api<Alerta[]>('/transporte/alertas');
