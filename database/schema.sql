-- TCC · esquema inicial (PostgreSQL 15+). Valores em reais: numeric(12,2).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  id serial PRIMARY KEY, nome text NOT NULL, cpf text UNIQUE, telefone text, email text UNIQUE,
  cargo cargo_assoc NOT NULL DEFAULT 'associado', situacao situacao_assoc NOT NULL DEFAULT 'convite',
  instituicao_id int REFERENCES instituicao, rota_id int REFERENCES rota, ponto_embarque text,
  criado_em timestamptz NOT NULL DEFAULT now());
CREATE TABLE usuario (
  id serial PRIMARY KEY, associado_id int UNIQUE REFERENCES associado,
  nome text NOT NULL, email text NOT NULL UNIQUE, senha_hash text NOT NULL,
  perfil perfil_acesso NOT NULL DEFAULT 'associado', ativo boolean NOT NULL DEFAULT true,
  telefone text, endereco text, contato_emergencia text, foto_path text, ultimo_acesso timestamptz);
CREATE TABLE token_usuario ( -- convite, validação de e-mail e recuperação de senha
  id serial PRIMARY KEY, tipo text NOT NULL CHECK (tipo IN ('convite','email','senha')),
  associado_id int REFERENCES associado, usuario_id int REFERENCES usuario,
  token_hash text NOT NULL, expira_em timestamptz NOT NULL, usado_em timestamptz);
CREATE TABLE solicitacao (
  id serial PRIMARY KEY, tipo text NOT NULL CHECK (tipo IN ('associacao','alteracao_contrato')),
  dados jsonb NOT NULL, status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','rejeitada')),
  decidido_por int REFERENCES usuario, criado_em timestamptz NOT NULL DEFAULT now());
CREATE TABLE parametro (chave text PRIMARY KEY, valor text NOT NULL);
INSERT INTO parametro VALUES ('valor_por_dia','50.00'), ('multa_percentual','5');

-- veículos e contratos
CREATE TABLE veiculo (
  id serial PRIMARY KEY, nome text NOT NULL, placa text NOT NULL UNIQUE,
  capacidade int NOT NULL CHECK (capacidade > 0), rota_id int REFERENCES rota,
  motorista_usuario_id int REFERENCES usuario);
CREATE TABLE contrato (
  id serial PRIMARY KEY, associado_id int NOT NULL REFERENCES associado,
  inicio date NOT NULL, fim date NOT NULL, dias_semana smallint[] NOT NULL, pdf_path text, CHECK (fim >= inicio));
CREATE TABLE aditivo (
  id serial PRIMARY KEY, contrato_id int NOT NULL REFERENCES contrato,
  novo_fim date, novos_dias smallint[], criado_em timestamptz NOT NULL DEFAULT now());

-- financeiro (regime de caixa)
CREATE TABLE conta_financeira (
  id serial PRIMARY KEY, nome text NOT NULL, tipo text NOT NULL CHECK (tipo IN ('caixa','banco')),
  banco text, agencia text, numero text, digito text, tipo_conta text, chave_pix text, titular text, observacoes text,
  saldo_inicial numeric(12,2) NOT NULL DEFAULT 0, ativa boolean NOT NULL DEFAULT true);
CREATE TABLE mensalidade (
  id serial PRIMARY KEY, associado_id int NOT NULL REFERENCES associado, contrato_id int REFERENCES contrato,
  referencia char(7) NOT NULL, vencimento date NOT NULL, valor numeric(12,2) NOT NULL,
  UNIQUE (associado_id, referencia));
CREATE TABLE pagamento (
  id serial PRIMARY KEY, mensalidade_id int NOT NULL UNIQUE REFERENCES mensalidade,
  pago_em date NOT NULL, valor numeric(12,2) NOT NULL, multa numeric(12,2) NOT NULL DEFAULT 0,
  forma text NOT NULL, conta_id int NOT NULL REFERENCES conta_financeira);
CREATE TABLE movimentacao (
  id serial PRIMARY KEY, conta_id int NOT NULL REFERENCES conta_financeira, data date NOT NULL,
  tipo tipo_mov NOT NULL, categoria text, historico text, valor numeric(12,2) NOT NULL CHECK (valor > 0),
  pagamento_id int REFERENCES pagamento, transferencia_id uuid,
  criado_por int REFERENCES usuario, criado_em timestamptz NOT NULL DEFAULT now());

-- transporte
CREATE TABLE viagem (
  id serial PRIMARY KEY, data date NOT NULL, rota_id int NOT NULL REFERENCES rota, UNIQUE (data, rota_id));
CREATE TABLE reserva (
  id serial PRIMARY KEY, viagem_id int NOT NULL REFERENCES viagem, associado_id int NOT NULL REFERENCES associado,
  instituicao_id int REFERENCES instituicao, ponto_embarque text,
  status status_reserva NOT NULL DEFAULT 'confirmada', criado_em timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX reserva_ativa_unica ON reserva (viagem_id, associado_id) WHERE status <> 'cancelada';

-- comunicação e auditoria
CREATE TABLE comunicado (
  id serial PRIMARY KEY, tipo text NOT NULL, titulo text NOT NULL, mensagem text,
  destinatario_id int REFERENCES associado, anexo_path text,
  criado_por int REFERENCES usuario, criado_em timestamptz NOT NULL DEFAULT now());
CREATE TABLE auditoria (
  id bigserial PRIMARY KEY, em timestamptz NOT NULL DEFAULT now(),
  usuario_id int REFERENCES usuario, acao text NOT NULL, entidade text, detalhes jsonb);

-- movimentações e auditoria nunca são alteradas ou apagadas: correção por estorno
CREATE FUNCTION bloquear_alteracao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Registro imutável: use estorno'; END $$;
CREATE TRIGGER mov_imutavel BEFORE UPDATE OR DELETE ON movimentacao FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();
CREATE TRIGGER aud_imutavel BEFORE UPDATE OR DELETE ON auditoria FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();
