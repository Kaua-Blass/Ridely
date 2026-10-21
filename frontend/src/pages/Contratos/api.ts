import { api } from '../../lib/api';

// TODO: chamadas de Contratos à API (/contratos).
export const listar = () => api<unknown[]>('/contratos');
