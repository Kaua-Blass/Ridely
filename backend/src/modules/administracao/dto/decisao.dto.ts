import { IsBoolean } from 'class-validator';

export class DecisaoDto {
  @IsBoolean() aprovar!: boolean;
}
