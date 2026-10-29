/** Confere a configuração antes de o servidor subir. Devolve a lista de problemas (vazia = tudo certo). */
export function validarConfiguracao(env: NodeJS.ProcessEnv): string[] {
  const erros: string[] = [];
  for (const v of ['DATABASE_URL', 'JWT_SECRET', 'CPF_CHAVE']) {
    if (!env[v]) erros.push(`Defina ${v} no arquivo backend/.env (veja .env.example).`);
  }
  const producao = env.NODE_ENV === 'production';
  if (producao && env.JWT_SECRET && env.JWT_SECRET.length < 32) {
    erros.push('JWT_SECRET deve ter pelo menos 32 caracteres em produção.');
  }
  if (producao && !(env.APP_URL ?? '').startsWith('https://') && env.PERMITIR_HTTP !== 'true') {
    erros.push('Em produção o APP_URL precisa começar com https:// (o cookie de sessão só é enviado por HTTPS). Para teste local em HTTP, defina PERMITIR_HTTP=true.');
  }
  if (env.CPF_CHAVE && Buffer.from(env.CPF_CHAVE, 'base64').length !== 32) {
    erros.push('CPF_CHAVE deve ter exatamente 32 bytes em base64. Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
  }
  if ((env.TLS_CERT_FILE && !env.TLS_KEY_FILE) || (!env.TLS_CERT_FILE && env.TLS_KEY_FILE)) {
    erros.push('Para HTTPS direto, defina TLS_CERT_FILE e TLS_KEY_FILE juntos.');
  }
  return erros;
}
