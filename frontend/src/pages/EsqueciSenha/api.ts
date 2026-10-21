import { post } from '../../lib/api';

export const pedirLink = (email: string) => post<{ mensagem: string }>('/auth/esqueci-senha', { email });
