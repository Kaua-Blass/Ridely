import { ReactNode, useState } from 'react';

export interface Coluna<T> { titulo: string; ordenar?: (item: T) => string | number; celula: (item: T) => ReactNode }

/** Tabela com ordenação por clique no título (▲▼) e, se pedido, paginação no navegador. */
export default function DataTable<T>({ colunas, itens, porPagina }: { colunas: Coluna<T>[]; itens: T[]; porPagina?: number }) {
  const [ord, setOrd] = useState({ i: 0, d: 1 });
  const [pag, setPag] = useState(0);
  const f = colunas[ord.i]?.ordenar;
  const lista = f
    ? [...itens].sort((x, y) => {
        const a = f(x), b = f(y);
        return (typeof a === 'string' ? a.localeCompare(String(b), 'pt') : Number(a) - Number(b)) * ord.d;
      })
    : itens;
  const paginas = porPagina ? Math.max(1, Math.ceil(lista.length / porPagina)) : 1;
  const atual = Math.min(pag, paginas - 1);
  const visiveis = porPagina ? lista.slice(atual * porPagina, (atual + 1) * porPagina) : lista;
  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              {colunas.map((c, i) => (
                <th key={c.titulo + i}>
                  {c.ordenar ? (
                    <button onClick={() => { setOrd({ i, d: ord.i === i ? -ord.d : 1 }); setPag(0); }}>
                      {c.titulo}{ord.i === i ? (ord.d > 0 ? ' ▲' : ' ▼') : ''}
                    </button>
                  ) : c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{visiveis.map((it, k) => <tr key={k}>{colunas.map((c, i) => <td key={c.titulo + i}>{c.celula(it)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {lista.length === 0 && <p style={{ color: 'var(--texto-suave)' }}>Nada por aqui ainda.</p>}
      {paginas > 1 && (
        <p style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
          <button className="btn sec peq" disabled={atual === 0} onClick={() => setPag(atual - 1)}>Anterior</button>
          Página {atual + 1} de {paginas} ({lista.length})
          <button className="btn sec peq" disabled={atual >= paginas - 1} onClick={() => setPag(atual + 1)}>Próxima</button>
        </p>
      )}
    </>
  );
}
