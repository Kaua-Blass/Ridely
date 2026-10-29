import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEmail, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class VeiculoDto {
  @IsString() @MinLength(2, { message: 'Informe o nome do veículo.' }) @MaxLength(60) nome!: string;
  @Matches(/^[A-Za-z]{3}-?\d[A-Za-z0-9]\d{2}$/, { message: 'Placa inválida. Exemplos: ABC1D23 ou ABC-1234.' }) placa!: string;
  @Type(() => Number) @IsInt({ message: 'Informe a capacidade.' }) @Min(1, { message: 'A capacidade mínima é 1.' }) @Max(60, { message: 'A capacidade máxima é 60.' }) capacidade!: number;
  @IsOptional() @Type(() => Number) @IsInt() rotaId?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() motoristaId?: number | null;
}
export class RotaDto {
  @IsString() @MinLength(2, { message: 'Informe o nome da rota.' }) @MaxLength(80) nome!: string;
  @IsOptional() @IsString() @MaxLength(300) descricao?: string;
  @IsArray() @ArrayMinSize(1, { message: 'Informe ao menos uma parada.' }) @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(100, { each: true }) paradas!: string[];
  @IsArray() @ArrayMinSize(1, { message: 'Escolha ao menos uma instituição.' }) @ArrayUnique() @IsInt({ each: true }) instituicoes!: number[];
}
export class InstituicaoDto {
  @IsString() @MinLength(2, { message: 'Informe o nome da instituição.' }) @MaxLength(120) nome!: string;
}
export class MotoristaConviteDto {
  @IsString() @MinLength(3, { message: 'Informe o nome completo.' }) @MaxLength(150) nome!: string;
  @IsEmail({}, { message: 'Informe um e-mail válido.' }) @MaxLength(200) email!: string;
}
