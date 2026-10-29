-- Etapa 6 do roteiro (comunicação e notificações). Seguro para rodar mais de uma vez.

-- comunicados: tipo controlado, nome original do anexo e rastro de edição
ALTER TABLE comunicado ADD COLUMN IF NOT EXISTS anexo_nome text;
ALTER TABLE comunicado ADD COLUMN IF NOT EXISTS atualizado_em timestamptz;
ALTER TABLE comunicado ADD COLUMN IF NOT EXISTS atualizado_por int REFERENCES usuario;
UPDATE comunicado SET tipo = 'aviso' WHERE tipo NOT IN ('aviso','noticia','rota','cobranca');
ALTER TABLE comunicado DROP CONSTRAINT IF EXISTS comunicado_tipo_ck;
ALTER TABLE comunicado ADD CONSTRAINT comunicado_tipo_ck CHECK (tipo IN ('aviso','noticia','rota','cobranca'));
CREATE INDEX IF NOT EXISTS comunicado_criado ON comunicado (criado_em DESC);

-- notificações do painel (uma linha por pessoa) com o estado da entrega por e-mail.
-- `chave` identifica o evento das rotinas automáticas: o índice único impede avisar duas vezes a mesma pessoa pelo mesmo motivo.
CREATE TABLE IF NOT EXISTS notificacao (
  id bigserial PRIMARY KEY,
  usuario_id int NOT NULL REFERENCES usuario ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('comunicado','lembrete_vencimento','cobranca_atraso','contrato_a_vencer','resumo_rotina')),
  titulo text NOT NULL, mensagem text NOT NULL, link text,
  comunicado_id int REFERENCES comunicado ON DELETE CASCADE,
  chave text,
  email_status text NOT NULL DEFAULT 'pendente' CHECK (email_status IN ('pendente','enviado','falhou','dispensado','sem_smtp')),
  email_tentativas int NOT NULL DEFAULT 0, email_erro text, email_enviado_em timestamptz,
  lida_em timestamptz, criada_em timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS notificacao_chave ON notificacao (usuario_id, chave) WHERE chave IS NOT NULL;
CREATE INDEX IF NOT EXISTS notificacao_usuario ON notificacao (usuario_id, criada_em DESC);
CREATE INDEX IF NOT EXISTS notificacao_nao_lidas ON notificacao (usuario_id) WHERE lida_em IS NULL;
CREATE INDEX IF NOT EXISTS notificacao_comunicado ON notificacao (comunicado_id) WHERE comunicado_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS notificacao_email_falhou ON notificacao (criada_em) WHERE email_status = 'falhou';

-- histórico das rotinas (agendadas ou executadas na mão)
CREATE TABLE IF NOT EXISTS rotina_execucao (
  id bigserial PRIMARY KEY, rotina text NOT NULL, origem text NOT NULL CHECK (origem IN ('agendada','manual')),
  iniciada_em timestamptz NOT NULL DEFAULT now(), concluida_em timestamptz,
  criadas int NOT NULL DEFAULT 0, ignoradas int NOT NULL DEFAULT 0, erro text, por int REFERENCES usuario);
CREATE INDEX IF NOT EXISTS rotina_execucao_rotina ON rotina_execucao (rotina, iniciada_em DESC);

-- novos parâmetros (0 desliga a rotina)
INSERT INTO parametro(chave, valor) VALUES ('lembrete_vencimento_dias', '3'), ('cobranca_intervalo_dias', '7') ON CONFLICT DO NOTHING;
