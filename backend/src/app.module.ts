import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { PerfilModule } from './modules/perfil/perfil.module';
import { PainelModule } from './modules/painel/painel.module';
import { AssociadosModule } from './modules/associados/associados.module';
import { VeiculosRotasModule } from './modules/veiculos-rotas/veiculos-rotas.module';
import { FinanceiroModule } from './modules/financeiro/financeiro.module';
import { ControlesFinanceirosModule } from './modules/controles-financeiros/controles-financeiros.module';
import { ContratosModule } from './modules/contratos/contratos.module';
import { TransporteModule } from './modules/transporte/transporte.module';
import { ComunicacaoModule } from './modules/comunicacao/comunicacao.module';
import { RelatoriosModule } from './modules/relatorios/relatorios.module';
import { AdministracaoModule } from './modules/administracao/administracao.module';

@Module({ imports: [AuthModule, PerfilModule, PainelModule, AssociadosModule, VeiculosRotasModule, FinanceiroModule, ControlesFinanceirosModule, ContratosModule, TransporteModule, ComunicacaoModule, RelatoriosModule, AdministracaoModule] })
export class AppModule {}
