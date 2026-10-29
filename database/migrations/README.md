`schema.sql` é a base para um banco novo e já inclui tudo. Os arquivos desta pasta atualizam um banco que já existe. Aplique, em ordem, os que faltam a partir da versão que você já tem:

| Arquivo | Etapa do roteiro | O que acrescenta |
|---|---|---|
| `002_conta_administracao.sql` | 1 | perfil, parâmetros, auditoria e solicitações |
| `003_veiculos_rotas.sql` | 2 | veículos, rotas, paradas e instituições |
| `004_contratos.sql` | 3 | contratos, aditivos e PDF |
| `005_financeiro.sql` | 4 | mensalidades, pagamentos, contas e movimentações |
| `006_transporte.sql` | 5 | viagens e reservas |
| `007_comunicacao.sql` | 6 | notificações, histórico de rotinas e os parâmetros de lembrete e cobrança |
| `008_cpf_cifrado.sql` | segurança | colunas do CPF cifrado; depois rode `npm run cpf:migrar` no backend |

Com Docker (no PowerShell, a partir da raiz do projeto):

```
Get-Content .\database\migrations\002_conta_administracao.sql | docker compose exec -T db psql -U ridely -d ridely
Get-Content .\database\migrations\003_veiculos_rotas.sql | docker compose exec -T db psql -U ridely -d ridely
Get-Content .\database\migrations\004_contratos.sql | docker compose exec -T db psql -U ridely -d ridely
Get-Content .\database\migrations\005_financeiro.sql | docker compose exec -T db psql -U ridely -d ridely
Get-Content .\database\migrations\006_transporte.sql | docker compose exec -T db psql -U ridely -d ridely
Get-Content .\database\migrations\007_comunicacao.sql | docker compose exec -T db psql -U ridely -d ridely
```

Sem Docker, com o PostgreSQL local:

```
psql -h localhost -U ridely -d ridely -f database/migrations/007_comunicacao.sql
```

Todos são seguros para rodar mais de uma vez. Atenção: depois da `008`, rode `npm run cpf:migrar` (no diretório `backend`; em produção, `npm run cpf:migrar:producao`) para cifrar os CPFs que já existem. Se o banco já tem as versões anteriores, basta aplicar a partir da que falta.
