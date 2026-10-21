import { api } from '../../lib/api';

// TODO: chamadas de Associados à API (/associados).
export const listar = () => api<unknown[]>('/associados');
