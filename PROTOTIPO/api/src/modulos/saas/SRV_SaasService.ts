import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tienda, PlanSuscripcion, SuscripcionTienda } from './CE_Modelos.js';
import * as bcrypt from 'bcrypt';

export interface CrearTiendaDto {
  nombre: string;
  slug?: string;
  logo_url?: string;
  telefono?: string;
  nit?: string;
  id_plan?: number;
  dias_iniciales?: number;
  admin_email: string;
  admin_password?: string;
  admin_nombre?: string;
}

export interface ExtenderSuscripcionDto {
  dias?: number;
  nueva_fecha_fin?: string;
  id_plan?: number;
  monto_pagado?: number;
  metodo_pago?: string;
  codigo_comprobante?: string;
}

@Injectable()
export class SaasService {
  constructor(
    @InjectRepository(Tienda)
    private readonly tiendaRepo: Repository<Tienda>,
    @InjectRepository(PlanSuscripcion)
    private readonly planRepo: Repository<PlanSuscripcion>,
    @InjectRepository(SuscripcionTienda)
    private readonly suscripcionRepo: Repository<SuscripcionTienda>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async listarTiendas() {
    const tiendas = await this.tiendaRepo.find({
      order: { id_tienda: 'ASC' },
    });

    const resultados = [];
    const ahora = new Date();

    for (const t of tiendas) {
      // Obtener suscripción más reciente o activa
      const suscripcion = await this.suscripcionRepo.findOne({
        where: { id_tienda: t.id_tienda },
        order: { fecha_fin: 'DESC' },
        relations: { plan: true },
      });

      let diasRestantes = 0;
      let estadoSuscripcion = 'Sin_Suscripcion';
      let fechaFin: Date | null = null;
      let planNombre = 'Ninguno';

      if (suscripcion) {
        fechaFin = new Date(suscripcion.fecha_fin);
        const diffMs = fechaFin.getTime() - ahora.getTime();
        diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        planNombre = suscripcion.plan?.nombre ?? 'Estándar';

        if (diasRestantes > 0) {
          estadoSuscripcion = 'Activa';
        } else if (diasRestantes >= -suscripcion.dias_gracia) {
          estadoSuscripcion = 'En_Gracia';
        } else {
          estadoSuscripcion = 'Vencida';
        }
      }

      // Conteo de sucursales asociadas a esta tienda
      const [resSucursales] = (await this.dataSource.query(
        `SELECT COUNT(*)::int AS total FROM sucursales WHERE id_tienda = $1`,
        [t.id_tienda],
      ).catch(() => [{ total: 0 }])) as Array<{ total: number }>;

      // Conteo de productos asociados a esta tienda
      const [resProductos] = (await this.dataSource.query(
        `SELECT COUNT(*)::int AS total FROM productos WHERE id_tienda = $1`,
        [t.id_tienda],
      ).catch(() => [{ total: 0 }])) as Array<{ total: number }>;

      resultados.push({
        id_tienda: t.id_tienda,
        nombre: t.nombre,
        slug: t.slug,
        logo_url: t.logo_url,
        telefono: t.telefono,
        nit: t.nit,
        estado: t.estado,
        fecha_creacion: t.fecha_creacion,
        plan_actual: planNombre,
        suscripcion_estado: estadoSuscripcion,
        dias_restantes: diasRestantes,
        fecha_fin_suscripcion: fechaFin,
        total_sucursales: resSucursales?.total ?? 0,
        total_productos: resProductos?.total ?? 0,
      });
    }

    return resultados;
  }

  async obtenerTienda(id_tienda: number) {
    const tienda = await this.tiendaRepo.findOne({
      where: { id_tienda },
      relations: { suscripciones: { plan: true } },
    });

    if (!tienda) {
      throw new NotFoundException(`La tienda #${id_tienda} no existe.`);
    }

    const suscripcionActiva = tienda.suscripciones?.length
      ? tienda.suscripciones.sort((a, b) => new Date(b.fecha_fin).getTime() - new Date(a.fecha_fin).getTime())[0]
      : null;

    const ahora = new Date();
    let diasRestantes = 0;
    if (suscripcionActiva) {
      const diffMs = new Date(suscripcionActiva.fecha_fin).getTime() - ahora.getTime();
      diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    return {
      tienda,
      suscripcion_actual: suscripcionActiva,
      dias_restantes: diasRestantes,
      esta_vigente: diasRestantes > 0,
    };
  }

  async crearTienda(dto: CrearTiendaDto) {
    const slug = (dto.slug || dto.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).trim();

    const existeSlug = await this.tiendaRepo.findOne({ where: { slug } });
    if (existeSlug) {
      throw new ConflictException(`El identificador (slug) "${slug}" ya está en uso.`);
    }

    const nuevaTienda = this.tiendaRepo.create({
      nombre: dto.nombre,
      slug,
      logo_url: dto.logo_url || null,
      telefono: dto.telefono || null,
      nit: dto.nit || null,
      estado: 'Activa',
    });

    const tiendaGuardada = await this.tiendaRepo.save(nuevaTienda);

    // Asignar plan inicial (por defecto el primero o el seleccionado)
    let plan = null;
    if (dto.id_plan) {
      plan = await this.planRepo.findOne({ where: { id_plan: dto.id_plan } });
    }
    if (!plan) {
      plan = await this.planRepo.findOne({ order: { id_plan: 'ASC' } });
    }

    const dias = dto.dias_iniciales || 30; // 30 días de prueba / periodo inicial
    const fechaInicio = new Date();
    const fechaFin = new Date();
    fechaFin.setDate(fechaFin.getDate() + dias);

    if (plan) {
      const suscripcion = this.suscripcionRepo.create({
        id_tienda: tiendaGuardada.id_tienda,
        id_plan: plan.id_plan,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        dias_gracia: 5,
        estado: 'Activa',
        monto_pagado: plan.precio_mensual,
        metodo_pago: 'Prueba_Inicial',
      });
      await this.suscripcionRepo.save(suscripcion);
    }

    // Crear sucursal principal por defecto para la tienda
    await this.dataSource.query(
      `INSERT INTO sucursales (id_tienda, nombre, direccion, telefono, estado)
       VALUES ($1, $2, $3, $4, 'Activa')
       ON CONFLICT DO NOTHING`,
      [tiendaGuardada.id_tienda, `Sucursal Central - ${dto.nombre}`, 'Oficina Principal', dto.telefono || '70000000'],
    ).catch(() => {});

    // Crear o vincular usuario administrador para la tienda si se suministró email
    if (dto.admin_email) {
      const passwordHash = await bcrypt.hash(dto.admin_password || 'Admin123!', 10);
      const resUser = await this.dataSource.query(
        `INSERT INTO usuarios (email, password_hash, estado, id_tienda)
         VALUES ($1, $2, 'Activo', $3)
         ON CONFLICT (email) DO UPDATE SET id_tienda = $3
         RETURNING id_usuario`,
        [dto.admin_email.toLowerCase(), passwordHash, tiendaGuardada.id_tienda],
      );

      const idUsuario = resUser[0]?.id_usuario;
      if (idUsuario) {
        // Asignar rol de Administrador
        await this.dataSource.query(
          `INSERT INTO usuarios_roles (id_usuario, id_rol)
           SELECT $1, id_rol FROM roles WHERE nombre_rol = 'Administrador'
           ON CONFLICT DO NOTHING`,
          [idUsuario],
        ).catch(() => {});

        // Crear registro en usuarios_empleados
        await this.dataSource.query(
          `INSERT INTO usuarios_empleados (usuario_id, nombre, rol, telefono)
           VALUES ($1, $2, 'Administrador', $3)
           ON CONFLICT (usuario_id) DO NOTHING`,
          [idUsuario, dto.admin_nombre || `Admin ${dto.nombre}`, dto.telefono || ''],
        ).catch(() => {});
      }
    }

    return this.obtenerTienda(tiendaGuardada.id_tienda);
  }

  async actualizarTienda(id_tienda: number, dto: Partial<Tienda>) {
    const tienda = await this.tiendaRepo.findOne({ where: { id_tienda } });
    if (!tienda) {
      throw new NotFoundException(`La tienda #${id_tienda} no existe.`);
    }

    if (dto.nombre) tienda.nombre = dto.nombre;
    if (dto.telefono !== undefined) tienda.telefono = dto.telefono;
    if (dto.nit !== undefined) tienda.nit = dto.nit;
    if (dto.logo_url !== undefined) tienda.logo_url = dto.logo_url;
    if (dto.estado) tienda.estado = dto.estado;

    return this.tiendaRepo.save(tienda);
  }

  async extenderSuscripcion(id_tienda: number, dto: ExtenderSuscripcionDto) {
    const tienda = await this.tiendaRepo.findOne({ where: { id_tienda } });
    if (!tienda) {
      throw new NotFoundException(`La tienda #${id_tienda} no existe.`);
    }

    let plan = null;
    if (dto.id_plan) {
      plan = await this.planRepo.findOne({ where: { id_plan: dto.id_plan } });
    }
    if (!plan) {
      plan = await this.planRepo.findOne({ order: { id_plan: 'ASC' } });
    }

    // Buscar suscripción activa previa o crear nueva fecha base
    const suscripcionPrevia = await this.suscripcionRepo.findOne({
      where: { id_tienda },
      order: { fecha_fin: 'DESC' },
    });

    const ahora = new Date();
    let fechaBase = ahora;

    if (suscripcionPrevia && new Date(suscripcionPrevia.fecha_fin) > ahora) {
      // Si la suscripción aún está vigente, se añade tiempo a partir de la fecha fin existente
      fechaBase = new Date(suscripcionPrevia.fecha_fin);
    }

    let fechaFin = new Date(fechaBase);
    if (dto.nueva_fecha_fin) {
      fechaFin = new Date(dto.nueva_fecha_fin);
    } else {
      const diasAAgregar = dto.dias || 30;
      fechaFin.setDate(fechaFin.getDate() + diasAAgregar);
    }

    const nuevaSuscripcion = this.suscripcionRepo.create({
      id_tienda,
      id_plan: plan?.id_plan || 1,
      fecha_inicio: ahora,
      fecha_fin: fechaFin,
      dias_gracia: 5,
      estado: 'Activa',
      monto_pagado: dto.monto_pagado || plan?.precio_mensual || 0,
      metodo_pago: dto.metodo_pago || 'Renovacion_Admin',
      codigo_comprobante: dto.codigo_comprobante || `EXT-${Date.now()}`,
    });

    await this.suscripcionRepo.save(nuevaSuscripcion);

    // Reactivar tienda si estaba vencida o suspendida
    tienda.estado = 'Activa';
    await this.tiendaRepo.save(tienda);

    return this.obtenerTienda(id_tienda);
  }

  async listarPlanes() {
    return this.planRepo.find({ order: { precio_mensual: 'ASC' } });
  }

  async crearPlan(dto: Partial<PlanSuscripcion>) {
    const plan = this.planRepo.create(dto);
    return this.planRepo.save(plan);
  }

  async obtenerEstadoMiTienda(id_tienda: number) {
    const tienda = await this.tiendaRepo.findOne({ where: { id_tienda } });
    if (!tienda) {
      return {
        id_tienda,
        nombre: 'Tienda Predeterminada',
        estado: 'Activa',
        dias_restantes: 365,
        plan_actual: 'Ilimitado',
        vigente: true,
      };
    }

    const suscripcion = await this.suscripcionRepo.findOne({
      where: { id_tienda },
      order: { fecha_fin: 'DESC' },
      relations: { plan: true },
    });

    const ahora = new Date();
    let diasRestantes = 365;
    let vigente = true;
    let fechaFin = null;

    if (suscripcion) {
      fechaFin = suscripcion.fecha_fin;
      const diffMs = new Date(suscripcion.fecha_fin).getTime() - ahora.getTime();
      diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      vigente = diasRestantes > 0;
    }

    return {
      id_tienda: tienda.id_tienda,
      nombre: tienda.nombre,
      slug: tienda.slug,
      logo_url: tienda.logo_url,
      estado: tienda.estado,
      dias_restantes: diasRestantes,
      fecha_fin: fechaFin,
      plan_actual: suscripcion?.plan?.nombre || 'Plan Estándar',
      vigente,
      caracteristicas: {
        max_sucursales: suscripcion?.plan?.max_sucursales ?? 5,
        max_productos: suscripcion?.plan?.max_productos ?? 500,
        vestidor_ra: suscripcion?.plan?.vestidor_ra_habilitado ?? true,
        reportes_ia: suscripcion?.plan?.reportes_ia_habilitado ?? true,
      },
    };
  }
}
