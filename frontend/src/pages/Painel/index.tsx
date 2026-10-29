import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { painel } from './api';
import styles from './Painel.module.css';
import type { PainelDados } from './types';

/** Tela: Painel. Indicadores conforme o perfil: gerencial (diretoria), associado e motorista. API: backend/src/modules/painel */
export default function Painel() {
  const { usuario } = useAuth();
  const [dados, setDados] = useState<PainelDados | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => { painel().then(setDados).catch((e) => setErro(e.message)); }, []);
  return (
    <section>
      <h1 className={styles.titulo}>Olá, {usuario?.nome.split(' ')[0]}</h1>
      <p className={styles.sub}>Perfil de acesso: {usuario?.perfil}.</p>
      {erro && <p role="alert" className="erro">{erro}</p>}
      {!dados && !erro && <p className={styles.sub}>Carregando…</p>}
      {dados && (
        <div className={styles.grade}>
          {dados.indicadores.map((i) => (
            <div key={i.rotulo} className={`card ${styles.indicador}`}>
              <span className={styles.rotulo}>{i.rotulo}</span>
              <strong className={styles.valor}>{i.valor}</strong>
              {i.detalhe && <span className={styles.detalhe}>{i.detalhe}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
