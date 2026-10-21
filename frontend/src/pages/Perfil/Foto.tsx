import { ChangeEvent } from 'react';
import Avatar from '../../components/Avatar/Avatar';
import { useAuth } from '../../lib/auth';
import { useEnvio } from '../../lib/useEnvio';
import { enviarFoto, removerFoto } from './api';

export default function Foto({ aoMudar }: { aoMudar: () => Promise<void> }) {
  const { usuario, fotoV } = useAuth();
  const { erro, ok, enviando, executar } = useEnvio();
  if (!usuario) return null;

  function escolher(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    executar(async () => {
      if (arquivo.size > 2 * 1024 * 1024) throw new Error('A imagem deve ter até 2 MB.');
      const r = await enviarFoto(arquivo);
      await aoMudar();
      return r.mensagem;
    });
  }
  const remover = () => executar(async () => { const r = await removerFoto(); await aoMudar(); return r.mensagem; });

  return (
    <div className="card">
      <h2>Foto de perfil</h2>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <Avatar nome={usuario.nome} temFoto={usuario.temFoto} versao={fotoV} tamanho={72} />
        <div>
          <label className="btn sec" style={{ margin: 0, display: 'inline-block', cursor: 'pointer' }}>
            {enviando ? 'Enviando…' : 'Escolher foto'}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={escolher} disabled={enviando} />
          </label>{' '}
          {usuario.temFoto && <button className="btn sec" onClick={remover} disabled={enviando}>Remover</button>}
          <p className="sub" style={{ margin: '8px 0 0' }}>JPG, PNG ou WebP, até 2 MB.</p>
        </div>
      </div>
      {erro && <p role="alert" className="erro">{erro}</p>}
      {ok && <p role="status" className="sucesso">{ok}</p>}
    </div>
  );
}
