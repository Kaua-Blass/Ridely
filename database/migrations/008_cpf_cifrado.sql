-- Segurança: CPF deixa de ficar em texto no banco. Seguro para rodar mais de uma vez.
-- Depois de aplicar esta migração, rode `npm run cpf:migrar` no backend: ele cifra os CPFs que já existem
-- e remove a coluna em texto.
ALTER TABLE associado ADD COLUMN IF NOT EXISTS cpf_cifrado text;
ALTER TABLE associado ADD COLUMN IF NOT EXISTS cpf_busca text;
CREATE UNIQUE INDEX IF NOT EXISTS associado_cpf_busca_key ON associado (cpf_busca);
