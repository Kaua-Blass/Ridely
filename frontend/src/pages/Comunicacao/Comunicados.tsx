import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useEnvio } from '../../lib/useEnvio';
import { comunicados, criarComunicado, destinatarios, editarComunicado, enviarAnexo, removerAnexo, removerComunicado, urlAnexo } from './api';
import styles from './Comunicacao.module.css';
import { Comunicado, Destinatario, Pagina, TIPOS, TIPOS_TESOUREIRO } from './types';

const MAX_ANEXO = 5 * 1024 * 1024;
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

/** Formulário de publicar e de editar (na edição, destinatário e e-mail não mudam: quem já foi avisado continua avisado). */
function Formulario({ editando, aoConcluir, aoCancelar }: { editando: Comunicado | null; aoConcluir: () => void; aoCancelar: () => void }) {
  const { usuario } = useAuth();
  const tiposPermitidos = TIPOS.filter(([t]) => usuario!.perfil !== 'tesoureiro' || TIPOS_TESOUREIRO.includes(t));
  const [tipo, setTipo] = useState<string>(editando?.tipo ?? tiposPermitidos[0][0]);
  const [titulo, setTitulo] = useState(editando?.titulo ?? '');
  const [mensagem, setMensagem] = useState(editando?.mensagem ?? '');
  const [dest, setDest] = useState('');
  const [email, setEmail] = useState(true);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lista, setLista] = useState<Destinatario[]>([]);
  const [anexoAtual, setAnexoAtual] = useState(editando?.anexoNome ?? null);
  const { erro, ok, enviando, executar } = useEnvio();
  useEffect(() => { if (!editando) destinatarios().then(setLista).catch(() => setLista([])); }, [editando]);

  const escolherArquivo = (f: File | null) => {
    if (f && f.size > MAX_ANEXO) { alert('O anexo deve ter até 5 MB.'); return; }
    setArquivo(f);
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    executar(async () => {
      if (editando) {
        await editarComunicado(editando.id, { tipo, titulo, mensagem });
        if (arquivo) await enviarAnexo(editando.id, arquivo);
        aoConcluir();
        return;
      }
      const r = await criarComunicado({ tipo, titulo, mensagem, destinatarioId: dest ? Number(dest) : null, enviarEmail: email });
      if (arquivo) {
        try { await enviarAnexo(r.id, arquivo); }
        catch (x) { aoConcluir(); return `${r.mensagem} Mas o anexo não foi enviado: ${(x as Error).message} Edite o comunicado para anexar de novo.`; }
      }
      aoConcluir();
      return r.mensagem;
    });
  };

  const tirarAnexo = () => {
    if (!editando || !window.confirm('Remover o anexo deste comunicado?')) return;
    executar(async () => { await removerAnexo(editando.id); setAnexoAtual(null); aoConcluir(); });
  };

  return (
    <form className="card" onSubmit={enviar}>
      <h2>{editando ? 'Editar comunicado' : 'Novo comunicado'}</h2>
      <div className="grade">
        <div><label htmlFor="tp">Tipo</label>
          <select id="tp" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {tiposPermitidos.map(([t, n]) => <option key={t} value={t}>{n}</option>)}
          </select></div>
        {!editando && (
          <div><label htmlFor="ds">Para quem</label>
            <select id="ds" value={dest} onChange={(e) => setDest(e.target.value)}>
              <option value="">Todos</option>
              {lista.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select></div>
        )}
      </div>
      <label htmlFor="tt">Título</label>
      <input id="tt" value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} required />
      <label htmlFor="ms">Mensagem</label>
      <textarea id="ms" value={mensagem} maxLength={5000} onChange={(e) => setMensagem(e.target.value)} required />
      {editando && anexoAtual && (
        <p>Anexo atual: <b>{anexoAtual}</b> <button type="button" className="btn sec peq" onClick={tirarAnexo}>Remover anexo</button></p>
      )}
      <label htmlFor="ax">{editando && anexoAtual ? 'Trocar anexo' : 'Anexo (opcional)'} — PDF, JPG, PNG ou WebP, até 5 MB</label>
      <input id="ax" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*" onChange={(e) => escolherArquivo(e.target.files?.[0] ?? null)} />
      {!editando && <label className="opcao"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Avisar também por e-mail</label>}
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
      <div className={styles.acoes}>
        <button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Publicar'}</button>
        <button type="button" className="btn sec" onClick={aoCancelar}>{editando ? 'Cancelar' : 'Fechar'}</button>
      </div>
    </form>
  );
}

export default function Comunicados({ gerente }: { gerente: boolean }) {
  const [dados, setDados] = useState<Pagina<Comunicado> | null>(null);
  const [pagina, setPagina] = useState(1);
  const [erro, setErro] = useState('');
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<Comunicado | null>(null);

  const carregar = useCallback(() => comunicados(pagina).then(setDados).catch((e) => setErro(e.message)), [pagina]);
  useEffect(() => { carregar(); }, [carregar]);

  const remover = async (c: Comunicado) => {
    if (!window.confirm(`Remover o comunicado "${c.titulo}"? As notificações dele também somem.`)) return;
    try { await removerComunicado(c.id); carregar(); } catch (e) { setErro((e as Error).message); }
  };
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1;

  return (
    <>
      {gerente && !novo && !editando && (
        <div className={styles.topo}><h2>Comunicados</h2><button className="btn" onClick={() => setNovo(true)}>Novo comunicado</button></div>
      )}
      {gerente && novo && <Formulario editando={null} aoConcluir={() => { carregar(); }} aoCancelar={() => setNovo(false)} />}
      {gerente && editando && <Formulario key={editando.id} editando={editando} aoConcluir={() => { carregar(); }} aoCancelar={() => setEditando(null)} />}

      <div className="card">
        {!gerente && <h2>Comunicados</h2>}
        {erro && <p role="alert" className="erro">{erro}</p>}
        {dados && dados.itens.length === 0 && <p className={styles.vazio}>Nenhum comunicado por aqui ainda.</p>}
        {dados?.itens.map((c) => (
          <article key={c.id} className={styles.item}>
            <div className={styles.meta}>
              <span className={`tag ${c.tipo === 'cobranca' ? styles.cob : ''}`}>{c.tipoNome}</span>
              <span>{quando(c.criadoEm)}</span>
              {c.criadoPor && <span>por {c.criadoPor}</span>}
              <span>{c.destinatario ? `para ${c.destinatario.nome}` : 'para todos'}</span>
              {c.atualizadoEm && <span>(editado em {quando(c.atualizadoEm)})</span>}
            </div>
            <h3>{c.titulo}</h3>
            <p className={styles.mensagem}>{c.mensagem}</p>
            {c.anexoNome && <a className={styles.anexo} href={urlAnexo(c.id)}>Baixar anexo: {c.anexoNome}</a>}
            {c.entregas && (
              <p className={styles.entregas}>
                Avisou {c.entregas.total} {c.entregas.total === 1 ? 'pessoa' : 'pessoas'}; {c.entregas.lidas} já {c.entregas.lidas === 1 ? 'leu' : 'leram'}.
                {c.entregas.emailsFalharam > 0 && <span className={styles.falha}> {c.entregas.emailsFalharam} e-mail(s) não entregue(s): a rotina "Reenvio de e-mails" tenta de novo.</span>}
              </p>
            )}
            {c.podeEditar && (
              <div className={styles.acoes} style={{ marginTop: 6 }}>
                <button className="btn sec peq" onClick={() => { setNovo(false); setEditando(c); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Editar</button>
                <button className="btn sec peq" onClick={() => remover(c)}>Remover</button>
              </div>
            )}
          </article>
        ))}
        {dados && paginas > 1 && (
          <div className={styles.paginacao}>
            <button className="btn sec peq" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anteriores</button>
            <span>Página {pagina} de {paginas}</span>
            <button className="btn sec peq" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Próximos</button>
          </div>
        )}
      </div>
    </>
  );
}
