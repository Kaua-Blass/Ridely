-- Etapa 4 (financeiro). Seguro para rodar mais de uma vez.

-- contratos: nenhum contrato do mesmo associado pode se sobrepor a outro (vigente ou encerrado)
ALTER TABLE contrato DROP CONSTRAINT IF EXISTS contrato_sem_sobreposicao;
ALTER TABLE contrato ADD CONSTRAINT contrato_sem_sobreposicao EXCLUDE USING gist (associado_id WITH =, daterange(inicio, fim, '[]') WITH &&);

-- contas
ALTER TABLE conta_financeira DROP CONSTRAINT IF EXISTS conta_financeira_saldo_inicial_check;
ALTER TABLE conta_financeira ADD CONSTRAINT conta_financeira_saldo_inicial_check CHECK (saldo_inicial >= 0);
CREATE UNIQUE INDEX IF NOT EXISTS conta_nome_unico ON conta_financeira (lower(nome));

-- mensalidades
ALTER TABLE mensalidade ADD COLUMN IF NOT EXISTS cancelada_em timestamptz;
ALTER TABLE mensalidade ADD COLUMN IF NOT EXISTS cancelada_motivo text;
ALTER TABLE mensalidade ADD COLUMN IF NOT EXISTS criado_por int REFERENCES usuario;
ALTER TABLE mensalidade ADD COLUMN IF NOT EXISTS criado_em timestamptz NOT NULL DEFAULT now();
ALTER TABLE mensalidade DROP CONSTRAINT IF EXISTS mensalidade_valor_check;
ALTER TABLE mensalidade ADD CONSTRAINT mensalidade_valor_check CHECK (valor >= 0);
ALTER TABLE mensalidade DROP CONSTRAINT IF EXISTS mensalidade_referencia_check;
ALTER TABLE mensalidade ADD CONSTRAINT mensalidade_referencia_check CHECK (referencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
CREATE INDEX IF NOT EXISTS mensalidade_referencia ON mensalidade (referencia);

-- pagamentos: o estorno desfaz a baixa e a mensalidade pode ser baixada de novo
ALTER TABLE pagamento ADD COLUMN IF NOT EXISTS observacao text;
ALTER TABLE pagamento ADD COLUMN IF NOT EXISTS criado_por int REFERENCES usuario;
ALTER TABLE pagamento ADD COLUMN IF NOT EXISTS criado_em timestamptz NOT NULL DEFAULT now();
ALTER TABLE pagamento ADD COLUMN IF NOT EXISTS estornado_em timestamptz;
ALTER TABLE pagamento ADD COLUMN IF NOT EXISTS estorno_motivo text;
ALTER TABLE pagamento ADD COLUMN IF NOT EXISTS estornado_por int REFERENCES usuario;
ALTER TABLE pagamento DROP CONSTRAINT IF EXISTS pagamento_mensalidade_id_key;
ALTER TABLE pagamento DROP CONSTRAINT IF EXISTS pagamento_valor_check;
ALTER TABLE pagamento ADD CONSTRAINT pagamento_valor_check CHECK (valor > 0);
ALTER TABLE pagamento DROP CONSTRAINT IF EXISTS pagamento_multa_check;
ALTER TABLE pagamento ADD CONSTRAINT pagamento_multa_check CHECK (multa >= 0);
ALTER TABLE pagamento DROP CONSTRAINT IF EXISTS pagamento_forma_check;
ALTER TABLE pagamento ADD CONSTRAINT pagamento_forma_check CHECK (forma IN ('dinheiro','pix','transferencia','cartao'));
CREATE UNIQUE INDEX IF NOT EXISTS pagamento_mensalidade_ativo ON pagamento (mensalidade_id) WHERE estornado_em IS NULL;

-- movimentações: sentido (+1 entra, -1 sai), associado relacionado e estorno
ALTER TABLE movimentacao ADD COLUMN IF NOT EXISTS sinal smallint NOT NULL DEFAULT 1;
ALTER TABLE movimentacao DISABLE TRIGGER mov_imutavel;
UPDATE movimentacao SET sinal = -1 WHERE tipo IN ('despesa', 'transferencia_saida') AND sinal = 1;
ALTER TABLE movimentacao ENABLE TRIGGER mov_imutavel;
ALTER TABLE movimentacao ALTER COLUMN sinal DROP DEFAULT;
ALTER TABLE movimentacao ADD COLUMN IF NOT EXISTS associado_id int REFERENCES associado;
ALTER TABLE movimentacao ADD COLUMN IF NOT EXISTS estorna_id int REFERENCES movimentacao;
ALTER TABLE movimentacao ADD COLUMN IF NOT EXISTS observacao text;
ALTER TABLE movimentacao DROP CONSTRAINT IF EXISTS movimentacao_sinal_check;
ALTER TABLE movimentacao ADD CONSTRAINT movimentacao_sinal_check CHECK (sinal IN (1, -1));
ALTER TABLE movimentacao DROP CONSTRAINT IF EXISTS movimentacao_sinal_tipo_check;
ALTER TABLE movimentacao ADD CONSTRAINT movimentacao_sinal_tipo_check CHECK ((tipo IN ('receita','transferencia_entrada') AND sinal = 1) OR (tipo IN ('despesa','transferencia_saida') AND sinal = -1) OR tipo = 'estorno');
ALTER TABLE movimentacao DROP CONSTRAINT IF EXISTS movimentacao_estorno_check;
ALTER TABLE movimentacao ADD CONSTRAINT movimentacao_estorno_check CHECK ((tipo = 'estorno') = (estorna_id IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS movimentacao_estorno_unico ON movimentacao (estorna_id) WHERE estorna_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS movimentacao_conta_data ON movimentacao (conta_id, data, id);
