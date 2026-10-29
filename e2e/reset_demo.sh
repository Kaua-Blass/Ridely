#!/bin/bash
# Recria o banco de demonstração (ridely_ui) do zero e (re)inicia a API em http://localhost:3000.
# Uso (na raiz do projeto): bash e2e/reset_demo.sh
# Pré-requisito: PostgreSQL 16 com usuário ridely/ridely e o banco de testes criado.
set -u
# A CPF_CHAVE abaixo é fixa e pública: serve SÓ para a demonstração. Nunca use essa chave em produção.
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
export PGPASSWORD=ridely; H="-h localhost -U ridely"
cd "$RAIZ/backend"
pkill -f "ts-node src/main" 2>/dev/null; pkill -f "dist/main.js" 2>/dev/null; sleep 2
dropdb $H --if-exists ridely_ui 2>/dev/null; createdb $H ridely_ui
psql $H -q ridely_ui -f ../database/schema.sql >/dev/null 2>&1
export DATABASE_URL=postgres://ridely:ridely@localhost:5432/ridely_ui CPF_CHAVE=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY= SEED_PRESIDENTE_NOME="Paula Presidente" SEED_PRESIDENTE_EMAIL=paula@teste.com SEED_PRESIDENTE_SENHA=Senha-de-teste-1 JWT_SECRET=x
timeout 120 npx ts-node src/seed.ts >/dev/null 2>&1
HASH=$(timeout 60 npx ts-node -e "import('./src/common/password').then(async m=>console.log(await m.hashSenha('Senha-de-teste-1')))" 2>/dev/null | tail -1)
psql $H -q ridely_ui <<SQL
insert into associado(id,nome,email,situacao,cargo) values (2,'Ana Associada','ana@teste.com','ativo','associado'),(3,'Bruno Associado','bruno@teste.com','ativo','associado'),(4,'Vera Vice','vera@teste.com','ativo','vice_presidente'),(5,'Aline Auxiliar','aline@teste.com','ativo','auxiliar'),(6,'Tiago Tesoureiro','tiago@teste.com','ativo','tesoureiro');
insert into usuario(associado_id,nome,email,senha_hash,perfil) values (2,'Ana Associada','ana@teste.com','$HASH','associado'),(3,'Bruno Associado','bruno@teste.com','$HASH','associado'),(6,'Tiago Tesoureiro','tiago@teste.com','$HASH','tesoureiro'),(4,'Vera Vice','vera@teste.com','$HASH','vice_presidente'),(5,'Aline Auxiliar','aline@teste.com','$HASH','auxiliar');
insert into mensalidade(associado_id,referencia,vencimento,valor) values (2,'2026-10','2026-10-10',250);
insert into contrato(associado_id,inicio,fim,dias_semana,valor_por_dia) values (3,'2026-02-01','2026-11-20','{1,2,3,4,5}',50);
SQL
UPLOADS="$(mktemp -d)"
(DATABASE_URL=$DATABASE_URL CPF_CHAVE=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY= JWT_SECRET=x UPLOAD_DIR=$UPLOADS ROTINAS_AUTOMATICAS=false APP_URL=http://localhost:5173 setsid nohup npx ts-node src/main.ts > /tmp/ridely_api.log 2>&1 < /dev/null &)
for i in $(seq 1 90); do c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'content-type: application/json' -d '{}' http://127.0.0.1:3000/api/auth/login); [ "$c" = "400" ] && echo "demo pronta: API em http://localhost:3000 (usuarios=$(psql $H -tAc 'select count(*) from usuario' ridely_ui))" && exit 0; sleep 1; done
echo "A API não subiu. Veja /tmp/ridely_api.log"; exit 1
