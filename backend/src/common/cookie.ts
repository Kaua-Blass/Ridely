export const COOKIE = 'ridely_token';
export const opcoesCookie = () => ({
  httpOnly: true, // o JavaScript da página não consegue ler o token
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 8 * 60 * 60 * 1000,
});
