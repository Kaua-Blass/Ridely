import { useState } from 'react';

/** Controla estado de envio, erro e sucesso de um formulário. */
export function useEnvio() {
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function executar(fn: () => Promise<string | void>) {
    setErro(''); setOk(''); setEnviando(true);
    try { const m = await fn(); if (m) setOk(m); }
    catch (e) { setErro((e as Error).message); }
    finally { setEnviando(false); }
  }
  return { erro, ok, enviando, executar };
}
