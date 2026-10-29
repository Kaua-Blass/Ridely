import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { TIPOS } from '../regras';

const aparar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CriarComunicadoDto {
  @IsIn(TIPOS, { message: 'Escolha o tipo do comunicado.' }) tipo!: string;
  @Transform(aparar) @IsString({ message: 'Informe o título.' }) @IsNotEmpty({ message: 'Informe o título.' }) @MaxLength(120, { message: 'O título pode ter até 120 caracteres.' }) titulo!: string;
  @Transform(aparar) @IsString({ message: 'Escreva a mensagem.' }) @IsNotEmpty({ message: 'Escreva a mensagem.' }) @MaxLength(5000, { message: 'A mensagem pode ter até 5.000 caracteres.' }) mensagem!: string;
  /** Vazio ou nulo = todos. */
  @IsOptional() @Type(() => Number) @IsInt({ message: 'Destinatário inválido.' }) @Min(1) destinatarioId?: number | null;
  /** Padrão: avisa também por e-mail. */
  @IsOptional() @IsBoolean() enviarEmail?: boolean;
}
export class EditarComunicadoDto {
  @IsOptional() @IsIn(TIPOS, { message: 'Tipo inválido.' }) tipo?: string;
  @IsOptional() @Transform(aparar) @IsString() @IsNotEmpty({ message: 'Informe o título.' }) @MaxLength(120, { message: 'O título pode ter até 120 caracteres.' }) titulo?: string;
  @IsOptional() @Transform(aparar) @IsString() @IsNotEmpty({ message: 'Escreva a mensagem.' }) @MaxLength(5000, { message: 'A mensagem pode ter até 5.000 caracteres.' }) mensagem?: string;
}
export class ListaQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) porPagina?: number;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() apenasNaoLidas?: boolean;
}
