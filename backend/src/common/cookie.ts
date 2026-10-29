export const COOKIE = 'ridely_token';

/** Cookie de sessão só é enviado pelo navegador por HTTPS. Por padrão acompanha o endereço da aplicação;
 *  COOKIE_SEGURO permite forçar (true/false). */
export const cookieSeguro = (): boolean =>
  process.env.COOKIE_SEGURO !== undefined ? process.env.COOKIE_SEGURO === 'true' : (process.env.APP_URL ?? '').startsWith('https://');

export const opcoesCookie = () => ({
  httpOnly: true, // o JavaScript da página não consegue ler o token
  sameSite: 'lax' as const,
  secure: cookieSeguro(),
  path: '/',
  maxAge: 8 * 60 * 60 * 1000,
});
