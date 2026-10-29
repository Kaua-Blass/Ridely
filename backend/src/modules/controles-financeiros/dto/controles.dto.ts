import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const DATA = { message: 'Informe a data no formato AAAA-MM-DD.' };
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const VALOR = { maxDecimalPlaces: 2 };

export const CATEGORIAS_RECEITA = ['Contribuição extraordinária', 'Taxa administrativa', 'Doação', 'Outras receitas'];
export const CATEGORIAS_DESPESA = ['Combustível', 'Manutenção', 'Seguro', 'Motorista e pessoal', 'Impostos e taxas', 'Outras despesas'];

export class ContaBaseDto {
  @IsString() @MinLength(2, { message: 'Informe o nome da conta.' }) @MaxLength(80) nome!: string;
  @IsIn(['caixa', 'banco'], { message: 'Tipo de conta inválido.' }) tipo!: string;
  @IsOptional() @IsString() @MaxLength(80) banco?: string;
  @IsOptional() @IsString() @MaxLength(20) agencia?: string;
  @IsOptional() @IsString() @MaxLength(30) numero?: string;
  @IsOptional() @IsString() @MaxLength(5) digito?: string;
  @IsOptional() @IsIn(['corrente', 'poupanca', 'pagamento'], { message: 'Tipo de conta bancária inválido.' }) tipoConta?: string;
  @IsOptional() @IsString() @MaxLength(100) chavePix?: string;
  @IsOptional() @IsString() @MaxLength(120) titular?: string;
  @IsOptional() @IsString() @MaxLength(300) observacoes?: string;
}
export class ContaDto extends ContaBaseDto {
  @IsOptional() @IsNumber(VALOR, { message: 'Saldo com até 2 casas decimais.' }) @Min(0, { message: 'O saldo inicial não pode ser negativo.' }) @Max(100000000) saldoInicial?: number;
}
export class SituacaoContaDto {
  @IsIn([true, false]) ativa!: boolean;
}
export class LancamentoDto {
  @Matches(REGEX_DATA, DATA) data!: string;
  @IsString() @MaxLength(60) categoria!: string;
  @IsString() @MinLength(3, { message: 'Descreva o lançamento.' }) @MaxLength(200) descricao!: string;
  @IsNumber(VALOR, { message: 'Valor com até 2 casas decimais.' }) @Min(0.01, { message: 'O valor precisa ser maior que zero.' }) @Max(10000000) valor!: number;
  @Type(() => Number) @IsInt({ message: 'Escolha a conta.' }) contaId!: number;
  @IsOptional() @Type(() => Number) @IsInt() associadoId?: number;
  @IsOptional() @IsString() @MaxLength(300) observacao?: string;
}
export class TransferenciaDto {
  @Matches(REGEX_DATA, DATA) data!: string;
  @Type(() => Number) @IsInt({ message: 'Escolha a conta de origem.' }) origemId!: number;
  @Type(() => Number) @IsInt({ message: 'Escolha a conta de destino.' }) destinoId!: number;
  @IsNumber(VALOR, { message: 'Valor com até 2 casas decimais.' }) @Min(0.01, { message: 'O valor precisa ser maior que zero.' }) @Max(10000000) valor!: number;
  @IsString() @MinLength(3, { message: 'Informe a justificativa.' }) @MaxLength(200) historico!: string;
  @IsOptional() @IsString() @MaxLength(300) observacao?: string;
}
export class MotivoEstornoDto {
  @IsString() @MinLength(3, { message: 'Informe o motivo.' }) @MaxLength(300) motivo!: string;
}
export class MovimentacoesQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() contaId?: number;
  @IsOptional() @IsIn(['receita', 'despesa', 'transferencia', 'estorno']) tipo?: string;
  @IsOptional() @IsString() @MaxLength(60) categoria?: string;
  @IsOptional() @Matches(REGEX_DATA, DATA) de?: string;
  @IsOptional() @Matches(REGEX_DATA, DATA) ate?: string;
  @IsOptional() @IsString() @MaxLength(100) busca?: string;
  @IsOptional() @IsIn(['asc', 'desc']) ordem?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) porPagina?: number;
}
