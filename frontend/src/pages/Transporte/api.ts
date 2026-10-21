import { api } from '../../lib/api';

// TODO: chamadas de Transporte à API (/transporte).
export const listar = () => api<unknown[]>('/transporte');
