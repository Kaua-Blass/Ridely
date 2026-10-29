import { join, resolve } from 'path';

export const pastaFotos = () => resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'), 'fotos');
export const MIME_POR_EXT: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Descobre o tipo real pelo conteúdo do arquivo (não confia no nome nem no tipo informado). */
export function tipoImagem(b: Buffer): { ext: string; mime: string } | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}
