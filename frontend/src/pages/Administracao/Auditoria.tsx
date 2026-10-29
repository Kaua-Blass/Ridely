import { useCallback, useEffect, useState } from 'react';
import { acoesAuditoria, auditoria, FiltroAuditoria, PaginaAuditoria } from './api';

export default function Auditoria() {
  const [filtro, setFiltro] = useState<FiltroAuditoria>({ pagina: 1 });
  const [acoes, setAcoes] = useState<string[]>([]);
  const [dados, setDados] = useState<PaginaAuditoria | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => { acoesAuditoria().then(setAcoes); }, []);
  const carregar = useCallback(() => auditoria(filtro).then(setDados).catch((e) => setErro(e.message)), [filtro]);
  useEffect(() => { carregar(); }, [carregar]);

  const mudar = (k: keyof FiltroAuditoria, v: string) => setFiltro({ ...filtro, [k]: v || undefined, pagina: 1 });
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1;

  return (
    <div className="card">
      <h2>Auditoria</h2>
      <p className="sub">Quem fez o quê e quando. Os registros não podem ser alterados nem apagados.</p>
      <div className="grade">
        <div><label htmlFor="a">Ação</label>
          <select id="a" value={filtro.acao ?? ''} onChange={(e) => mudar('acao', e.target.value)}><option value="">Todas</option>{acoes.map((a) => <option key={a}>{a}</option>)}</select></div>
        <div><label htmlFor="d">De</label><input id="d" type="date" value={filtro.de ?? ''} onChange={(e) => mudar('de', e.target.value)} /></div>
        <div><label htmlFor="t">Até</label><input id="t" type="date" value={filtro.ate ?? ''} onChange={(e) => mudar('ate', e.target.value)} /></div>
      </div>
      {erro && <p role="alert" className="erro">{erro}</p>}
      <table style={{ marginTop: 12 }}>
        <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Detalhes</th></tr></thead>
        <tbody>{dados?.itens.map((r) => (
          <tr key={r.id}>
            <td>{new Date(r.em).toLocaleString('pt-BR')}</td><td>{r.usuario ?? '—'}</td><td>{r.acao}</td>
            <td title={JSON.stringify(r.detalhes)} style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.detalhes ? JSON.stringify(r.detalhes) : '—'}</td>
          </tr>
        ))}</tbody>
      </table>
      {dados && dados.itens.length === 0 && <p>Nenhum registro encontrado.</p>}
      <div className="linha" style={{ marginTop: 12 }}>
        <span>{dados?.total ?? 0} registros</span>
        <span>
          <button className="btn sec peq" disabled={(filtro.pagina ?? 1) <= 1} onClick={() => setFiltro({ ...filtro, pagina: (filtro.pagina ?? 1) - 1 })}>Anterior</button>{' '}
          Página {filtro.pagina ?? 1} de {paginas}{' '}
          <button className="btn sec peq" disabled={(filtro.pagina ?? 1) >= paginas} onClick={() => setFiltro({ ...filtro, pagina: (filtro.pagina ?? 1) + 1 })}>Próxima</button>
        </span>
      </div>
    </div>
  );
}
