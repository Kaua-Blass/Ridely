`schema.sql` é a base para um banco novo e já inclui tudo. Os arquivos desta pasta atualizam um banco que já existe, em ordem:

```
Get-Content .\database\migrations\002_conta_administracao.sql | docker compose exec -T db psql -U ridely -d ridely
```
