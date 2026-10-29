# Testes de interface (Playwright)

Roteiros que abrem o sistema no navegador, com login real, e conferem o que o usuário vê.

## Pré-requisitos

- PostgreSQL 16 com o usuário `ridely` (senha `ridely`) e o banco de testes `ridely_test` (veja o README principal).
- Python 3.10+ com Playwright e o navegador do Playwright:
  ```
  pip install playwright
  python -m playwright install chromium
  ```
- Front-end rodando: `cd frontend && npm run dev` (http://localhost:5173).

## Passo a passo

1. Recriar a demonstração (banco `ridely_ui` + API em http://localhost:3000):
   ```
   bash e2e/reset_demo.sh
   ```
2. Rodar o roteiro da comunicação (Etapa 6), 19 passos:
   ```
   python e2e/roteiro_comunicacao.py
   ```
   As capturas de tela vão para `e2e/capturas/`.
3. Rodar a varredura de telas (todas as telas, com 4 perfis, procurando erros de JavaScript e 5xx):
   ```
   python e2e/varredura_telas.py
   ```

Cada roteiro espera um banco limpo. Rode `reset_demo.sh` antes de cada um.

Usuários de demonstração (senha `Senha-de-teste-1`): `paula@teste.com` (presidente), `vera@teste.com` (vice), `tiago@teste.com` (tesoureiro), `ana@teste.com` e `bruno@teste.com` (associados), `aline@teste.com` (auxiliar).

Para apontar para outro endereço do front: `RIDELY_URL=http://... python e2e/varredura_telas.py`.
