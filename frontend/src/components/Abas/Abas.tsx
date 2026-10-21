import styles from './Abas.module.css';

export default function Abas({ abas, ativa, aoMudar }: { abas: string[]; ativa: string; aoMudar: (a: string) => void }) {
  return (
    <div role="tablist" className={styles.abas}>
      {abas.map((a) => (
        <button key={a} role="tab" aria-selected={a === ativa} className={a === ativa ? styles.on : ''} onClick={() => aoMudar(a)}>{a}</button>
      ))}
    </div>
  );
}
