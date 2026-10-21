import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PERFIS } from '../../../common/perfil.enum';

export class AtualizarUsuarioDto {
  @IsOptional() @IsIn(PERFIS, { message: 'Perfil inválido.' }) perfil?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}
export class ParametrosDto {
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Informe o valor com até 2 casas decimais.' }) @Min(0, { message: 'O valor não pode ser negativo.' }) @Max(100000) valorPorDia!: number;
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Informe a multa com até 2 casas decimais.' }) @Min(0, { message: 'A multa não pode ser negativa.' }) @Max(100, { message: 'A multa não pode passar de 100%.' }) multaPercentual!: number;
}
export class AuditoriaQueryDto {
  @IsOptional() @IsString() @MaxLength(60) acao?: string;
  @IsOptional() @Type(() => Number) @IsInt() usuarioId?: number;
  @IsOptional() @IsDateString() de?: string;
  @IsOptional() @IsDateString() ate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) porPagina?: number;
}
