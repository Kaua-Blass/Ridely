import { api } from '../../lib/api';

// TODO: chamadas de Controles financeiros à API (/controles-financeiros).
export const listar = () => api<unknown[]>('/controles-financeiros');
