// El logotipo de la tienda, para el pie de pagina.
//
// Estuvo dentro de Navbar.tsx, pero ese componente es la barra vieja, con el
// desplegable de "Mi cuenta" que ya no se usa. AlCroquet el Navbar entero
// hacia falta para el pie, y romper un archivo por un Logo no tiene sentido.
// Se copia aqui tal cual y el Navbar viejo se puede borrar entero.
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils.js';
import logoUrl from '@/assets/logo.png';

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex shrink-0 items-center gap-2.5', className)} aria-label="Tienda VRA">
      <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-ink-950 p-1 shadow-sm ring-1 ring-amber-500/30">
        <img src={logoUrl} alt="Logo Tienda VRA" className="block h-full w-full object-contain" />
      </span>
      <span className="text-lg leading-tight font-extrabold tracking-tight text-ink-900">
        Tienda <span className="text-brand-600">VRA</span>
      </span>
    </Link>
  );
}
