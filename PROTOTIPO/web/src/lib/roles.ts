import type { UsuarioSesion } from './api.js';

const ROLES_PERSONAL = ['Administrador', 'Gerente', 'Encargado de Sucursal', 'Vendedor', 'Cajero'];

export function esPersonal(usuario: UsuarioSesion | null): boolean {
  if (!usuario) return false;
  return ROLES_PERSONAL.includes(usuario.rol ?? '');
}

export function esAdmin(usuario: UsuarioSesion | null): boolean {
  return usuario?.rol === 'Administrador';
}

export function esCliente(usuario: UsuarioSesion | null): boolean {
  if (!usuario) return false;
  const permisos = (usuario.permisos ?? []) as string[];
  return permisos.includes('gestionar_reservas') && !esPersonal(usuario);
}
