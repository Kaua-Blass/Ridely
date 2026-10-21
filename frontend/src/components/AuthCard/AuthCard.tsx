import { ReactNode } from 'react';
import styles from './AuthCard.module.css';

/** Moldura das telas públicas: login, cadastro e recuperação de senha. */
export default function AuthCard({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <div className={styles.fundo}>
      <div className={styles.card}>
        <div className={styles.marca}>Ridely</div>
        <h1>{titulo}</h1>
        {subtitulo && <p className="sub">{subtitulo}</p>}
        {children}
      </div>
    </div>
  );
}
