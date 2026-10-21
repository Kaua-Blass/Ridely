import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsString, MaxLength, MinLength } from 'class-validator';

export const CARGOS = ['associado', 'presidente', 'vice-presidente', 'tesoureiro', 'conselheiro', 'auxiliar'];
export const PERFIS_CONVITE = ['associado', 'presidente', 'vice-presidente', 'tesoureiro', 'conselheiro', 'auxiliar'];

export class ConviteDto {
  @IsString() @MinLength(3, { message: 'Informe o nome completo.' }) @MaxLength(150) nome!: string;
  @IsEmail({}, { message: 'Informe um e-mail válido.' }) @MaxLength(200) email!: string;
  @IsIn(CARGOS, { message: 'Cargo inválido.' }) cargo!: string;
  @IsIn(PERFIS_CONVITE, { message: 'Perfil de acesso inválido.' }) perfil!: string;
  @Type(() => Number) @IsInt({ message: 'Escolha a instituição.' }) instituicaoId!: number;
}
