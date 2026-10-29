#!/usr/bin/env bash
# Restaura um backup do Ridely no banco indicado em DATABASE_URL.
# ATENÇÃO: substitui os dados desse banco. Por isso exige confirmação explícita.
#
# Uso (a partir da pasta backend):
#   CONFIRMAR_RESTAURACAO=sim DATABASE_URL=postgresql://... UPLOAD_DIR=./uploads \
#     bash scripts/restaura.sh ./backups/ridely-AAAAMMDD-HHMMSS.dump
#
# Se existir o arquivo -uploads.tar.gz ao lado do .dump, ele também é restaurado em UPLOAD_DIR.
set -euo pipefail

ARQ="${1:?Informe o arquivo .dump do backup}"
: "${DATABASE_URL:?Defina DATABASE_URL do banco de destino}"
UPLOAD_DIR="${UPLOAD_DIR:-./uploads}"

if [ "${CONFIRMAR_RESTAURACAO:-}" != "sim" ]; then
  echo "A restauração substitui os dados do banco de destino."
  echo "Para confirmar, defina CONFIRMAR_RESTAURACAO=sim."
  exit 1
fi
[ -f "$ARQ" ] || { echo "Arquivo não encontrado: $ARQ"; exit 1; }

# 1) confere os checksums antes de tocar em qualquer coisa
DIR="$(dirname "$ARQ")"; NOME="$(basename "$ARQ")"
if [ -f "$DIR/$NOME.sha256" ]; then
  ( cd "$DIR" && sha256sum -c --ignore-missing "$NOME.sha256" )
else
  echo "Aviso: $NOME.sha256 não encontrado; o arquivo não pôde ser verificado."
fi

# 2) banco
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$ARQ"

# 3) uploads, se o backup tiver
UPLOADS="${ARQ%.dump}-uploads.tar.gz"
if [ -f "$UPLOADS" ]; then
  mkdir -p "$UPLOAD_DIR"
  tar -xzf "$UPLOADS" -C "$UPLOAD_DIR"
  echo "Uploads restaurados em $UPLOAD_DIR"
fi

echo "Restauração concluída. Confira o sistema e lembre-se de usar a CPF_CHAVE original."
