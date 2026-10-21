import { ReactNode, useState } from 'react';

export interface Coluna<T> { titulo: string; ordenar?: (item: T) => string | number; celula: (item: T) => ReactNode }

/** Tabela com ordenação por clique no título (▲▼). Usada em todas as telas com listas. */
export default function DataTable<T>({ colunas, itens }: { colunas: Coluna<T>[]; itens: T[] }) {
  const [ord, setOrd] = useState({ i: 0, d: 1 });
  const f = colunas[ord.i]?.ordenar;
  const lista = f
    ? [...itens].sort((x, y) => {
        const a = f(x), b = f(y);
        return (typeof a === 'string' ? a.localeCompare(String(b), 'pt') : Number(a) - Number(b)) * ord.d;
      })
    : itens;
  return (
    <table>
      <thead>
        <tr>
          {colunas.map((c, i) => (
            <th key={c.titulo}>
              {c.ordenar ? (
                <button onClick={() => setOrd({ i, d: ord.i === i ? -ord.d : 1 })}>
                  {c.titulo}{ord.i === i ? (ord.d > 0 ? ' ▲' : ' ▼') : ''}
                </button>
              ) : c.titulo}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{lista.map((it, k) => <tr key={k}>{colunas.map((c) => <td key={c.titulo}>{c.celula(it)}</td>)}</tr>)}</tbody>
    </table>
  );
}
