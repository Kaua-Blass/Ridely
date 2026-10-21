import { post } from '../../lib/api';

export const verificar = (token: string) => post<{ mensagem: string }>('/auth/verificar-email', { token });
