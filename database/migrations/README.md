`schema.sql` é a base para um banco novo e já inclui tudo. Os arquivos desta pasta atualizam um banco que já existe. Aplique os que faltam, em ordem:

```
Get-Content .\database\migrations\002_conta_administracao.sql | docker compose exec -T db psql -U ridely -d ridely
Get-Content .\database\migrations\003_veiculos_rotas.sql | docker compose exec -T db psql -U ridely -d ridely
```
Get-Content .\database\migrations\004_contratos.sql | docker compose exec -T db psql -U ridely -d ridely
Get-Content .\database\migrations\005_financeiro.sql | docker compose exec -T db psql -U ridely -d ridely
```

Todos são seguros para rodar mais de uma vez.
