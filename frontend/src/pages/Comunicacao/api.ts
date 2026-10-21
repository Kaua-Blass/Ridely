import { api } from '../../lib/api';

// TODO: chamadas de Comunicação à API (/comunicacao).
export const listar = () => api<unknown[]>('/comunicacao');
