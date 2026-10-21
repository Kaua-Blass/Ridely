import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service';
import { MailService } from './mail.service';
import { RateLimitService } from './rate-limit.service';

@Global()
@Module({ providers: [DbService, MailService, RateLimitService], exports: [DbService, MailService, RateLimitService] })
export class CommonModule {}
