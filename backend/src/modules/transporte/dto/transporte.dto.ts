import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const DATA = { message: 'Informe a data no formato AAAA-MM-DD.' };
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

export class ReservaDto {
  @Matches(REGEX_DATA, DATA) data!: string;
  @Type(() => Number) @IsInt({ message: 'Escolha a instituição.' }) instituicaoId!: number;
  @IsString({ message: 'Escolha o ponto de embarque.' }) @MaxLength(100) pontoEmbarque!: string;
}
export class CancelarReservaDto {
  @IsOptional() @IsString() @MaxLength(300) motivo?: string;
}
export class SituacaoReservaDto {
  @IsIn(['confirmada', 'embarcou', 'faltou'], { message: 'Situação inválida.' }) status!: string;
}
export class MoverVeiculoDto {
  @Type(() => Number) @IsInt({ message: 'Escolha o veículo.' }) veiculoId!: number;
}
export class ListaQueryDto {
  @Matches(REGEX_DATA, DATA) data!: string;
  @IsOptional() @Type(() => Number) @IsInt() rotaId?: number;
}
export class PainelQueryDto {
  @IsOptional() @Matches(REGEX_DATA, DATA) de?: string;
  @IsOptional() @Matches(REGEX_DATA, DATA) ate?: string;
}
