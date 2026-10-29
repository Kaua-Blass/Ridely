import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AtualizarPerfilDto {
  @IsString() @MinLength(3, { message: 'Informe o nome completo.' }) @MaxLength(150) nome!: string;
  @IsOptional() @IsString() @MaxLength(30) telefone?: string;
  @IsOptional() @IsString() @MaxLength(200) endereco?: string;
  @IsOptional() @IsString() @MaxLength(150) contatoEmergencia?: string;
  @IsOptional() @Type(() => Number) @IsInt({ message: 'Instituição inválida.' }) instituicaoId?: number;
}
export class TrocarSenhaDto {
  @IsString() @MaxLength(200) senhaAtual!: string;
  @IsString() @MinLength(8, { message: 'A nova senha precisa ter pelo menos 8 caracteres.' }) @MaxLength(100) novaSenha!: string;
}
export class TrocarEmailDto {
  @IsEmail({}, { message: 'Informe um e-mail válido.' }) @MaxLength(200) novoEmail!: string;
  @IsString() @MaxLength(200) senhaAtual!: string;
}
