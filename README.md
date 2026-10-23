# Ridely

Sistema de gestão de uma associação de transporte escolar: associados, mensalidades, contas, contratos, rotas e reservas.

Monorepo em **TypeScript** de ponta a ponta, com **PostgreSQL**.

| Camada | Tecnologia |
|---|---|
| Front-end | React + TypeScript + Vite, HTML e CSS (CSS Modules, sem framework de estilos) |
| Back-end | Node.js + NestJS + TypeScript, um módulo por tela |
| Banco | PostgreSQL 16, acesso direto com `pg` e SQL (`database/schema.sql`) |
| E-mail | Nodemailer (SMTP) |
| Sessão | JWT em cookie `httpOnly` (o JavaScript da página não enxerga o token) |

## Estrutura

```
Ridely/
  docs/prototipo/tcc-sistema.html   protótipo visual de referência (abre no navegador)
  database/schema.sql               esquema do PostgreSQL
  frontend/src/pages/<Tela>/        index.tsx, <Tela>.module.css, api.ts, types.ts
  frontend/src/components/          Layout, Sidebar, AuthCard, DataTable
  frontend/src/lib/                 api.ts, auth.tsx, permissoes.ts, useEnvio.ts
  backend/src/modules/<tela>/       module, controller, service e dto
  backend/src/common/               banco, e-mail, senha, guards de login e perfil
  backend/src/seed.ts               cria o presidente inicial
```

Uma pasta por tela nos dois lados: `pages/Associados` conversa com `modules/associados`.

## Como rodar

1. **Banco**: `docker compose up -d` (cria o banco `ridely` com as tabelas).
   Se já tinha subido uma versão anterior: `docker compose down -v` e suba de novo.
2. **Back-end**:
   ```
   cd backend
   copy .env.example .env      # preencha JWT_SECRET e os dados do presidente (SEED_*)
   npm install
   npm run seed                # cria o presidente, instituições, rotas e contas
   npm run start:dev           # API em http://localhost:3000
   ```
3. **Front-end**:
   ```
   cd frontend
   npm install
   npm run dev                 # http://localhost:5173
   ```

## E-mails

- **Sem `SMTP_URL`** (padrão): nada é enviado; cada e-mail aparece no terminal do back-end, com o link. Dá para testar tudo assim.
- **Com Gmail**: ative a verificação em duas etapas, crie uma *senha de app* em https://myaccount.google.com/apppasswords e use
  `SMTP_URL=smtps://seu-email%40gmail.com:SENHA_DE_APP@smtp.gmail.com:465` (o `@` do e-mail vira `%40`).
  Serviços como Brevo e Resend também funcionam por SMTP.
- Em produção, defina `APP_URL` com o endereço público do site (os links dos e-mails usam esse endereço).

## Fluxos prontos

| Fluxo | Como funciona |
|---|---|
| Login | e-mail e senha; cookie `httpOnly`; máximo de 8 tentativas por 15 min; resposta igual para e-mail inexistente |
| Esqueci a senha | pede o e-mail, recebe um link (vale 30 min, uso único); a nova senha encerra as sessões antigas |
| Cadastro público | cria conta **inativa** + pedido para a presidência + e-mail de confirmação; a presidência aprova em Administração |
| Convite | presidente ou vice convida por e-mail (cargo, perfil e instituição); a pessoa cria a própria senha pelo link (vale 7 dias) |

Tokens de e-mail (confirmação, convite, recuperação) são aleatórios, guardados só como hash e de uso único. Senhas usam scrypt.

## Endpoints

| Método e rota | Quem acessa |
|---|---|
| `POST /api/auth/login`, `/logout`, `/cadastro`, `/verificar-email`, `/esqueci-senha`, `/redefinir-senha`, `/concluir-cadastro` | público |
| `GET /api/auth/me` | logado |
| `GET /api/veiculos-rotas/instituicoes` | público (lista do cadastro) |
| `GET /api/associados` | presidente, vice, tesoureiro, conselheiro, auxiliar |
| `POST /api/associados/convite`, `/:id/reenviar-convite` | presidente, vice (só o presidente define perfis administrativos) |
| `GET /api/administracao/solicitacoes`, `POST .../:id/decisao` | presidente |

## Conta e administração (etapa 1)

| Recurso | Como funciona |
|---|---|
| Meu perfil | edita nome, telefone, endereço, contato de emergência e instituição (trocar a instituição recalcula a rota) |
| Foto | JPG, PNG ou WebP até 2 MB; o tipo é conferido pelo conteúdo; fica em `UPLOAD_DIR/fotos` e só o dono acessa |
| Trocar senha | pede a senha atual; as outras sessões caem e a atual continua |
| Trocar e-mail | pede a senha atual e envia um link ao **novo** endereço; o e-mail só muda quando o link é aberto; o endereço antigo é avisado |
| Associados | editar (rota só entre as que atendem a instituição) e inativar/reativar; inativar bloqueia o acesso na hora |
| Usuários e perfis | o presidente muda perfil e bloqueia acessos; não altera o próprio acesso; sempre sobra um presidente ativo |
| Parâmetros | valor por dia e multa, gravados no banco |
| Auditoria | filtros por ação e período, paginação; logins, convites, aprovações, trocas de senha/e-mail, alterações de usuário e de parâmetros |

Regra de quem pode o quê em Associados: o vice edita e inativa só associados comuns; cargo ou perfil administrativo é com o presidente.

Endpoints novos: `GET/PATCH /api/perfil`, `POST /api/perfil/senha`, `/email`, `/foto` (+ `GET`/`DELETE`), `PATCH /api/associados/:id`, `POST /api/associados/:id/situacao`, `GET /api/veiculos-rotas/rotas`, e em `/api/administracao`: `usuarios`, `parametros`, `auditoria`, `auditoria/acoes`.

## Veículos e rotas (etapa 2)

| Recurso | Como funciona |
|---|---|
| Veículos | incluir, alterar e remover; placa validada (ABC1D23 ou ABC-1234) e única; capacidade de 1 a 60; um motorista por veículo |
| Rotas | nome, descrição, paradas em ordem (com ↑ ↓) e instituições atendidas |
| Instituições | incluir, alterar e remover; não remove se há associados ou rotas ligados |
| Motoristas | convite por e-mail; a pessoa cria a senha pelo link; perfil `motorista` (não é associado) |

Regras de consistência:
- Mudar uma rota ajusta os associados afetados: se a instituição saiu da rota, ele vai para outra rota que atenda a instituição (ou fica sem rota); se o ponto de embarque deixou de existir, o ponto é limpo. A tela avisa quantos foram ajustados.
- Remover rota só é possível sem veículos, sem associados e sem viagens registradas.
- Reduzir a capacidade, mover ou remover um veículo é recusado se, em dias futuros, as reservas passariam da capacidade restante da rota.
- Só presidente e vice alteram; tesoureiro, conselheiro, auxiliar e motorista consultam.

## Contratos (etapa 3)

| Recurso | Como funciona |
|---|---|
| Contrato | associado ativo, início, término, dias de transporte (segunda a sexta) e valor por dia; o valor padrão vem dos parâmetros e fica gravado no contrato |
| Sobreposição | um associado não pode ter dois contratos vigentes no mesmo período (regra no banco) |
| Aditivo | muda dias, valor por dia e/ou término **a partir de uma data** (hoje ou depois); fica no histórico com quem registrou |
| Correção direta | só enquanto o contrato não tem aditivos nem mensalidades; depois, só por aditivo |
| Encerrar | define a data de encerramento (hoje ou depois) |
| PDF | só PDF de verdade (conferido pelo conteúdo), até 10 MB; baixado como anexo; o associado anexa o dele só se ainda não houver |
| Solicitação | o associado pede mudança de dias; nada muda até presidente, vice ou auxiliar aprovar (aprovar cria o aditivo); o associado é avisado por e-mail |
| Alerta de renovação | faixa na tela e situação "A renovar" quando faltam até N dias (parâmetro, padrão 30); "Vencido" depois do término; botão Prorrogar |

**Mensalidade proporcional.** Cada dia do mês em que o contrato está em vigor vale (dias por semana × valor por dia) ÷ dias do mês, usando a versão do contrato daquele dia. Mês inteiro e sem mudança: dias × valor por dia (5 dias × R$ 50 = R$ 250). Exemplos: contrato que começa no dia 16 de um mês de 30 dias paga 15/30; aditivo no dia 11 trocando 5 por 3 dias paga 10/30 de R$ 250 + 20/30 de R$ 150 = R$ 183,33. O cálculo está em `backend/src/modules/contratos/calculo.ts` e é testado com `npm test` (sem banco). A etapa 4 usa a mesma função para gerar as mensalidades.

Quem pode: presidente, vice e auxiliar alteram; tesoureiro e conselheiro consultam; o associado vê só os próprios contratos.

## Financeiro e contas (etapa 4)

| Recurso | Como funciona |
|---|---|
| Gerar mensalidades | para quem tem contrato no mês; vencimento **sempre dia 10**; valor proporcional ao contrato (soma de todos os contratos do mês); não duplica; mês de 2020 até 12 meses à frente |
| Mudança de contrato | aditivo, encerramento ou solicitação aprovada refazem o valor das mensalidades **em aberto** do mês atual em diante; paga não muda; mês sem valor vira "cancelada" e volta se o contrato voltar |
| Baixa | uma transação grava o pagamento e a receita na conta; multa única de 5% sem juros se pago depois do dia 10 (pode ser dispensada com motivo); só uma baixa ativa por mensalidade |
| Recibo | PDF numerado pelo pagamento; o associado baixa só os dele; recibo estornado sai marcado |
| Estorno de baixa | a mensalidade volta para "em aberto" e entra uma saída na conta; recusa se faltar saldo |
| Contas | caixa ou banco (banco, agência, conta, dígito, tipo, Pix, titular); saldo = saldo inicial + movimentações; saldo inicial fixo depois de criada |
| Inativar / remover | inativar só com saldo zerado; conta com qualquer movimentação nunca é removida |
| Receita / despesa | categorias fixas; despesa sem saldo é recusada; mensalidade só entra pela baixa; não aceita data futura |
| Transferência | saída e entrada gravadas juntas, travando as duas contas sempre na mesma ordem; recusa sem saldo na origem; não conta como receita nem despesa |
| Estorno de movimentação | entra um lançamento oposto (nada é alterado); transferência é estornada nas duas pontas; um estorno por movimentação |
| Consulta | filtros por conta, tipo, período e texto; saldo da conta após cada movimentação; totais de receitas e despesas sem transferências |

Quem pode: presidente e tesoureiro movimentam; vice e conselheiro consultam; o associado vê só as próprias mensalidades e recibos. Os registros de movimentação são imutáveis no banco.

## Atualizar um banco que já existe

Quem já tinha subido o banco aplica as migrações da pasta `database/migrations` em ordem (veja o README de lá).

## Regras já decididas

- Associado é o mesmo que estudante (1 para 1); o convite sugere o perfil pelo cargo e o presidente ajusta.
- Mensalidade = dias contratados × valor por dia. Atraso: multa de 5%, sem juros.
- Regime de caixa, sem plano de contas: só contas de caixa e banco. Saída sem saldo é recusada.
- Conta com movimentação não é removida; só inativada, com saldo zerado.
- Rota escolhida pela instituição e pelo ponto de embarque. Lotação gera alerta.
- Movimentações e auditoria são imutáveis (gatilhos no banco); correção por estorno.
- Notificações por painel e e-mail. Assinatura via gov.br fica para depois.

## Próximos passos

1. Transporte (viagens, reservas, lista de passageiros, alerta de lotação), comunicação, painel e relatórios.
2. Comunicação (cobranças e lembretes por e-mail), relatórios de inadimplência e fluxo de caixa.
3. Testes automáticos e preparação para o servidor próprio.
