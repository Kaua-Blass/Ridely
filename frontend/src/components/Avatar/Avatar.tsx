/** Foto do usuário logado ou, sem foto, a inicial do nome. */
export default function Avatar({ nome, temFoto, versao, tamanho = 36 }: { nome: string; temFoto: boolean; versao: number; tamanho?: number }) {
  const base = { width: tamanho, height: tamanho, borderRadius: '50%', flexShrink: 0, boxShadow: '0 0 0 2px #fff' } as const;
  return temFoto
    ? <img src={`/api/perfil/foto?v=${versao}`} alt="" style={{ ...base, objectFit: 'cover' }} />
    : <span aria-hidden style={{ ...base, display: 'inline-grid', placeItems: 'center', background: 'var(--primaria)', color: '#fff', fontWeight: 700, fontSize: tamanho / 2.4 }}>{nome[0]}</span>;
}
