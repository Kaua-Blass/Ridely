import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

/** CPF nunca fica em texto no banco. Dois valores derivados da mesma chave (CPF_CHAVE):
 *  - cifra AES-256-GCM (com IV aleatório): é o que se grava e se lê de volta;
 *  - "busca" HMAC-SHA256 determinístico: serve só para garantir que o mesmo CPF não se repita,
 *    sem que o banco precise guardar o número. */

export const digitos = (cpf: string) => cpf.replace(/\D/g, '');

function chaveBase(): Buffer {
  const k = process.env.CPF_CHAVE;
  if (!k) throw new Error('CPF_CHAVE não definida.');
  const b = Buffer.from(k, 'base64');
  if (b.length !== 32) throw new Error('CPF_CHAVE deve ter 32 bytes em base64.');
  return b;
}
const subchave = (finalidade: 'cifra' | 'busca') => createHmac('sha256', chaveBase()).update(finalidade).digest();

function exigirCpf(cpf: string): string {
  const d = digitos(cpf);
  if (d.length !== 11) throw new Error('CPF com quantidade de dígitos inválida.');
  return d;
}

/** Formato guardado: v1:iv:tag:texto (base64). */
export function cifrarCpf(cpf: string): string {
  const d = exigirCpf(cpf);
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', subchave('cifra'), iv);
  const texto = Buffer.concat([c.update(d, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), texto.toString('base64')].join(':');
}

export function decifrarCpf(valor: string): string {
  const [versao, iv, tag, texto] = valor.split(':');
  if (versao !== 'v1' || !iv || !tag || !texto) throw new Error('Valor cifrado de CPF inválido.');
  const d = createDecipheriv('aes-256-gcm', subchave('cifra'), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64')); // se alguém alterar o valor no banco, a decifragem falha
  return Buffer.concat([d.update(Buffer.from(texto, 'base64')), d.final()]).toString('utf8');
}

/** Impressão digital do CPF para a restrição de unicidade. */
export const buscaCpf = (cpf: string) => createHmac('sha256', subchave('busca')).update(exigirCpf(cpf)).digest('hex');

/** Para exibir: ***.456.789-** (só o trecho central fica visível). */
export function mascararCpf(cpf: string): string {
  const d = digitos(cpf);
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : '';
}
