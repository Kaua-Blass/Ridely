import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { obter, PerfilCompleto } from './api';
import DadosPessoais from './DadosPessoais';
import Foto from './Foto';
import TrocarEmail from './TrocarEmail';
import TrocarSenha from './TrocarSenha';
import styles from './Perfil.module.css';

/** Tela: Meu perfil. Dados, foto, e-mail e senha do próprio usuário.
 *  API: backend/src/modules/perfil */
export default function Perfil() {
  const { recarregar } = useAuth();
  const [perfil, setPerfil] = useState<PerfilCompleto | null>(null);
  const carregar = useCallback(async () => { setPerfil(await obter()); await recarregar(); }, [recarregar]);
  useEffect(() => { obter().then(setPerfil); }, []);
  if (!perfil) return <p>Carregando…</p>;

  return (
    <section>
      <h1 className={styles.titulo}>Meu perfil</h1>
      <p className={styles.sub}>
        Perfil de acesso: <b>{perfil.perfil}</b>
        {perfil.cargo && <> · Cargo: <b>{perfil.cargo}</b></>}
        {perfil.rota && <> · Rota: <b>{perfil.rota}</b>{perfil.pontoEmbarque && <> ({perfil.pontoEmbarque})</>}</>}
      </p>
      <Foto aoMudar={carregar} />
      <DadosPessoais key={perfil.nome + perfil.instituicaoId} perfil={perfil} aoSalvar={carregar} />
      <TrocarEmail emailAtual={perfil.email} />
      <TrocarSenha />
    </section>
  );
}
