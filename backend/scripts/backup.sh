#!/usr/bin/env bash
# Backup do Ridely: banco de dados (formato do pg_dump) + pasta de uploads, com checksum e retenção.
#
# Uso (a partir da pasta backend):
#   DATABASE_URL=postgresql://... UPLOAD_DIR=./uploads BACKUP_DIR=./backups bash scripts/backup.sh
#
# Variáveis:
#   DATABASE_URL          obrigatória
#   UPLOAD_DIR            pasta de fotos e PDFs (padrão ./uploads)
#   BACKUP_DIR            onde guardar os arquivos (padrão ./backups)
#   BACKUP_RETENCAO_DIAS  apaga backups mais antigos que isso (padrão 14)
#
# Atenção: o backup do banco contém CPFs cifrados. Sem a CPF_CHAVE, eles não podem ser lidos.
# Guarde a chave separadamente dos backups.
set -euo pipefail

: "${DATABASE_URL:?Defina DATABASE_URL}"
UPLOAD_DIR="${UPLOAD_DIR:-./uploads}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENCAO_DIAS="${BACKUP_RETENCAO_DIAS:-14}"

mkdir -p "$BACKUP_DIR"
DATA="$(date +%Y%m%d-%H%M%S)"
BASE="$BACKUP_DIR/ridely-$DATA"

# 1) banco: formato personalizado, comprimido e restaurável seletivamente
pg_dump --format=custom --no-owner --no-privileges --file="$BASE.dump" "$DATABASE_URL"

# 2) uploads (fotos, PDFs de contratos, anexos de comunicados), se a pasta existir
if [ -d "$UPLOAD_DIR" ]; then
  tar -czf "$BASE-uploads.tar.gz" -C "$UPLOAD_DIR" .
fi

# 3) checksums, para detectar arquivo corrompido ou trocado antes de restaurar
( cd "$BACKUP_DIR" && sha256sum "$(basename "$BASE")"* > "$(basename "$BASE").sha256" )

# 4) retenção: remove backups antigos
find "$BACKUP_DIR" -name 'ridely-*' -type f -mtime +"$RETENCAO_DIAS" -delete

echo "Backup concluído: $BASE.dump"
ls -1 "$BACKUP_DIR"/ridely-"$DATA"*
