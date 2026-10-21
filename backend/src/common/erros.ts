import { ConflictException } from '@nestjs/common';

/** Converte violação de unicidade do PostgreSQL (23505) em 409 com mensagem clara. */
export function tratarUnico(e: unknown, mensagem: string): never {
  if ((e as { code?: string }).code === '23505') throw new ConflictException(mensagem);
  throw e;
}
