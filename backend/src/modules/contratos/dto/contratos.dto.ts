import { Type } from 'class-transformer';
import { ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const DATA = { message: 'Informe a data no formato AAAA-MM-DD.' };
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const DIAS = { each: true, message: 'Os dias vão de 1 (segunda) a 5 (sexta).' };

export class ContratoBaseDto {
  @Matches(REGEX_DATA, DATA) inicio!: string;
  @Matches(REGEX_DATA, DATA) fim!: string;
  @IsArray() @ArrayMinSize(1, { message: 'Escolha ao menos um dia da semana.' }) @ArrayUnique() @IsInt(DIAS) @Min(1, DIAS) @Max(5, DIAS) diasSemana!: number[];
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor com até 2 casas decimais.' }) @Min(0) @Max(10000) valorPorDia?: number;
}
export class ContratoDto extends ContratoBaseDto {
  @Type(() => Number) @IsInt({ message: 'Escolha o associado.' }) associadoId!: number;
}
export class AditivoDto {
  @Matches(REGEX_DATA, DATA) vigenciaAPartir!: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsInt(DIAS) @Min(1, DIAS) @Max(5, DIAS) novosDias?: number[];
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10000) novoValorPorDia?: number;
  @IsOptional() @Matches(REGEX_DATA, DATA) novoFim?: string;
  @IsOptional() @IsString() @MaxLength(500) observacao?: string;
}
export class EncerrarDto {
  @Matches(REGEX_DATA, DATA) data!: string;
}
export class PreviaQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Informe o mês no formato AAAA-MM.' }) referencia!: string;
}
export class SolicitacaoContratoDto {
  @Type(() => Number) @IsInt() contratoId!: number;
  @IsArray() @ArrayMinSize(1, { message: 'Escolha ao menos um dia da semana.' }) @ArrayUnique() @IsInt(DIAS) @Min(1, DIAS) @Max(5, DIAS) novosDias!: number[];
  @Matches(REGEX_DATA, DATA) vigenciaAPartir!: string;
  @IsOptional() @IsString() @MaxLength(500) observacao?: string;
}
export class DecisaoSolicitacaoDto {
  @IsBoolean() aprovar!: boolean;
  @IsOptional() @IsString() @MaxLength(300) motivo?: string;
}
