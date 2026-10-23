import { join, resolve } from 'path';

export const pastaContratos = () => resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'), 'contratos');
export const ehPdf = (b: Buffer) => b.length > 8 && b.subarray(0, 5).toString('latin1') === '%PDF-';
