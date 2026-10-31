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
| Cabeçalhos HTTP | `helmet` (Content-Security-Policy, nosniff, anti-clickjacking, sem `X-Powered-By`) |

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

1. **Banco** (escolha uma):
   - Com Docker: `docker compose up -d` (cria o banco `ridely` com as tabelas).
     Se já tinha subido uma versão anterior: `docker compose down -v` e suba de novo.
   - Sem Docker: PostgreSQL 16 local com um usuário `ridely` (senha `ridely`) e um banco `ridely`, e aplique o esquema:
     `psql -h localhost -U ridely -d ridely -f database/schema.sql`
2. **Back-end**:
   ```
   cd backend
   copy .env.example .env      # preencha JWT_SECRET, CPF_CHAVE e os dados do presidente (SEED_*)
   # CPF_CHAVE: gere com node -e "console.log(require('crypto').randomBytes(32).toString('base64'))".
   # Guarde essa chave: sem ela os CPFs cadastrados não podem mais ser lidos.
   npm install
   npm run seed                # cria o presidente, instituições, rotas e contas
   # produção: npm run build && npm run seed:producao (usa o código compilado, sem ts-node)
   npm run start:dev           # API em http://localhost:3000
   # produção: npm run build && npm start
   ```
3. **Front-end**:
   ```
   cd frontend
   npm install
   npm run dev                 # http://localhost:5173
   ```

## Endpoints

| Método e rota | Quem acessa |
|---|---|
| `POST /api/auth/login`, `/logout`, `/cadastro`, `/verificar-email`, `/esqueci-senha`, `/redefinir-senha`, `/concluir-cadastro` | público |
| `GET /api/auth/me` | logado |
| `GET /api/veiculos-rotas/instituicoes` | público (lista do cadastro) |
| `GET /api/associados` | presidente, vice, tesoureiro, conselheiro, auxiliar |
| `POST /api/associados/convite`, `/:id/reenviar-convite` | presidente, vice (só o presidente define perfis administrativos) |
| `GET /api/administracao/solicitacoes`, `POST .../:id/decisao` | presidente |
| `GET/POST /api/comunicacao`, `PATCH/DELETE /api/comunicacao/:id`, `POST/DELETE /api/comunicacao/:id/anexo`, `GET /api/comunicacao/:id/anexo` | leitura: logado (cada um vê o que é para ele); escrita: presidente, vice, tesoureiro |
| `GET /api/comunicacao/notificacoes`, `.../resumo`, `POST .../:id/lida`, `POST .../lidas` | logado (só as próprias) |
| `GET /api/comunicacao/rotinas`, `POST /api/comunicacao/rotinas/:id/executar` | presidente, vice, tesoureiro |
| `GET /api/painel` | logado (indicadores conforme o perfil) |
| `GET /api/relatorios/inadimplencia`, `/fluxo-caixa`, `/contratos-a-vencer`, `/exportar/:tipo?formato=pdf\|csv` | presidente, vice, tesoureiro, conselheiro |

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

## Transporte (etapa 5)

| Recurso | Como funciona |
|---|---|
| Reservar | só dias úteis, até 30 dias à frente, dentro de um contrato em vigor e no dia da semana contratado (já considerando aditivos); uma reserva por associado por dia |
| Prazo | reservar e cancelar vale até as **15:00 do próprio dia** da viagem (parâmetro "hora limite", editável em Administração); depois disso só a equipe cancela |
| Rota automática | escolhida pela instituição e pelo ponto de embarque (primeira rota que atende a instituição e passa pelo ponto) |
| Capacidade | soma dos veículos da rota; reservar na última vaga é seguro mesmo com várias pessoas ao mesmo tempo (a viagem é travada) |
| Lista de espera | viagem lotada: a reserva entra na fila, na ordem de chegada; cancelou alguém confirmado ⇒ o primeiro da fila é **confirmado automaticamente** e avisado por e-mail; incluir ou aumentar um veículo também faz a fila andar |
| Veículos | cada passageiro confirmado fica num veículo da rota (preenche um por vez); a equipe pode mover passageiros; se um veículo sai ou diminui, a viagem é redistribuída |
| Lista de passageiros | por veículo, na ordem das paradas; o motorista vê só o próprio veículo e marca embarcou, faltou ou desfaz (só a partir do dia da viagem) |
| Painel e alertas | lotação dos próximos dias; alerta de lotada ou com fila para presidente, vice e auxiliar |
| Histórico | cada mudança de estado de uma reserva fica em `reserva_evento`; o associado vê o próprio histórico de 60 dias |

Quem pode: associado, presidente, vice e auxiliar reservam para si; presidente, vice e auxiliar cancelam e movimentam qualquer reserva; o motorista só opera o próprio veículo; tesoureiro e conselheiro não têm a tela.

`RELOGIO_FALSO` no `.env` (ex.: `2026-10-26T14:30:00-03:00`) fixa a data e a hora do servidor para testar o prazo das 15:00. É ignorado quando `NODE_ENV=production`.

## Comunicação e notificações (etapa 6)

| Recurso | Como funciona |
|---|---|
| Comunicados | tipos Aviso, Notícia, Rota e Cobrança; destinatário é **todos** ou um associado ativo; criar, editar e remover |
| Quem publica | presidente e vice publicam qualquer tipo; tesoureiro só Cobrança e Aviso |
| Anexo | PDF, JPG, PNG ou WebP até 5 MB; o tipo é conferido pelo conteúdo; o download usa o nome original |
| Editar | corrige o texto, inclusive no painel de quem já foi avisado; **não** envia de novo |
| Notificações | cada pessoa recebe no painel (sino no menu, com contador) e, se marcado, por e-mail; abrir a notificação marca como lida |
| Sem repetição | cada pessoa é avisada uma única vez por motivo (chave única no banco); rodar uma rotina de novo não duplica |
| Entrega por e-mail | cada envio registra o estado: enviado, falhou, sem SMTP ou dispensado; falhas são tentadas de novo (até 3 vezes, nos últimos 3 dias) |
| Rotinas automáticas | **lembrete de vencimento** (mensalidade em aberto que vence em até N dias; padrão 3); **cobrança de atrasados** (uma vez a cada N dias de atraso; padrão 7; valor, multa e total na mensagem); **contratos a vencer** (associado e equipe, nos dias do alerta de renovação e nos últimos 7); **reenvio de e-mails com falha** |
| Agendamento | todo dia às 8h de Brasília, com `@nestjs/schedule`; se o servidor ficar parado, as faixas recuperam o que passou |
| Execução manual | a aba **Rotinas automáticas** roda cada rotina na hora; uma execução por vez (trava no banco); o histórico mostra quem rodou e o resultado |
| Parâmetros | lembrete e intervalo de cobrança em Administração › Parâmetros; **0 desliga** a rotina |

Variáveis do `.env` relacionadas: `APP_URL` (links dos e-mails), `SMTP_URL` (vazio = e-mails só no terminal), `ROTINAS_AUTOMATICAS=false` (desliga o agendamento automático; a execução manual continua funcionando).

## Painel e relatórios (etapa 7)

| Recurso | Como funciona |
|---|---|
| Painel | conteúdo conforme o perfil: diretoria vê saldo em caixa e bancos, mensalidades do mês, inadimplência e contratos a vencer; associado vê as próprias pendências; motorista vê um indicador simples |
| Inadimplência | mensalidades vencidas e não pagas, somadas por associado |
| Fluxo de caixa | receitas, despesas e saldo por mês, em regime de caixa, com período escolhido; transferências não entram |
| Contratos a vencer | contratos vigentes que terminam dentro do prazo de alerta |
| Exportação | PDF e CSV de cada relatório; o CSV usa `;` e BOM, para abrir direto no Excel em português |

Quem vê relatórios: presidente, vice, tesoureiro e conselheiro. Os números são consultas agregadas; nenhum relatório altera dados.

## Testes

| Comando | O que verifica | Precisa de banco? |
|---|---|---|
| `npm test` (em `backend`) | cálculo de mensalidade proporcional e regras das rotinas (lembrete, cobrança, contrato, textos) | não |
| `npm run test:integracao` (em `backend`) | comunicação ponta a ponta: permissões, anexos, notificações, rotinas, falhas de e-mail, trava e agendador (33 casos) | sim |
| `npm run test:integracao:relatorios` (em `backend`) | painel e relatórios: valores do fluxo, inadimplência, contratos, exportação e permissões (12 casos) | sim |
| `npm run test:integracao:seguranca` (em `backend`) | cookie `Secure` conforme o endereço, `HttpOnly`, `SameSite` e cabeçalhos de segurança (6 casos) | sim |
| `npm run test:backup` (em `backend`) | backup e restauração: checksums, restauração em banco novo, CPF legível depois, recusa de arquivo adulterado e retenção (8 casos) | sim (cria dois bancos temporários) |
| `npm run test:integracao:cpf` (em `backend`) | CPF cifrado no cadastro, aprovação e edição; duplicidade; API sem CPF; migração de banco antigo (10 casos) | sim |
| `python e2e/roteiro_comunicacao.py` (na raiz) | comunicação no navegador, com login real: publicar, anexo, sino, editar, rotinas, cobrança (19 passos) | sim, com front e API no ar |
| `python e2e/varredura_telas.py` (na raiz) | abre todas as telas com 4 perfis e procura erros de JavaScript e 5xx (33 telas) | sim, com front e API no ar |

Os testes de integração **apagam e recriam o schema** do banco indicado em `DATABASE_URL`, por isso só rodam se o nome do banco terminar em `_test`:

```
createdb -h localhost -U ridely ridely_test
DATABASE_URL=postgres://ridely:ridely@localhost:5432/ridely_test npm run test:integracao
DATABASE_URL=postgres://ridely:ridely@localhost:5432/ridely_test npm run test:integracao:relatorios
```

`RELOGIO_FALSO` é usado nos testes para fixar a data; em produção é ignorado.

## Atualizar um banco que já existe

Quem já tinha subido o banco aplica as migrações da pasta `database/migrations` em ordem (veja o README de lá). A migração `008` exige, depois, o comando `npm run cpf:migrar`.

## Próximos passos

- Hospedar, no momento rodando só localmente

- Serviço para subir funcionalidade dos e-mails
