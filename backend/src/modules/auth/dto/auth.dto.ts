import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

const EMAIL = { message: 'Informe um e-mail válido.' };
const SENHA = { message: 'A senha precisa ter pelo menos 8 caracteres.' };

export class LoginDto {
  @IsEmail({}, EMAIL) @MaxLength(200) email!: string;
  @IsString() @MaxLength(200) senha!: string;
}
export class CadastroDto {
  @IsString() @MinLength(3, { message: 'Informe o nome completo.' }) @MaxLength(150) nome!: string;
  @IsEmail({}, EMAIL) @MaxLength(200) email!: string;
  @IsString() @MinLength(8, SENHA) @MaxLength(100) senha!: string;
  @IsOptional() @IsString() @MaxLength(30) telefone?: string;
  @IsOptional() @Matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, { message: 'CPF inválido.' }) cpf?: string;
  @Type(() => Number) @IsInt({ message: 'Escolha a instituição.' }) instituicaoId!: number;
}
export class TokenDto {
  @IsString() @Length(64, 64, { message: 'Link inválido.' }) token!: string;
}
export class EsqueciSenhaDto {
  @IsEmail({}, EMAIL) @MaxLength(200) email!: string;
}
export class RedefinirSenhaDto extends TokenDto {
  @IsString() @MinLength(8, SENHA) @MaxLength(100) senha!: string;
}
export class ConcluirCadastroDto extends RedefinirSenhaDto {
  @IsOptional() @IsString() @MaxLength(30) telefone?: string;
}
