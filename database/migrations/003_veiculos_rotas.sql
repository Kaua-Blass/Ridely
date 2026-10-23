-- Etapa 2 (veículos e rotas). Um motorista dirige um veículo por vez. Seguro para rodar mais de uma vez.
CREATE UNIQUE INDEX IF NOT EXISTS veiculo_motorista_unico ON veiculo (motorista_usuario_id) WHERE motorista_usuario_id IS NOT NULL;
