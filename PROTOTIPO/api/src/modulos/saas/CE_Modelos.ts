import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity('tiendas')
export class Tienda {
  @PrimaryGeneratedColumn({ name: 'id_tienda' })
  id_tienda: number;

  @Column({ name: 'nombre', type: 'varchar', length: 120 })
  nombre: string;

  @Column({ name: 'slug', type: 'varchar', length: 60, unique: true })
  slug: string;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logo_url: string | null;

  @Column({ name: 'telefono', type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @Column({ name: 'nit', type: 'varchar', length: 30, nullable: true })
  nit: string | null;

  @Column({ name: 'estado', type: 'varchar', length: 20, default: 'Activa' })
  estado: string; // 'Activa' | 'Suspendida' | 'Vencida'

  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_creacion: Date;

  @OneToMany(() => SuscripcionTienda, (suscripcion) => suscripcion.tienda)
  suscripciones: SuscripcionTienda[];
}

@Entity('planes_suscripcion')
export class PlanSuscripcion {
  @PrimaryGeneratedColumn({ name: 'id_plan' })
  id_plan: number;

  @Column({ name: 'nombre', type: 'varchar', length: 60, unique: true })
  nombre: string;

  @Column({ name: 'descripcion', type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ name: 'precio_mensual', type: 'numeric', precision: 10, scale: 2, default: 0 })
  precio_mensual: number;

  @Column({ name: 'max_sucursales', type: 'int', default: 1 })
  max_sucursales: number;

  @Column({ name: 'max_productos', type: 'int', default: 100 })
  max_productos: number;

  @Column({ name: 'max_usuarios', type: 'int', default: 5 })
  max_usuarios: number;

  @Column({ name: 'vestidor_ra_habilitado', type: 'boolean', default: true })
  vestidor_ra_habilitado: boolean;

  @Column({ name: 'reportes_ia_habilitado', type: 'boolean', default: true })
  reportes_ia_habilitado: boolean;

  @Column({ name: 'estado', type: 'varchar', length: 20, default: 'Activo' })
  estado: string;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_creacion: Date;
}

@Entity('suscripciones_tienda')
export class SuscripcionTienda {
  @PrimaryGeneratedColumn({ name: 'id_suscripcion' })
  id_suscripcion: number;

  @Column({ name: 'id_tienda', type: 'int' })
  id_tienda: number;

  @Column({ name: 'id_plan', type: 'int' })
  id_plan: number;

  @Column({ name: 'fecha_inicio', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_inicio: Date;

  @Column({ name: 'fecha_fin', type: 'timestamp' })
  fecha_fin: Date;

  @Column({ name: 'dias_gracia', type: 'int', default: 3 })
  dias_gracia: number;

  @Column({ name: 'estado', type: 'varchar', length: 20, default: 'Activa' })
  estado: string; // 'Activa' | 'En_Gracia' | 'Vencida' | 'Cancelada'

  @Column({ name: 'monto_pagado', type: 'numeric', precision: 10, scale: 2, default: 0 })
  monto_pagado: number;

  @Column({ name: 'metodo_pago', type: 'varchar', length: 50, default: 'QR' })
  metodo_pago: string;

  @Column({ name: 'codigo_comprobante', type: 'varchar', length: 100, nullable: true })
  codigo_comprobante: string | null;

  @ManyToOne(() => Tienda, (tienda) => tienda.suscripciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_tienda' })
  tienda: Tienda;

  @ManyToOne(() => PlanSuscripcion)
  @JoinColumn({ name: 'id_plan' })
  plan: PlanSuscripcion;
}
