import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { CARGOS } from './convite.dto';

export class EditarAssociadoDto {
  @IsString() @MinLength(3, { message: 'Informe o nome completo.' }) @MaxLength(150) nome!: string;
  @IsOptional() @IsString() @MaxLength(30) telefone?: string;
  @IsOptional() @Matches(/^(\d{3}\.?\d{3}\.?\d{3}-?\d{2})?$/, { message: 'CPF inválido.' }) cpf?: string;
  @IsIn(CARGOS, { message: 'Cargo inválido.' }) cargo!: string;
  @Type(() => Number) @IsInt({ message: 'Escolha a instituição.' }) instituicaoId!: number;
  @IsOptional() @Type(() => Number) @IsInt() rotaId?: number;
  @IsOptional() @IsString() @MaxLength(100) pontoEmbarque?: string;
}
export class SituacaoDto {
  @IsBoolean() ativo!: boolean;
}
