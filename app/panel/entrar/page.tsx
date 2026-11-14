import Link from 'next/link';
import Escaparate from '../../Escaparate';
import { Aparecer, Pintar } from '../../animaciones';
import Formulario from './Formulario';

export const metadata = { title: 'Entrar al panel' };

export default function Entrar() {
  return (
    <Escaparate foto="/vidriera/calle.jpg" tema="noche">
      <nav className="mx-auto max-w-5xl px-4 pt-5 sm:px-8">
        <Link href="/" className="etq vd-sombra hover:text-[color:var(--texto)]">← Talón</Link>
      </nav>
      <main className="mx-auto grid max-w-5xl gap-8 px-4 pb-24 pt-[10vh] sm:px-8 lg:grid-cols-[1fr_26rem] lg:items-end">
        <div>
          <Aparecer><p className="etq vd-sombra">Panel del negocio</p></Aparecer>
          <Pintar className="rotulo mt-4 text-[clamp(3rem,9vw,6.5rem)]">Detrás del mostrador</Pintar>
          <Aparecer i={8}>
            <div className="filete mt-6 max-w-md" />
            <p className="vd-sombra mt-4 max-w-[40ch] text-[1.1rem] leading-snug text-[color:var(--texto-2)]">
              La agenda del día, los turnos de la semana, los avisos que salen por WhatsApp y el catálogo del local.
            </p>
          </Aparecer>
        </div>
        <Aparecer i={10}>
          <Formulario />
        </Aparecer>
      </main>
    </Escaparate>
  );
}
