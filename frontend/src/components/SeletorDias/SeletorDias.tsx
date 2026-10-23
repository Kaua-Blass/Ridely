const DIAS: [number, string][] = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex']];

/** Dias de transporte da semana (segunda a sexta). */
export default function SeletorDias({ valor, aoMudar }: { valor: number[]; aoMudar: (v: number[]) => void }) {
  const alternar = (d: number) => aoMudar(valor.includes(d) ? valor.filter((x) => x !== d) : [...valor, d].sort((a, b) => a - b));
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      {DIAS.map(([d, nome]) => (
        <label key={d} className="opcao"><input type="checkbox" checked={valor.includes(d)} onChange={() => alternar(d)} />{nome}</label>
      ))}
    </div>
  );
}
