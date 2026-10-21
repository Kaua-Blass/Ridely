export type Perfil = 'presidente' | 'vice-presidente' | 'tesoureiro' | 'conselheiro' | 'auxiliar' | 'associado' | 'motorista';
/** O banco usa underscore (vice_presidente); a API e o front usam hífen. */
export const perfilApi = (p: string) => p.replace('_', '-') as Perfil;
export const paraBanco = (p: string) => p.replace('-', '_');
