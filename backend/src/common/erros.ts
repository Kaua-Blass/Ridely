import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, PayloadTooLargeException } from '@nestjs/common';
import type { Response } from 'express';

/** Converte violação de unicidade do PostgreSQL (23505) em 409 com mensagem clara. */
export function tratarUnico(e: unknown, mensagem: string): never {
  if ((e as { code?: string }).code === '23505') throw new ConflictException(mensagem);
  throw e;
}

/** Troca a mensagem em inglês do upload grande demais por uma em português. */
@Catch(PayloadTooLargeException)
export class ArquivoGrandeFilter implements ExceptionFilter {
  catch(_: PayloadTooLargeException, host: ArgumentsHost) {
    host.switchToHttp().getResponse<Response>().status(413).json({ message: 'A imagem deve ter até 2 MB.', error: 'Payload Too Large', statusCode: 413 });
  }
}

/** Mensagem em português para PDF grande demais. */
@Catch(PayloadTooLargeException)
export class PdfGrandeFilter implements ExceptionFilter {
  catch(_: PayloadTooLargeException, host: ArgumentsHost) {
    host.switchToHttp().getResponse<Response>().status(413).json({ message: 'O PDF deve ter até 10 MB.', error: 'Payload Too Large', statusCode: 413 });
  }
}
