import { api } from '../../lib/api';

// TODO: chamadas de Financeiro à API (/financeiro).
export const listar = () => api<unknown[]>('/financeiro');
