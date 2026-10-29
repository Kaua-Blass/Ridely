import { join, resolve } from 'path';
import { tipoImagem } from './foto';

export const pastaContratos = () => resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'), 'contratos');
export const ehPdf = (b: Buffer) => b.length > 8 && b.subarray(0, 5).toString('latin1') === '%PDF-';

export const pastaComunicados = () => resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'), 'comunicados');
/** Anexo de comunicado: PDF ou imagem (JPG, PNG, WebP). O tipo vem do conteúdo, nunca do nome do arquivo. */
export function tipoAnexo(b: Buffer): { ext: string; mime: string } | null {
  if (ehPdf(b)) return { ext: 'pdf', mime: 'application/pdf' };
  return tipoImagem(b);
}
export const MIME_ANEXO: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
