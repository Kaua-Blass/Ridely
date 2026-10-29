-- TCC · esquema inicial (PostgreSQL 15+). Valores em reais: numeric(12,2).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE perfil_acesso AS ENUM ('presidente','vice_presidente','tesoureiro','conselheiro','auxiliar','associado','motorista');
CREATE TYPE cargo_assoc AS ENUM ('associado','presidente','vice_presidente','tesoureiro','conselheiro','auxiliar');
CREATE TYPE situacao_assoc AS ENUM ('convite','ativo','inativo');
CREATE TYPE tipo_mov AS ENUM ('receita','despesa','transferencia_entrada','transferencia_saida','estorno');
CREATE TYPE status_reserva AS ENUM ('confirmada','cancelada','espera','embarcou','faltou');

-- rotas, paradas e instituições
CREATE TABLE instituicao (id serial PRIMARY KEY, nome text NOT NULL UNIQUE);
CREATE TABLE rota (id serial PRIMARY KEY, nome text NOT NULL, descricao text);
CREATE TABLE rota_parada (
  id serial PRIMARY KEY, rota_id int NOT NULL REFERENCES rota ON DELETE CASCADE,
  ordem int NOT NULL, nome text NOT NULL, UNIQUE (rota_id, ordem));
CREATE TABLE rota_instituicao (
  rota_id int REFERENCES rota ON DELETE CASCADE, instituicao_id int REFERENCES instituicao,
  PRIMARY KEY (rota_id, instituicao_id));

-- pessoas e acesso
CREATE TABLE associado (
  id serial PRIMARY KEY, nome text NOT NULL, cpf_cifrado text, cpf_busca text UNIQUE, telefone text, email text UNIQUE,
  cargo cargo_assoc NOT NULL DEFAULT 'associado', situacao situacao_assoc NOT NULL DEFAULT 'convite',
  instituicao_id int REFERENCES instituicao, rota_id int REFERENCES rota, ponto_embarque text,
  criado_em timestamptz NOT NULL DEFAULT now());
CREATE TABLE usuario (
  id serial PRIMARY KEY, associado_id int UNIQUE REFERENCES associado,
  nome text NOT NULL, email text NOT NULL UNIQUE, senha_hash text NOT NULL,
  perfil perfil_acesso NOT NULL DEFAULT 'associado', ativo boolean NOT NULL DEFAULT true,
  telefone text, endereco text, contato_emergencia text, foto_path text, ultimo_acesso timestamptz,
  email_verificado_em timestamptz, senha_alterada_em timestamptz NOT NULL DEFAULT now());
CREATE TABLE token_usuario ( -- convite, validação de e-mail e recuperação de senha
  id serial PRIMARY KEY, tipo text NOT NULL CHECK (tipo IN ('convite','email','email_novo','senha')),
  associado_id int REFERENCES associado, usuario_id int REFERENCES usuario,
  token_hash text NOT NULL, expira_em timestamptz NOT NULL, usado_em timestamptz, dados jsonb);
CREATE TABLE solicitacao (
  id serial PRIMARY KEY, tipo text NOT NULL CHECK (tipo IN ('associacao','alteracao_contrato')),
  dados jsonb NOT NULL, status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','rejeitada')),
  usuario_id int REFERENCES usuario, decidido_por int REFERENCES usuario, criado_em timestamptz NOT NULL DEFAULT now());
CREATE TABLE parametro (chave text PRIMARY KEY, valor text NOT NULL);
INSERT INTO parametro VALUES ('valor_por_dia','50.00'), ('multa_percentual','5'), ('alerta_renovacao_dias','30'), ('hora_limite_reserva','15'),
  ('lembrete_vencimento_dias','3'), ('cobranca_intervalo_dias','7');

-- veículos e contratos
CREATE TABLE veiculo (
  id serial PRIMARY KEY, nome text NOT NULL, placa text NOT NULL UNIQUE,
  capacidade int NOT NULL CHECK (capacidade > 0), rota_id int REFERENCES rota,
  motorista_usuario_id int REFERENCES usuario);
CREATE TABLE contrato (
  id serial PRIMARY KEY, associado_id int NOT NULL REFERENCES associado,
  inicio date NOT NULL, fim date NOT NULL, dias_semana smallint[] NOT NULL, valor_por_dia numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'vigente' CHECK (status IN ('vigente','encerrado')),
  pdf_path text, pdf_nome text, criado_por int REFERENCES usuario, criado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (fim >= inicio),
  CONSTRAINT contrato_dias_check CHECK (cardinality(dias_semana) >= 1 AND dias_semana <@ ARRAY[1,2,3,4,5]::smallint[]),
  CONSTRAINT contrato_sem_sobreposicao EXCLUDE USING gist (associado_id WITH =, daterange(inicio, fim, '[]') WITH &&));
CREATE TABLE aditivo (
  id serial PRIMARY KEY, contrato_id int NOT NULL REFERENCES contrato,
  vigencia_a_partir date NOT NULL, novo_fim date, novos_dias smallint[], novo_valor_por_dia numeric(12,2), observacao text,
  criado_por int REFERENCES usuario, solicitacao_id int REFERENCES solicitacao, criado_em timestamptz NOT NULL DEFAULT now());

-- financeiro (regime de caixa)
CREATE TABLE conta_financeira (
  id serial PRIMARY KEY, nome text NOT NULL, tipo text NOT NULL CHECK (tipo IN ('caixa','banco')),
  banco text, agencia text, numero text, digito text, tipo_conta text, chave_pix text, titular text, observacoes text,
  saldo_inicial numeric(12,2) NOT NULL DEFAULT 0 CHECK (saldo_inicial >= 0), ativa boolean NOT NULL DEFAULT true);
CREATE TABLE mensalidade (
  id serial PRIMARY KEY, associado_id int NOT NULL REFERENCES associado, contrato_id int REFERENCES contrato,
  referencia char(7) NOT NULL, vencimento date NOT NULL, valor numeric(12,2) NOT NULL CHECK (valor >= 0),
  cancelada_em timestamptz, cancelada_motivo text, criado_por int REFERENCES usuario, criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (associado_id, referencia),
  CONSTRAINT mensalidade_referencia_check CHECK (referencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'));
CREATE TABLE pagamento (
  id serial PRIMARY KEY, mensalidade_id int NOT NULL REFERENCES mensalidade,
  pago_em date NOT NULL, valor numeric(12,2) NOT NULL CHECK (valor > 0), multa numeric(12,2) NOT NULL DEFAULT 0 CHECK (multa >= 0),
  forma text NOT NULL CHECK (forma IN ('dinheiro','pix','transferencia','cartao')), conta_id int NOT NULL REFERENCES conta_financeira,
  observacao text, criado_por int REFERENCES usuario, criado_em timestamptz NOT NULL DEFAULT now(),
  estornado_em timestamptz, estorno_motivo text, estornado_por int REFERENCES usuario);
CREATE TABLE movimentacao (
  id serial PRIMARY KEY, conta_id int NOT NULL REFERENCES conta_financeira, data date NOT NULL,
  tipo tipo_mov NOT NULL, categoria text, historico text, valor numeric(12,2) NOT NULL CHECK (valor > 0),
  pagamento_id int REFERENCES pagamento, transferencia_id uuid,
  sinal smallint NOT NULL CHECK (sinal IN (1, -1)), associado_id int REFERENCES associado, estorna_id int REFERENCES movimentacao, observacao text,
  criado_por int REFERENCES usuario, criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT movimentacao_sinal_tipo_check CHECK ((tipo IN ('receita','transferencia_entrada') AND sinal = 1) OR (tipo IN ('despesa','transferencia_saida') AND sinal = -1) OR tipo = 'estorno'),
  CONSTRAINT movimentacao_estorno_check CHECK ((tipo = 'estorno') = (estorna_id IS NOT NULL)));

-- transporte
CREATE TABLE viagem (
  id serial PRIMARY KEY, data date NOT NULL, rota_id int NOT NULL REFERENCES rota, UNIQUE (data, rota_id));
CREATE TABLE reserva (
  id serial PRIMARY KEY, viagem_id int NOT NULL REFERENCES viagem, associado_id int NOT NULL REFERENCES associado,
  instituicao_id int REFERENCES instituicao, ponto_embarque text,
  status status_reserva NOT NULL DEFAULT 'confirmada', criado_em timestamptz NOT NULL DEFAULT now(),
  data date NOT NULL, veiculo_id int REFERENCES veiculo ON DELETE SET NULL, atualizado_em timestamptz NOT NULL DEFAULT now(),
  cancelada_em timestamptz, cancelada_por int REFERENCES usuario);
CREATE UNIQUE INDEX reserva_ativa_unica ON reserva (viagem_id, associado_id) WHERE status <> 'cancelada';

-- comunicação e auditoria
CREATE TABLE comunicado (
  id serial PRIMARY KEY, tipo text NOT NULL CONSTRAINT comunicado_tipo_ck CHECK (tipo IN ('aviso','noticia','rota','cobranca')),
  titulo text NOT NULL, mensagem text,
  destinatario_id int REFERENCES associado, anexo_path text, anexo_nome text,
  criado_por int REFERENCES usuario, criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz, atualizado_por int REFERENCES usuario);
CREATE INDEX comunicado_criado ON comunicado (criado_em DESC);

-- notificações do painel (uma linha por pessoa) com o estado da entrega por e-mail.
-- `chave` identifica o evento das rotinas automáticas: o índice único impede avisar duas vezes a mesma pessoa pelo mesmo motivo.
CREATE TABLE notificacao (
  id bigserial PRIMARY KEY,
  usuario_id int NOT NULL REFERENCES usuario ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('comunicado','lembrete_vencimento','cobranca_atraso','contrato_a_vencer','resumo_rotina')),
  titulo text NOT NULL, mensagem text NOT NULL, link text,
  comunicado_id int REFERENCES comunicado ON DELETE CASCADE,
  chave text,
  email_status text NOT NULL DEFAULT 'pendente' CHECK (email_status IN ('pendente','enviado','falhou','dispensado','sem_smtp')),
  email_tentativas int NOT NULL DEFAULT 0, email_erro text, email_enviado_em timestamptz,
  lida_em timestamptz, criada_em timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX notificacao_chave ON notificacao (usuario_id, chave) WHERE chave IS NOT NULL;
CREATE INDEX notificacao_usuario ON notificacao (usuario_id, criada_em DESC);
CREATE INDEX notificacao_nao_lidas ON notificacao (usuario_id) WHERE lida_em IS NULL;
CREATE INDEX notificacao_comunicado ON notificacao (comunicado_id) WHERE comunicado_id IS NOT NULL;
CREATE INDEX notificacao_email_falhou ON notificacao (criada_em) WHERE email_status = 'falhou';

-- histórico das rotinas (agendadas ou executadas na mão)
CREATE TABLE rotina_execucao (
  id bigserial PRIMARY KEY, rotina text NOT NULL, origem text NOT NULL CHECK (origem IN ('agendada','manual')),
  iniciada_em timestamptz NOT NULL DEFAULT now(), concluida_em timestamptz,
  criadas int NOT NULL DEFAULT 0, ignoradas int NOT NULL DEFAULT 0, erro text, por int REFERENCES usuario);
CREATE INDEX rotina_execucao_rotina ON rotina_execucao (rotina, iniciada_em DESC);
CREATE TABLE auditoria (
  id bigserial PRIMARY KEY, em timestamptz NOT NULL DEFAULT now(),
  usuario_id int REFERENCES usuario, acao text NOT NULL, entidade text, detalhes jsonb);

-- movimentações e auditoria nunca são alteradas ou apagadas: correção por estorno
CREATE FUNCTION bloquear_alteracao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Registro imutável: use estorno'; END $$;
CREATE TRIGGER mov_imutavel BEFORE UPDATE OR DELETE ON movimentacao FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();
CREATE TRIGGER aud_imutavel BEFORE UPDATE OR DELETE ON auditoria FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();

-- e-mails sempre em minúsculas e busca rápida de tokens
ALTER TABLE usuario ADD CONSTRAINT usuario_email_minusculo CHECK (email = lower(email));
ALTER TABLE associado ADD CONSTRAINT associado_email_minusculo CHECK (email IS NULL OR email = lower(email));
CREATE INDEX token_usuario_hash ON token_usuario (token_hash);
CREATE INDEX auditoria_em ON auditoria (em DESC);
CREATE UNIQUE INDEX veiculo_motorista_unico ON veiculo (motorista_usuario_id) WHERE motorista_usuario_id IS NOT NULL;
CREATE INDEX contrato_associado ON contrato (associado_id);
CREATE INDEX aditivo_contrato ON aditivo (contrato_id);

-- financeiro: um pagamento ativo por mensalidade, um estorno por movimentação, nome de conta único
CREATE UNIQUE INDEX pagamento_mensalidade_ativo ON pagamento (mensalidade_id) WHERE estornado_em IS NULL;
CREATE UNIQUE INDEX movimentacao_estorno_unico ON movimentacao (estorna_id) WHERE estorna_id IS NOT NULL;
CREATE UNIQUE INDEX conta_nome_unico ON conta_financeira (lower(nome));
CREATE INDEX movimentacao_conta_data ON movimentacao (conta_id, data, id);
CREATE INDEX mensalidade_referencia ON mensalidade (referencia);

-- transporte: uma reserva ativa por associado por dia; histórico de cada mudança de estado
CREATE UNIQUE INDEX reserva_ativa_por_dia ON reserva (associado_id, data) WHERE status <> 'cancelada';
CREATE INDEX reserva_viagem ON reserva (viagem_id, status);
CREATE INDEX reserva_data ON reserva (data);
CREATE TABLE reserva_evento (
  id bigserial PRIMARY KEY, reserva_id int NOT NULL REFERENCES reserva ON DELETE CASCADE,
  de text, para text NOT NULL, por int REFERENCES usuario, motivo text, em timestamptz NOT NULL DEFAULT now());
CREATE INDEX reserva_evento_reserva ON reserva_evento (reserva_id);
