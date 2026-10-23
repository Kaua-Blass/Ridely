import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const FORMAS = ['dinheiro', 'pix', 'transferencia', 'cartao'];
const DATA = { message: 'Informe a data no formato AAAA-MM-DD.' };
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_REF = /^\d{4}-(0[1-9]|1[0-2])$/;
const REF = { message: 'Informe o mês no formato AAAA-MM.' };

export class GerarDto {
  @Matches(REGEX_REF, REF) referencia!: string;
  @IsOptional() @Type(() => Number) @IsInt() associadoId?: number;
}
export class BaixaDto {
  @Matches(REGEX_DATA, DATA) data!: string;
  @IsIn(FORMAS, { message: 'Forma de pagamento inválida.' }) forma!: string;
  @Type(() => Number) @IsInt({ message: 'Escolha a conta de recebimento.' }) contaId!: number;
  @IsOptional() @IsBoolean() dispensarMulta?: boolean;
  @IsOptional() @IsString() @MaxLength(300) motivo?: string;
}
export class MotivoDto {
  @IsString() @MinLength(3, { message: 'Informe o motivo.' }) @MaxLength(300) motivo!: string;
}
export class MensalidadesQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() associadoId?: number;
  @IsOptional() @IsString() @MaxLength(100) busca?: string;
  @IsOptional() @Matches(REGEX_REF, REF) referencia?: string;
  @IsOptional() @IsIn(['baixado', 'em_aberto', 'atrasado', 'cancelada']) status?: string;
  @IsOptional() @Matches(REGEX_DATA, DATA) de?: string;
  @IsOptional() @Matches(REGEX_DATA, DATA) ate?: string;
}
