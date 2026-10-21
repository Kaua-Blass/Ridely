import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCb) as (senha: string, sal: Buffer, tamanho: number) => Promise<Buffer>;

/** Senha guardada como scrypt$sal$hash. Nunca a senha em si. */
export async function hashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  return `scrypt$${sal.toString('hex')}$${(await scrypt(senha, sal, 64)).toString('hex')}`;
}
export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const [alg, sal, hash] = guardado.split('$');
  if (alg !== 'scrypt') return false;
  const calc = await scrypt(senha, Buffer.from(sal, 'hex'), 64);
  const esperado = Buffer.from(hash, 'hex');
  return calc.length === esperado.length && timingSafeEqual(calc, esperado);
}
/** Usado quando o e-mail não existe, para o tempo de resposta não revelar isso. */
export const HASH_FALSO = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;

/** Token aleatório enviado por e-mail; no banco fica só o hash dele. */
export const novoToken = () => randomBytes(32).toString('hex');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
