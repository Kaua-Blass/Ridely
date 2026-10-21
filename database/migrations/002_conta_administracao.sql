-- Etapa 1 (conta e administração). Seguro para rodar mais de uma vez.
ALTER TABLE token_usuario DROP CONSTRAINT IF EXISTS token_usuario_tipo_check;
ALTER TABLE token_usuario ADD CONSTRAINT token_usuario_tipo_check CHECK (tipo IN ('convite','email','email_novo','senha'));
CREATE INDEX IF NOT EXISTS auditoria_em ON auditoria (em DESC);
