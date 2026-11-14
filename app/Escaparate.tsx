import type { CSSProperties, ReactNode } from 'react';

/** La vidriera: foto del local fija detrás, velo del color del tema y el contenido adelante. */
export default function Escaparate({ foto, tema, panel, children }: { foto: string | null; tema: 'noche' | 'dia'; panel?: boolean; children: ReactNode }) {
  const estilo = foto ? ({ ['--foto' as string]: `url("${foto}")` } as CSSProperties) : undefined;
  return (
    <div className="vd font-ui" data-tema={tema} data-panel={panel ? '' : undefined} style={estilo}>
      <div className="vd-foto" aria-hidden />
      <div className="vd-velo" aria-hidden />
      {children}
    </div>
  );
}
