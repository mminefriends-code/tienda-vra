import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Request } from 'express';
import { Usuario } from '../seguridad/CE_Modelos.js';
import { BitacoraService } from '../seguridad/SRV_BitacoraService.js';

export interface CheckoutDTO {
  id_carrito: number;
  id_sucursal?: number;
  modalidad: 'Retiro' | 'Entrega';
  metodo_pago: 'Tarjeta' | 'QR' | 'Transferencia';
  nit_cliente?: string | null;
  razon_social?: string | null;
}

export interface VentaPresencialDTO {
  items: Array<{ id_ptc: number; cantidad: number }>;
  id_cliente?: number | null;
  metodo_pago: 'Efectivo' | 'Tarjeta' | 'QR' | 'Transferencia';
  nit_cliente?: string | null;
  razon_social?: string | null;
}

interface Fila {
  [key: string]: unknown;
}

const MODALIDADES = ['Retiro', 'Entrega'];
const METODOS_PAGO = ['Tarjeta', 'QR', 'Transferencia'];
const METODOS_PAGO_POS = ['Efectivo', 'Tarjeta', 'QR', 'Transferencia'];

@Injectable()
export class VentasService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly bitacoraService: BitacoraService,
  ) {}

  private unaFila(resultado: unknown): Fila | undefined {
    const lista = resultado as unknown[];
    if (!Array.isArray(lista) || lista.length === 0) {
      return undefined;
    }
    const primero = lista[0];
    if (Array.isArray(primero)) {
      return (primero.length ? primero[0] : undefined) as Fila | undefined;
    }
    return primero as Fila;
  }

  private async cargarPermisos(usuario: Usuario): Promise<string[]> {
    const [fila] = (await this.dataSource.query(
      `SELECT r.permisos_json
       FROM usuarios u
       JOIN usuarios_roles ur ON ur.id_usuario = u.id_usuario
       JOIN roles r ON r.id_rol = ur.id_rol
       WHERE u.id_usuario = $1`,
      [usuario.id_usuario],
    )) as Array<{ permisos_json: string[] }>;
    return fila?.permisos_json ?? [];
  }

  private async exigirPermisoVenta(usuario: Usuario): Promise<void> {
    const permisos = await this.cargarPermisos(usuario);
    const permitidos = ['*', 'realizar_venta', 'realizar_compra', 'gestionar_carrito', 'ver_catalogo'];
    if (!permisos.some((p) => permitidos.includes(p))) {
      throw new ForbiddenException('No tienes permisos para comprar.');
    }
  }

  private async exigirPermisoRegistrarVenta(usuario: Usuario): Promise<void> {
    const permisos = await this.cargarPermisos(usuario);
    if (!(permisos.includes('*') || permisos.includes('realizar_venta'))) {
      throw new ForbiddenException('No tienes permisos para registrar ventas.');
    }
  }

  private async sucursalDelEmpleado(usuario: Usuario): Promise<number> {
    const [fila] = (await this.dataSource.query(
      `SELECT ue.sucursal_id
       FROM usuarios_empleados ue
       WHERE ue.usuario_id = $1 AND ue.fecha_baja IS NULL`,
      [usuario.id_usuario],
    )) as Array<{ sucursal_id: number }>;
    if (!fila) {
      throw new ForbiddenException('Tu usuario no está asociado a una sucursal.');
    }
    return Number(fila.sucursal_id);
  }

  private async clienteDe(usuario: Usuario): Promise<number> {
    let fila = this.unaFila(
      await this.dataSource.query(
        `SELECT id_cliente FROM clientes WHERE usuario_id = $1`,
        [usuario.id_usuario],
      ),
    );
    if (!fila) {
      const nombreUsuario = (usuario.email || 'Cliente').split('@')[0];
      const res = (await this.dataSource.query(
        `INSERT INTO clientes (usuario_id, nombre, telefono, fecha_registro)
         VALUES ($1, $2, '', NOW())
         RETURNING id_cliente`,
        [usuario.id_usuario, nombreUsuario],
      )) as Array<{ id_cliente: number }>;
      return Number(res[0].id_cliente);
    }
    return Number(fila.id_cliente);
  }

  async crearCompraDigital(
    usuario: Usuario,
    dto: CheckoutDTO,
    request?: Request,
  ): Promise<Record<string, unknown>> {
    await this.exigirPermisoVenta(usuario);
    const idCliente = await this.clienteDe(usuario);

    const modalidad = String(dto.modalidad ?? '');
    if (!MODALIDADES.includes(modalidad)) {
      throw new UnprocessableEntityException('Modalidad de entrega inválida.');
    }
    const metodoPago = String(dto.metodo_pago ?? '');
    if (!METODOS_PAGO.includes(metodoPago)) {
      throw new UnprocessableEntityException('Método de pago inválido.');
    }
    const nitCliente = dto.nit_cliente && String(dto.nit_cliente).trim() ? String(dto.nit_cliente).trim() : null;
    const razonSocial = dto.razon_social && String(dto.razon_social).trim() ? String(dto.razon_social).trim() : null;

    const idCarrito = Math.trunc(Number(dto.id_carrito));
    if (!Number.isInteger(idCarrito) || idCarrito <= 0) {
      throw new NotFoundException('Carrito no encontrado.');
    }

    let idSucursal = dto.id_sucursal ? Math.trunc(Number(dto.id_sucursal)) : NaN;

    const carrito = this.unaFila(
      await this.dataSource.query(
        `SELECT c.id_carrito, c.id_sucursal, c.estado, c.id_usuario
         FROM carritos c
         WHERE c.id_carrito = $1
         LIMIT 1`,
        [idCarrito],
      ),
    );
    if (!carrito || Number(carrito.id_usuario) !== usuario.id_usuario) {
      throw new NotFoundException('Carrito no encontrado.');
    }
    const estadoCarrito = String(carrito.estado ?? '').toLowerCase();
    if (estadoCarrito !== 'activo') {
      throw new ConflictException('Este carrito ya fue procesado.');
    }
    if (!Number.isInteger(idSucursal) || idSucursal <= 0) {
      idSucursal = Number(carrito.id_sucursal);
    }
    if (!Number.isInteger(idSucursal) || idSucursal <= 0) {
      const central = this.unaFila(
        await this.dataSource.query(
          `SELECT id_sucursal FROM sucursales
           WHERE (es_central = true OR LOWER(nombre) LIKE '%central%') AND LOWER(estado) = 'activa'
           ORDER BY id_sucursal ASC LIMIT 1`,
        ),
      );
      if (central) {
        idSucursal = Number(central.id_sucursal);
      } else {
        const primera = this.unaFila(
          await this.dataSource.query(
            `SELECT id_sucursal FROM sucursales WHERE LOWER(estado) = 'activa' ORDER BY id_sucursal ASC LIMIT 1`,
          ),
        );
        idSucursal = primera ? Number(primera.id_sucursal) : 1;
      }
    }

    const sucursal = this.unaFila(
      await this.dataSource.query(
        `SELECT id_sucursal, nombre, estado FROM sucursales WHERE id_sucursal = $1`,
        [idSucursal],
      ),
    );
    if (!sucursal || String(sucursal.estado ?? '').toLowerCase() !== 'activa') {
      throw new UnprocessableEntityException('La sucursal seleccionada no está disponible.');
    }

    const items = (await this.dataSource.query(
      `SELECT ci.id_carrito_item, ci.id_ptc, ci.cantidad, ci.precio_unitario,
p.nombre AS nombre_producto, p.codigo, p.precio_base, p.porcentaje_iva,
               cat.nombre AS categoria_nombre, cat.porcentaje_iva_default, cat.estado AS estado_categoria,
              t.nombre AS talla, cl.nombre AS color, p.estado AS estado_producto, ptc.estado_stock,
              ist.cantidad_disponible, ist.stock_minimo_alert
       FROM carrito_items ci
       JOIN carritos c ON c.id_carrito = ci.id_carrito
       JOIN producto_talla_color ptc ON ptc.id_ptc = ci.id_ptc
       JOIN productos p ON p.id_producto = ptc.id_producto
       LEFT JOIN categorias cat ON cat.id_categoria = p.id_categoria
       JOIN tallas t ON t.id_talla = ptc.id_talla
       JOIN colores cl ON cl.id_color = ptc.id_color
       LEFT JOIN inventario_stock ist ON ist.id_ptc = ci.id_ptc AND ist.id_sucursal = $2
       WHERE ci.id_carrito = $1
       ORDER BY ci.id_carrito_item ASC`,
      [idCarrito, idSucursal],
    )) as Fila[];

    if (items.length === 0) {
      throw new UnprocessableEntityException('Tu carrito está vacío.');
    }

    // E5: revalidar disponibilidad actual de cada ítem
    for (const item of items) {
      const cantidad = Number(item.cantidad ?? 0);
      const disponible = Number(item.cantidad_disponible ?? 0);
      const prenda = `${item.nombre_producto ?? ''} (${item.talla ?? ''}, ${item.color ?? ''})`;
      if (String(item.estado_producto ?? '').toLowerCase() !== 'activo' || String(item.estado_stock ?? '').toLowerCase() !== 'disponible') {
        throw new ConflictException(
          `El stock de ${prenda.trim()} cambió. Ya no está disponible. Ajusta tu carrito e intenta de nuevo.`,
        );
      }
      if (disponible < cantidad) {
        throw new ConflictException(
          `El stock de ${prenda.trim()} cambió. Disponible: ${disponible}${Number(item.stock_minimo_alert ?? 0) > 0 ? ` (mínimo ${item.stock_minimo_alert})` : ''}. Ajusta tu carrito e intenta de nuevo.`,
        );
      }
    }

    // (d) calcula subtotal, impuestos por ítem y total
    let subtotal = 0;
    let impuestos = 0;
    const lineas = items.map((item) => {
      const cantidad = Number(item.cantidad ?? 0);
      const precioUnitario = Number(item.precio_unitario ?? 0);
      const sub = cantidad * precioUnitario;
      const ivaProducto = Number(item.porcentaje_iva);
      const ivaCategoria = Number(item.porcentaje_iva_default ?? 0);
      const tasa = !Number.isNaN(ivaProducto) && ivaProducto > 0 ? ivaProducto : ivaCategoria;
      const imp = sub * (tasa / 100);
      subtotal += sub;
      impuestos += imp;
      return {
        id_ptc: Number(item.id_ptc),
        cantidad,
        precio_unitario: precioUnitario,
        subtotal: sub,
      };
    });

    subtotal = Math.round(subtotal * 100) / 100;
    impuestos = Math.round(impuestos * 100) / 100;
    const total = Math.round((subtotal + impuestos) * 100) / 100;

    let idVenta = 0;
    await this.dataSource.transaction(async (em) => {
      const creado = this.unaFila(
        await em.query(
          `INSERT INTO ventas (id_cliente, id_usuario, id_sucursal, id_carrito, modalidad, metodo_pago,
                               subtotal, impuestos, total, estado, fecha_venta)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pendiente', NOW())
           RETURNING id_venta`,
          [idCliente, usuario.id_usuario, idSucursal, idCarrito, modalidad, metodoPago, subtotal, impuestos, total],
        ),
      );
      if (!creado) {
        throw new Error('No se pudo registrar la venta.');
      }
      idVenta = Number(creado.id_venta);

      for (const linea of lineas) {
        await em.query(
          `INSERT INTO venta_items (id_venta, id_ptc, cantidad, precio_unitario, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [idVenta, linea.id_ptc, linea.cantidad, linea.precio_unitario, linea.subtotal],
        );
      }

      // (f) marca el carrito como 'En pago'
      await em.query(
        `UPDATE carritos SET estado = 'En pago' WHERE id_carrito = $1`,
        [idCarrito],
      );
    });

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'INSERT',
      'ventas',
      `Compra digital creada (venta #${idVenta}) por Bs ${total.toFixed(2)} — ${modalidad}, ${metodoPago}.`,
      request,
      idVenta,
      null,
      {
        total,
        modalidad,
        metodo_pago: metodoPago,
        id_carrito: idCarrito,
        id_sucursal: idSucursal,
        nit_cliente: nitCliente,
        razon_social: razonSocial,
        items: lineas.map((l) => ({ id_ptc: l.id_ptc, cantidad: l.cantidad, precio_unitario: l.precio_unitario })),
      },
    );

    return {
      id_venta: idVenta,
      total,
      estado: 'Pendiente',
      resumen: {
        id_carrito: idCarrito,
        modalidad,
        metodo_pago: metodoPago,
        id_sucursal: idSucursal,
        sucursal: sucursal.nombre,
        subtotal,
        impuestos,
        total,
        items: lineas,
      },
    };
  }

  // ===== Punto de Venta (POS) — CU36 =====

  async buscarProductosPos(
    usuario: Usuario,
    busqueda?: string,
    limite = 30,
  ): Promise<Record<string, unknown>[]> {
    await this.exigirPermisoRegistrarVenta(usuario);
    const idSucursal = await this.sucursalDelEmpleado(usuario);

    const termino = busqueda && String(busqueda).trim() ? `%${String(busqueda).trim()}%` : null;
    const params: unknown[] = [idSucursal];
    let where = `p.estado = 'Activo' AND ptc.estado_stock <> 'Sin stock'`;
    if (termino) {
      params.push(termino);
      where += ` AND (p.codigo ILIKE $${params.length} OR p.nombre ILIKE $${params.length})`;
    }
    params.push(Math.min(Math.max(Math.trunc(Number(limite) || 30), 1), 100));

    const filas = (await this.dataSource.query(
      `SELECT ptc.id_ptc, p.id_producto, p.codigo, p.nombre, p.precio_base,
              COALESCE(NULLIF(pp.precio::text, ''), NULL) AS precio_especial,
              p.porcentaje_iva, cat.porcentaje_iva_default,
              t.nombre AS talla, cl.nombre AS color, ptc.estado_stock,
              ist.cantidad_disponible
       FROM producto_talla_color ptc
       JOIN productos p ON p.id_producto = ptc.id_producto
       LEFT JOIN categorias cat ON cat.id_categoria = p.id_categoria
       JOIN tallas t ON t.id_talla = ptc.id_talla
       JOIN colores cl ON cl.id_color = ptc.id_color
       LEFT JOIN producto_precios pp ON pp.id_ptc = ptc.id_ptc
          AND pp.fecha_inicio <= CURRENT_DATE
          AND (pp.fecha_fin IS NULL OR pp.fecha_fin >= CURRENT_DATE)
       LEFT JOIN inventario_stock ist ON ist.id_ptc = ptc.id_ptc AND ist.id_sucursal = $1
       WHERE ${where}
       ORDER BY p.nombre ASC, t.orden ASC, cl.nombre ASC
       LIMIT $${params.length}`,
      params,
    )) as Fila[];

    return filas.map((f) => {
      const precioEspecial = f.precio_especial != null ? Number(f.precio_especial) : NaN;
      const precioUnitario = !Number.isNaN(precioEspecial) ? precioEspecial : Number(f.precio_base ?? 0);
      const ivaProducto = Number(f.porcentaje_iva);
      const ivaCategoria = Number(f.porcentaje_iva_default ?? 0);
      const tasa = !Number.isNaN(ivaProducto) && ivaProducto > 0 ? ivaProducto : ivaCategoria;
      return {
        id_ptc: Number(f.id_ptc),
        id_producto: Number(f.id_producto),
        codigo: f.codigo ?? null,
        nombre: f.nombre ?? null,
        talla: f.talla ?? null,
        color: f.color ?? null,
        precio_unitario: precioUnitario,
        porcentaje_iva: tasa,
        cantidad_disponible: Number(f.cantidad_disponible ?? 0),
      };
    });
  }

  async buscarClientesPos(usuario: Usuario, busqueda?: string, limite = 10): Promise<Record<string, unknown>[]> {
    await this.exigirPermisoRegistrarVenta(usuario);
    await this.sucursalDelEmpleado(usuario);

    const termino = busqueda && String(busqueda).trim() ? `%${String(busqueda).trim()}%` : null;
    const params: unknown[] = [];
    let where = `c.usuario_id IS NOT NULL`;
    if (termino) {
      params.push(termino);
      where += ` AND (u.email ILIKE $${params.length} OR u.ci ILIKE $${params.length} OR c.nombre ILIKE $${params.length})`;
    }
    params.push(Math.min(Math.max(Math.trunc(Number(limite) || 10), 1), 50));

    const filas = (await this.dataSource.query(
      `SELECT c.id_cliente, c.nombre, c.telefono, c.direccion,
              u.email, u.ci
       FROM clientes c
       LEFT JOIN usuarios u ON u.id_usuario = c.usuario_id
       WHERE ${where}
       ORDER BY c.nombre ASC
       LIMIT $${params.length}`,
      params,
    )) as Fila[];

    return filas.map((f) => ({
      id_cliente: Number(f.id_cliente),
      nombre: f.nombre ?? 'Consumidor final',
      email: f.email ?? null,
      ci: f.ci ?? null,
      telefono: f.telefono ?? null,
    }));
  }

  async crearVentaPresencial(
    usuario: Usuario,
    dto: VentaPresencialDTO,
    request?: Request,
  ): Promise<Record<string, unknown>> {
    await this.exigirPermisoRegistrarVenta(usuario);
    const idSucursal = await this.sucursalDelEmpleado(usuario);

    const metodoPago = String(dto.metodo_pago ?? '');
    if (!METODOS_PAGO_POS.includes(metodoPago)) {
      throw new UnprocessableEntityException('Método de pago inválido.');
    }
    const nitCliente = dto.nit_cliente && String(dto.nit_cliente).trim() ? String(dto.nit_cliente).trim() : null;
    const razonSocial = dto.razon_social && String(dto.razon_social).trim() ? String(dto.razon_social).trim() : null;

    const itemsCrudos = Array.isArray(dto.items) ? dto.items : [];
    if (itemsCrudos.length === 0) {
      throw new UnprocessableEntityException('Debes agregar al menos una prenda a la venta.');
    }

    let idCliente: number | null = null;
    if (dto.id_cliente != null) {
      const clienteValido = this.unaFila(
        await this.dataSource.query(
          `SELECT id_cliente FROM clientes WHERE id_cliente = $1`,
          [Math.trunc(Number(dto.id_cliente))],
        ),
      );
      if (!clienteValido) {
        throw new UnprocessableEntityException('Cliente no encontrado.');
      }
      idCliente = Number(clienteValido.id_cliente);
    }

    // Validación de ítems y carga de prendas
    const pedido: Array<{ id_ptc: number; cantidad: number }> = [];
    for (const crudo of itemsCrudos) {
      const idPtc = Math.trunc(Number(crudo?.id_ptc));
      const cantidad = Number(crudo?.cantidad);
      if (!Number.isInteger(idPtc) || idPtc <= 0) {
        throw new UnprocessableEntityException('Prenda no encontrada.');
      }
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        throw new UnprocessableEntityException('La cantidad debe ser mayor a cero.');
      }
      pedido.push({ id_ptc: idPtc, cantidad });
    }

    // (b) valida cada id_ptc y stock; (c) precio vigente
    const lineas: Array<{
      id_ptc: number;
      cantidad: number;
      precio_unitario: number;
      subtotal: number;
    }> = [];
    let subtotal = 0;
    let impuestos = 0;

    for (const p of pedido) {
      const prenda = this.unaFila(
        await this.dataSource.query(
          `SELECT ptc.id_ptc, p.nombre AS nombre_producto, p.precio_base, p.porcentaje_iva,
                  p.estado AS estado_producto,
                  cat.porcentaje_iva_default, t.nombre AS talla, cl.nombre AS color,
                  ptc.estado_stock, ist.cantidad_disponible,
                  COALESCE(NULLIF(pp.precio::text, ''), NULL) AS precio_especial
           FROM producto_talla_color ptc
           JOIN productos p ON p.id_producto = ptc.id_producto
           LEFT JOIN categorias cat ON cat.id_categoria = p.id_categoria
           JOIN tallas t ON t.id_talla = ptc.id_talla
           JOIN colores cl ON cl.id_color = ptc.id_color
           LEFT JOIN producto_precios pp ON pp.id_ptc = ptc.id_ptc
              AND pp.fecha_inicio <= CURRENT_DATE
              AND (pp.fecha_fin IS NULL OR pp.fecha_fin >= CURRENT_DATE)
           LEFT JOIN inventario_stock ist ON ist.id_ptc = ptc.id_ptc AND ist.id_sucursal = $2
           WHERE ptc.id_ptc = $1
           LIMIT 1`,
          [p.id_ptc, idSucursal],
        ),
      );
      if (!prenda) {
        throw new UnprocessableEntityException('Prenda no encontrada.');
      }
      const estadoProd = String(prenda.estado_producto ?? 'Activo').toLowerCase();
      if (estadoProd !== 'activo' && estadoProd !== 'disponible') {
        throw new UnprocessableEntityException('Prenda no encontrada.');
      }

      const disponible = Number(prenda.cantidad_disponible ?? 0);
      if (p.cantidad > disponible) {
        throw new ConflictException(
          `Stock insuficiente de ${prenda.nombre_producto ?? ''} (${prenda.talla ?? ''}, ${prenda.color ?? ''}). Disponible: ${disponible}.`,
        );
      }

      const precioEspecial = prenda.precio_especial != null ? Number(prenda.precio_especial) : NaN;
      const precioUnitario = !Number.isNaN(precioEspecial) ? precioEspecial : Number(prenda.precio_base ?? 0);
      const ivaProducto = Number(prenda.porcentaje_iva);
      const ivaCategoria = Number(prenda.porcentaje_iva_default ?? 0);
      const tasa = !Number.isNaN(ivaProducto) && ivaProducto > 0 ? ivaProducto : ivaCategoria;

      const sub = p.cantidad * precioUnitario;
      const imp = sub * (tasa / 100);
      subtotal += sub;
      impuestos += imp;
      lineas.push({
        id_ptc: p.id_ptc,
        cantidad: p.cantidad,
        precio_unitario: precioUnitario,
        subtotal: sub,
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    impuestos = Math.round(impuestos * 100) / 100;
    const total = Math.round((subtotal + impuestos) * 100) / 100;

    let idVenta = 0;
    await this.dataSource.transaction(async (em) => {
      const creado = this.unaFila(
        await em.query(
          `INSERT INTO ventas (id_cliente, id_usuario, id_sucursal, id_carrito, modalidad, metodo_pago,
                               subtotal, impuestos, total, estado, fecha_venta)
           VALUES ($1, $2, $3, NULL, 'Presencial', $4, $5, $6, $7, 'Pendiente', NOW())
           RETURNING id_venta`,
          [idCliente, usuario.id_usuario, idSucursal, metodoPago, subtotal, impuestos, total],
        ),
      );
      if (!creado) {
        throw new Error('No se pudo registrar la venta.');
      }
      idVenta = Number(creado.id_venta);

      for (const linea of lineas) {
        await em.query(
          `INSERT INTO venta_items (id_venta, id_ptc, cantidad, precio_unitario, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [idVenta, linea.id_ptc, linea.cantidad, linea.precio_unitario, linea.subtotal],
        );
      }
    });

    await this.bitacoraService.registrar(
      usuario.id_usuario,
      'INSERT',
      'ventas',
      `Venta presencial creada (venta #${idVenta}) por Bs ${total.toFixed(2)} — Pago en ${metodoPago}.`,
      request,
      idVenta,
      null,
      {
        total,
        modalidad: 'Presencial',
        metodo_pago: metodoPago,
        id_sucursal: idSucursal,
        id_cliente: idCliente,
        nit_cliente: nitCliente,
        razon_social: razonSocial,
        items: lineas.map((l) => ({ id_ptc: l.id_ptc, cantidad: l.cantidad, precio_unitario: l.precio_unitario })),
      },
    );

    return {
      id_venta: idVenta,
      total,
      estado: 'Pendiente',
      items: lineas.map((l) => ({ id_ptc: l.id_ptc, cantidad: l.cantidad, precio_unitario: l.precio_unitario })),
    };
  }

  /**
   * Sincronización de transacciones generadas en modo Offline / Sin Internet.
   * Recibe una lista de ventas acumuladas localmente en Web o Móvil y las consolida en la BD.
   */
  async sincronizarLoteOffline(
    usuario: Usuario,
    ventasOffline: Array<{
      id_offline_temporal: string;
      items: Array<{ id_ptc: number; cantidad: number }>;
      id_cliente?: number | null;
      metodo_pago: 'Efectivo' | 'Tarjeta' | 'QR' | 'Transferencia';
      nit_cliente?: string | null;
      razon_social?: string | null;
      fecha_offline?: string;
    }>,
    request: Request,
  ) {
    let idSucursal = 1;
    try {
      idSucursal = await this.sucursalDelEmpleado(usuario);
    } catch {
      idSucursal = 1;
    }
    const resultados = [];

    for (const v of ventasOffline) {
      try {
        let subtotal = 0;
        let impuestos = 0;
        const lineas: Array<{ id_ptc: number; cantidad: number; precio_unitario: number; subtotal: number }> = [];

        for (const item of v.items) {
          const [prenda] = (await this.dataSource.query(
            `SELECT p.id_producto, ptc.id_ptc, p.precio_base, pre.precio AS precio_especial,
                    cat.porcentaje_iva_default, p.porcentaje_iva
             FROM producto_talla_color ptc
             JOIN productos p ON p.id_producto = ptc.id_producto
             JOIN categorias cat ON cat.id_categoria = p.id_categoria
             LEFT JOIN producto_precios pre ON pre.id_ptc = ptc.id_ptc
             WHERE ptc.id_ptc = $1`,
            [item.id_ptc],
          )) as Array<{
            id_producto: number;
            id_ptc: number;
            precio_base: number;
            precio_especial: number | null;
            porcentaje_iva_default: number;
            porcentaje_iva: number;
          }>;

          if (prenda) {
            const precioUnitario = prenda.precio_especial != null ? Number(prenda.precio_especial) : Number(prenda.precio_base ?? 0);
            const sub = item.cantidad * precioUnitario;
            const imp = sub * (Number(prenda.porcentaje_iva || prenda.porcentaje_iva_default || 0) / 100);
            subtotal += sub;
            impuestos += imp;
            lineas.push({
              id_ptc: item.id_ptc,
              cantidad: item.cantidad,
              precio_unitario: precioUnitario,
              subtotal: sub,
            });
          }
        }

        subtotal = Math.round(subtotal * 100) / 100;
        impuestos = Math.round(impuestos * 100) / 100;
        const total = Math.round((subtotal + impuestos) * 100) / 100;
        const numFactura = `FAC-SYNC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

        let idVenta = 0;
        await this.dataSource.transaction(async (em) => {
          const creado = this.unaFila(
            await em.query(
              `INSERT INTO ventas (numero_factura, id_cliente, id_usuario, id_sucursal, modalidad, metodo_pago,
                                   subtotal, impuestos, total, estado, fecha_venta)
               VALUES ($1, $2, $3, $4, 'Presencial', $5, $6, $7, $8, 'Completada', COALESCE($9::timestamp, NOW()))
               RETURNING id_venta`,
              [
                numFactura,
                v.id_cliente || null,
                usuario.id_usuario,
                idSucursal,
                v.metodo_pago,
                subtotal,
                impuestos,
                total,
                v.fecha_offline || null,
              ],
            ),
          );

          if (creado) {
            idVenta = Number(creado.id_venta);
            for (const l of lineas) {
              await em.query(
                `INSERT INTO venta_items (id_venta, id_ptc, cantidad, precio_unitario, subtotal)
                 VALUES ($1, $2, $3, $4, $5)`,
                [idVenta, l.id_ptc, l.cantidad, l.precio_unitario, l.subtotal],
              );

              // Rebaja de inventario
              await em.query(
                `UPDATE inventario_stock
                 SET cantidad_disponible = GREATEST(0, cantidad_disponible - $1),
                     cantidad_vendida = cantidad_vendida + $1
                 WHERE id_ptc = $2 AND id_sucursal = $3`,
                [l.cantidad, l.id_ptc, idSucursal],
              );
            }
          }
        });

        resultados.push({
          id_offline_temporal: v.id_offline_temporal,
          id_venta: idVenta,
          numero_factura: numFactura,
          estado: 'Sincronizada',
          total,
        });
      } catch (err: any) {
        resultados.push({
          id_offline_temporal: v.id_offline_temporal,
          id_venta: null,
          estado: 'Error',
          mensaje: err?.message || 'Error al procesar venta offline.',
        });
      }
    }

    return {
      sincronizadas: resultados.filter((r) => r.estado === 'Sincronizada').length,
      fallidas: resultados.filter((r) => r.estado === 'Error').length,
      detalles: resultados,
    };
  }
}