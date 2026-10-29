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
  @Type(() => Number) @IsInt({ message: 'Informe os dias de antecedência do alerta.' }) @Min(1, { message: 'O alerta precisa ser de ao menos 1 dia.' }) @Max(365) alertaRenovacaoDias!: number;
  @Type(() => Number) @IsInt({ message: 'Informe a hora limite (0 a 23).' }) @Min(0, { message: 'A hora vai de 0 a 23.' }) @Max(23, { message: 'A hora vai de 0 a 23.' }) horaLimiteReserva!: number;
  @Type(() => Number) @IsInt({ message: 'Informe os dias de antecedência do lembrete (0 desliga).' }) @Min(0, { message: 'Use 0 para desligar o lembrete.' }) @Max(30, { message: 'O lembrete pode ser de até 30 dias antes.' }) lembreteVencimentoDias!: number;
  @Type(() => Number) @IsInt({ message: 'Informe o intervalo da cobrança (0 desliga).' }) @Min(0, { message: 'Use 0 para desligar a cobrança automática.' }) @Max(90, { message: 'O intervalo pode ser de até 90 dias.' }) cobrancaIntervaloDias!: number;
}
export class AlertaDto {}
export class AuditoriaQueryDto {
  @IsOptional() @IsString() @MaxLength(60) acao?: string;
  @IsOptional() @Type(() => Number) @IsInt() usuarioId?: number;
  @IsOptional() @IsDateString() de?: string;
  @IsOptional() @IsDateString() ate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) porPagina?: number;
}
