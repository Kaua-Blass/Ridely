# TCC · Sistema da associação de transporte escolar

Monorepo em **TypeScript** de ponta a ponta, com **PostgreSQL**.

| Camada | Tecnologia |
|---|---|
| Front-end | React + TypeScript + Vite, HTML e CSS (CSS Modules, sem framework de estilos) |
| Back-end | Node.js + NestJS + TypeScript, um módulo por tela |
| Banco | PostgreSQL 16 (`database/schema.sql`), acesso por Prisma gerado a partir do esquema |
| Arquivos | Pasta `uploads/` no servidor próprio (PDFs e anexos) |

## Estrutura

```
tcc/
  docs/prototipo/tcc-sistema.html   protótipo visual de referência
  database/schema.sql               esquema inicial do PostgreSQL
  frontend/src/pages/<Tela>/        index.tsx, <Tela>.module.css, api.ts, types.ts
  frontend/src/components/          Layout, Sidebar, tabela ordenável, diálogo de formulário
  frontend/src/lib/                 api.ts, auth.tsx, permissoes.ts
  frontend/src/styles/              tokens.css (branco e azul) e global.css
  backend/src/modules/<tela>/       module, controller, service e dto
  backend/src/common/               perfis, guard de permissões, auditoria
```

Uma pasta por tela nos dois lados: `pages/Associados` conversa com `modules/associados`.

## Como começar

```
docker compose up -d                  # sobe o PostgreSQL com o esquema
cd backend  && npm install && npm run start:dev
cd frontend && npm install && npm run dev
```

Depois que o banco estiver no ar: `cd backend && npx prisma db pull && npx prisma generate`.

## Regras já decididas

- Associado é o mesmo que estudante (1 para 1); cargo não é perfil de acesso (o convite sugere o perfil pelo cargo, e o presidente ajusta).
- Mensalidade = dias contratados × valor por dia (parâmetro). Atraso: multa de 5%, sem juros.
- Regime de caixa, sem plano de contas: só contas de caixa e banco. Saída ou transferência sem saldo é recusada.
- Conta com movimentação não é removida; só inativada, e apenas com saldo zerado.
- Rota é escolhida automaticamente pela instituição e pelo ponto de embarque. Lotação gera alerta.
- Movimentações e auditoria são imutáveis (gatilhos no banco); correção por estorno.
- Notificações por painel e e-mail. Assinatura via gov.br fica para depois.

## Próximos passos sugeridos

1. Autenticação (convite, login, recuperação de senha) e perfis.
2. Associados, instituições, rotas e veículos.
3. Financeiro e contas, com as baixas em transação.
4. Contratos, transporte e comunicação.
