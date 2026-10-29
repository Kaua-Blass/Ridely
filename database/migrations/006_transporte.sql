-- Etapa 6 do roteiro (transporte). Seguro para rodar mais de uma vez.
ALTER TABLE reserva ADD COLUMN IF NOT EXISTS data date;
UPDATE reserva r SET data = v.data FROM viagem v WHERE v.id = r.viagem_id AND r.data IS NULL;
ALTER TABLE reserva ALTER COLUMN data SET NOT NULL;
ALTER TABLE reserva ADD COLUMN IF NOT EXISTS veiculo_id int REFERENCES veiculo ON DELETE SET NULL;
ALTER TABLE reserva ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();
ALTER TABLE reserva ADD COLUMN IF NOT EXISTS cancelada_em timestamptz;
ALTER TABLE reserva ADD COLUMN IF NOT EXISTS cancelada_por int REFERENCES usuario;
CREATE UNIQUE INDEX IF NOT EXISTS reserva_ativa_por_dia ON reserva (associado_id, data) WHERE status <> 'cancelada';
CREATE INDEX IF NOT EXISTS reserva_viagem ON reserva (viagem_id, status);
CREATE INDEX IF NOT EXISTS reserva_data ON reserva (data);
CREATE TABLE IF NOT EXISTS reserva_evento (
  id bigserial PRIMARY KEY, reserva_id int NOT NULL REFERENCES reserva ON DELETE CASCADE,
  de text, para text NOT NULL, por int REFERENCES usuario, motivo text, em timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS reserva_evento_reserva ON reserva_evento (reserva_id);
INSERT INTO parametro(chave, valor) VALUES ('hora_limite_reserva', '15') ON CONFLICT DO NOTHING;
