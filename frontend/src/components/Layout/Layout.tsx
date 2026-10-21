import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import styles from './Layout.module.css';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.app}>
      <Sidebar />
      <main className={styles.conteudo}>{children}</main>
    </div>
  );
}
