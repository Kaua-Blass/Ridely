import { SetMetadata } from '@nestjs/common';
import type { Perfil } from './perfil.enum';

export const PERFIS_CHAVE = 'perfis';
/** Uso: @Perfis('presidente', 'tesoureiro') no controller ou na rota. */
export const Perfis = (...perfis: Perfil[]) => SetMetadata(PERFIS_CHAVE, perfis);
