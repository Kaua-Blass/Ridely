import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthCard from '../../components/AuthCard/AuthCard';
import { useEnvio } from '../../lib/useEnvio';
import { verificar } from './api';

/** Aberta pelo link do e-mail de confirmação enviado no cadastro. */
export default function VerificarEmail() {
  const token = useSearchParams()[0].get('token') ?? '';
  const { erro, ok, executar } = useEnvio();
  useEffect(() => { executar(async () => (await verificar(token)).mensagem); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthCard titulo="Confirmação de e-mail">
      {ok && <p className="sucesso" role="status">{ok}</p>}
      {erro && <p role="alert" className="erro">{erro}</p>}
      {!ok && !erro && <p>Confirmando…</p>}
      <p><Link to="/login">Ir para o login</Link></p>
    </AuthCard>
  );
}
