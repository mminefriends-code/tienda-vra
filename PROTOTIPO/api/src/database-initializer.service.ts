import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class DatabaseInitializerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseInitializerService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    try {
      this.logger.log('Iniciando verificación y creación completa de tablas PostgreSQL...');
      await this.createAllTables();
      await this.runMigrations();
      await this.seedAllData();
      this.logger.log('🎉 Base de datos 100% sincronizada, poblada y operativa.');
    } catch (error) {
      this.logger.error('Error al inicializar la base de datos:', error);
    }
  }

  private async createAllTables() {
    const queries = [
      `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,

      // 1. Roles y Seguridad
      `CREATE TABLE IF NOT EXISTS roles (
        id_rol SERIAL PRIMARY KEY,
        nombre_rol VARCHAR(60) UNIQUE NOT NULL,
        descripcion TEXT,
        permisos_json JSONB NOT NULL DEFAULT '[]',
        estado VARCHAR(20) DEFAULT 'Activo',
        fecha_creacion TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS usuarios (
        id_usuario SERIAL PRIMARY KEY,
        email VARCHAR(120) UNIQUE NOT NULL,
        ci VARCHAR(30) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        estado VARCHAR(20) DEFAULT 'Pendiente',
        intentos_fallidos INTEGER DEFAULT 0,
        bloqueado_hasta TIMESTAMP,
        fecha_creacion TIMESTAMP DEFAULT NOW(),
        fecha_ultimo_acceso TIMESTAMP,
        ultimo_login TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS usuarios_roles (
        id_usuario INTEGER REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        id_rol INTEGER REFERENCES roles(id_rol) ON DELETE CASCADE,
        PRIMARY KEY (id_usuario, id_rol)
      )`,

      `CREATE TABLE IF NOT EXISTS ciudades (
        id_ciudad SERIAL PRIMARY KEY,
        nombre VARCHAR(80) UNIQUE NOT NULL,
        pais VARCHAR(60) DEFAULT 'Bolivia',
        estado VARCHAR(20) DEFAULT 'Activa'
      )`,

      `CREATE TABLE IF NOT EXISTS sucursales (
        id_sucursal SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        direccion TEXT NOT NULL,
        id_ciudad INTEGER REFERENCES ciudades(id_ciudad),
        telefono VARCHAR(30),
        estado VARCHAR(20) DEFAULT 'Activa',
        fecha_registro TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS sucursal_horarios (
        id_horario SERIAL PRIMARY KEY,
        id_sucursal INTEGER REFERENCES sucursales(id_sucursal) ON DELETE CASCADE,
        dia_semana VARCHAR(20),
        horario_apertura TIME,
        horario_cierre TIME
      )`,

      `CREATE TABLE IF NOT EXISTS usuarios_empleados (
        id_empleado SERIAL PRIMARY KEY,
        usuario_id INTEGER UNIQUE REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        sucursal_id INTEGER REFERENCES sucursales(id_sucursal),
        nombre VARCHAR(120) NOT NULL,
        telefono VARCHAR(30),
        rol VARCHAR(60) NOT NULL,
        fecha_baja TIMESTAMP,
        motivo_baja VARCHAR(255)
      )`,

      `CREATE TABLE IF NOT EXISTS clientes (
        id_cliente SERIAL PRIMARY KEY,
        usuario_id INTEGER UNIQUE REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        nombre VARCHAR(150) NOT NULL,
        telefono VARCHAR(30),
        direccion TEXT,
        fecha_registro TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS first_password_tokens (
        id_token SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        token UUID UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS email_confirmations (
        id_confirmacion SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        token UUID UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT false,
        confirmado_en TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS password_resets (
        id_reset SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        email VARCHAR(120) NOT NULL,
        token UUID UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT false,
        ip_origen VARCHAR(45),
        created_at TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS token_blacklist (
        id_token SERIAL PRIMARY KEY,
        jti VARCHAR(128) UNIQUE NOT NULL,
        usuario_id INTEGER REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        expira_en TIMESTAMP NOT NULL,
        revocado_en TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS sesiones (
        id_sesion SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        refresh_token VARCHAR(500),
        ip_address VARCHAR(45),
        user_agent VARCHAR(255),
        fecha_inicio TIMESTAMP DEFAULT NOW(),
        fecha_fin TIMESTAMP,
        activa BOOLEAN DEFAULT true
      )`,

      `CREATE TABLE IF NOT EXISTS bitacora_auditoria (
        id_bitacora SERIAL PRIMARY KEY,
        id_usuario INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
        accion_sql VARCHAR(40),
        tabla_afectada VARCHAR(80),
        id_registro INTEGER,
        detalle TEXT,
        old_data JSONB,
        new_data JSONB,
        ip_address INET,
        user_agent VARCHAR(255),
        fecha_hora TIMESTAMP DEFAULT NOW()
      )`,

      // 2. Maestros y Catálogo
      `CREATE TABLE IF NOT EXISTS tallas (
        id_talla SERIAL PRIMARY KEY,
        nombre VARCHAR(10) UNIQUE NOT NULL,
        estado VARCHAR(20) DEFAULT 'Activo',
        orden INTEGER
      )`,

      `CREATE TABLE IF NOT EXISTS colores (
        id_color SERIAL PRIMARY KEY,
        nombre VARCHAR(50) UNIQUE NOT NULL,
        codigo_hex VARCHAR(7) UNIQUE,
        estado VARCHAR(20) DEFAULT 'Activo'
      )`,

      `CREATE TABLE IF NOT EXISTS categorias (
        id_categoria SERIAL PRIMARY KEY,
        nombre VARCHAR(80) UNIQUE NOT NULL,
        descripcion TEXT,
        estado VARCHAR(20) DEFAULT 'Activa'
      )`,

      `CREATE TABLE IF NOT EXISTS temporadas (
        id_temporada SERIAL PRIMARY KEY,
        nombre VARCHAR(80) UNIQUE NOT NULL,
        fecha_inicio DATE,
        fecha_fin DATE,
        estado VARCHAR(20) DEFAULT 'Activa'
      )`,

      `CREATE TABLE IF NOT EXISTS colecciones (
        id_coleccion SERIAL PRIMARY KEY,
        nombre VARCHAR(100) UNIQUE NOT NULL,
        descripcion TEXT,
        id_temporada INTEGER REFERENCES temporadas(id_temporada),
        estado VARCHAR(20) DEFAULT 'Activa',
        fecha_creacion TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS proveedores (
        id_proveedor SERIAL PRIMARY KEY,
        nombre_empresa VARCHAR(150) UNIQUE NOT NULL,
        contacto_principal VARCHAR(120),
        telefono VARCHAR(30),
        email VARCHAR(120) UNIQUE,
        direccion TEXT,
        pais VARCHAR(60) DEFAULT 'Bolivia',
        calidad_score INTEGER DEFAULT 80,
        estado_riesgo VARCHAR(20) DEFAULT 'Bajo',
        estado VARCHAR(20) DEFAULT 'Activo',
        fecha_registro TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS productos (
        id_producto SERIAL PRIMARY KEY,
        codigo VARCHAR(40) UNIQUE NOT NULL,
        nombre VARCHAR(150) NOT NULL,
        descripcion TEXT,
        id_categoria INTEGER REFERENCES categorias(id_categoria),
        id_temporada INTEGER REFERENCES temporadas(id_temporada),
        id_proveedor INTEGER REFERENCES proveedores(id_proveedor),
        precio_base DECIMAL(10,2) NOT NULL,
        porcentaje_iva DECIMAL(5,2) DEFAULT 0,
        destacado BOOLEAN DEFAULT true,
        descuento DECIMAL(5,2) DEFAULT 0,
        modelo_3d_url TEXT,
        estado VARCHAR(20) DEFAULT 'Disponible',
        fecha_registro TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS producto_talla_color (
        id_ptc SERIAL PRIMARY KEY,
        id_producto INTEGER REFERENCES productos(id_producto) ON DELETE CASCADE,
        id_talla INTEGER REFERENCES tallas(id_talla),
        id_color INTEGER REFERENCES colores(id_color),
        estado_stock VARCHAR(20) DEFAULT 'Disponible',
        UNIQUE (id_producto, id_talla, id_color)
      )`,

      `CREATE TABLE IF NOT EXISTS producto_imagenes (
        id_imagen SERIAL PRIMARY KEY,
        id_producto INTEGER REFERENCES productos(id_producto) ON DELETE CASCADE,
        id_color INTEGER REFERENCES colores(id_color) ON DELETE SET NULL,
        url TEXT NOT NULL,
        orden INTEGER DEFAULT 1,
        es_principal BOOLEAN DEFAULT false
      )`,

      `CREATE TABLE IF NOT EXISTS producto_coleccion (
        id_coleccion INTEGER REFERENCES colecciones(id_coleccion) ON DELETE CASCADE,
        id_producto INTEGER REFERENCES productos(id_producto) ON DELETE CASCADE,
        PRIMARY KEY (id_coleccion, id_producto)
      )`,

      // 3. Inventario, Compras y Stock
      `CREATE TABLE IF NOT EXISTS inventario_stock (
        id_stock SERIAL PRIMARY KEY,
        id_ptc INTEGER REFERENCES producto_talla_color(id_ptc),
        id_sucursal INTEGER REFERENCES sucursales(id_sucursal),
        cantidad_disponible INTEGER DEFAULT 0,
        cantidad_reservada INTEGER DEFAULT 0,
        cantidad_vendida INTEGER DEFAULT 0,
        stock_minimo_alert INTEGER DEFAULT 0,
        UNIQUE (id_ptc, id_sucursal)
      )`,

      `CREATE TABLE IF NOT EXISTS ordenes_compra (
        id_orden_compra SERIAL PRIMARY KEY,
        id_proveedor INTEGER REFERENCES proveedores(id_proveedor),
        id_sucursal INTEGER REFERENCES sucursales(id_sucursal),
        numero VARCHAR(20),
        fecha_orden TIMESTAMP DEFAULT NOW(),
        fecha_estimada_entrega DATE,
        fecha_recepcion TIMESTAMP,
        estado VARCHAR(20) DEFAULT 'Pendiente',
        total DECIMAL(12,2),
        observaciones TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS orden_compra_items (
        id_orden_item SERIAL PRIMARY KEY,
        id_orden_compra INTEGER REFERENCES ordenes_compra(id_orden_compra) ON DELETE CASCADE,
        id_ptc INTEGER REFERENCES producto_talla_color(id_ptc),
        cantidad INTEGER NOT NULL DEFAULT 1,
        precio_unitario DECIMAL(10,2),
        subtotal DECIMAL(12,2)
      )`,

      `CREATE TABLE IF NOT EXISTS alertas_stock_config (
        id_alerta_config SERIAL PRIMARY KEY,
        id_ptc INTEGER REFERENCES producto_talla_color(id_ptc),
        id_sucursal INTEGER REFERENCES sucursales(id_sucursal),
        stock_minimo INTEGER NOT NULL DEFAULT 5,
        notificar_email BOOLEAN DEFAULT true,
        email_notificacion VARCHAR(120)
      )`,

      `CREATE TABLE IF NOT EXISTS movimientos_inventario (
        id_movimiento SERIAL PRIMARY KEY,
        id_ptc INTEGER REFERENCES producto_talla_color(id_ptc),
        id_sucursal INTEGER REFERENCES sucursales(id_sucursal),
        tipo_movimiento VARCHAR(30) NOT NULL,
        cantidad INTEGER NOT NULL,
        motivo TEXT,
        referencia_tipo VARCHAR(40),
        referencia_id INTEGER,
        id_usuario INTEGER REFERENCES usuarios(id_usuario),
        fecha_movimiento TIMESTAMP DEFAULT NOW()
      )`,

      // 4. Reservas, Carrito y Ventas
      `CREATE TABLE IF NOT EXISTS reservas (
        id_reserva SERIAL PRIMARY KEY,
        id_cliente INTEGER REFERENCES clientes(id_cliente),
        id_usuario INTEGER REFERENCES usuarios(id_usuario),
        id_sucursal INTEGER REFERENCES sucursales(id_sucursal),
        fecha_reserva DATE,
        hora_reserva TIME,
        estado VARCHAR(20) DEFAULT 'Solicitada',
        id_encargado INTEGER REFERENCES usuarios(id_usuario),
        fecha_creacion TIMESTAMP DEFAULT NOW(),
        fecha_preparada TIMESTAMP,
        fecha_atendida TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS reserva_items (
        id_reserva_item SERIAL PRIMARY KEY,
        id_reserva INTEGER REFERENCES reservas(id_reserva) ON DELETE CASCADE,
        id_ptc INTEGER REFERENCES producto_talla_color(id_ptc),
        cantidad INTEGER DEFAULT 1
      )`,

      `CREATE TABLE IF NOT EXISTS carritos (
        id_carrito SERIAL PRIMARY KEY,
        id_usuario INTEGER REFERENCES usuarios(id_usuario),
        token_invitado VARCHAR(100),
        fecha_creacion TIMESTAMP DEFAULT NOW(),
        fecha_actualizacion TIMESTAMP DEFAULT NOW(),
        estado VARCHAR(20) DEFAULT 'Activo'
      )`,

      `CREATE TABLE IF NOT EXISTS carrito_items (
        id_carrito_item SERIAL PRIMARY KEY,
        id_carrito INTEGER REFERENCES carritos(id_carrito) ON DELETE CASCADE,
        id_ptc INTEGER REFERENCES producto_talla_color(id_ptc),
        cantidad INTEGER NOT NULL DEFAULT 1,
        fecha_agregado TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS ventas (
        id_venta SERIAL PRIMARY KEY,
        numero_factura VARCHAR(40) UNIQUE,
        id_cliente INTEGER REFERENCES clientes(id_cliente),
        id_usuario INTEGER REFERENCES usuarios(id_usuario),
        id_sucursal INTEGER REFERENCES sucursales(id_sucursal),
        tipo_venta VARCHAR(20) DEFAULT 'Presencial',
        subtotal DECIMAL(10,2) NOT NULL,
        descuento DECIMAL(10,2) DEFAULT 0,
        impuesto DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(10,2) NOT NULL,
        metodo_pago VARCHAR(30) DEFAULT 'Efectivo',
        estado VARCHAR(20) DEFAULT 'Completada',
        fecha_venta TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS venta_items (
        id_venta_item SERIAL PRIMARY KEY,
        id_venta INTEGER REFERENCES ventas(id_venta) ON DELETE CASCADE,
        id_ptc INTEGER REFERENCES producto_talla_color(id_ptc),
        cantidad INTEGER NOT NULL,
        precio_unitario DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS comprobantes (
        id_comprobante SERIAL PRIMARY KEY,
        id_venta INTEGER REFERENCES ventas(id_venta) ON DELETE CASCADE,
        numero_autorizacion VARCHAR(100),
        codigo_control VARCHAR(50),
        fecha_emision TIMESTAMP DEFAULT NOW(),
        pdf_path TEXT,
        qr_data TEXT
      )`,

      // 5. Vestidor Virtual RA, Recomendaciones y Respaldos
      `CREATE TABLE IF NOT EXISTS sesiones_ra (
        id_sesion_ra SERIAL PRIMARY KEY,
        id_usuario INTEGER REFERENCES usuarios(id_usuario),
        id_producto INTEGER REFERENCES productos(id_producto),
        id_ptc INTEGER REFERENCES producto_talla_color(id_ptc),
        dispositivo_info VARCHAR(100),
        duracion_segundos INTEGER,
        captura_guardada BOOLEAN DEFAULT false,
        resultado_ajuste VARCHAR(30),
        foto_resultado TEXT,
        fecha_sesion TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS recomendaciones_ia (
        id_recomendacion SERIAL PRIMARY KEY,
        id_usuario INTEGER REFERENCES usuarios(id_usuario),
        id_producto INTEGER REFERENCES productos(id_producto),
        score DECIMAL(5,4),
        motivo VARCHAR(100),
        fecha_generacion TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS respaldo_programacion (
        id_programacion SERIAL PRIMARY KEY,
        tipo_frecuencia VARCHAR(20) DEFAULT 'Diario',
        hora_ejecucion TIME DEFAULT '02:00:00',
        activo BOOLEAN DEFAULT true,
        retencion_dias INTEGER DEFAULT 30,
        ultimo_respaldo TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS respaldos (
        id_respaldo SERIAL PRIMARY KEY,
        nombre_archivo VARCHAR(200) NOT NULL,
        tamanio_bytes BIGINT,
        ruta_archivo TEXT,
        tipo VARCHAR(20) DEFAULT 'Manual',
        estado VARCHAR(20) DEFAULT 'Completado',
        id_usuario INTEGER REFERENCES usuarios(id_usuario),
        fecha_creacion TIMESTAMP DEFAULT NOW()
      )`,

      // Tablas SaaS Multi-Tienda y Suscripciones
      `CREATE TABLE IF NOT EXISTS tiendas (
        id_tienda SERIAL PRIMARY KEY,
        nombre VARCHAR(120) NOT NULL,
        slug VARCHAR(60) UNIQUE NOT NULL,
        logo_url TEXT,
        telefono VARCHAR(30),
        nit VARCHAR(30),
        estado VARCHAR(20) DEFAULT 'Activa',
        fecha_creacion TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS planes_suscripcion (
        id_plan SERIAL PRIMARY KEY,
        nombre VARCHAR(60) UNIQUE NOT NULL,
        descripcion TEXT,
        precio_mensual NUMERIC(10,2) NOT NULL DEFAULT 0,
        max_sucursales INT DEFAULT 1,
        max_productos INT DEFAULT 100,
        max_usuarios INT DEFAULT 5,
        vestidor_ra_habilitado BOOLEAN DEFAULT TRUE,
        reportes_ia_habilitado BOOLEAN DEFAULT TRUE,
        estado VARCHAR(20) DEFAULT 'Activo',
        fecha_creacion TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS suscripciones_tienda (
        id_suscripcion SERIAL PRIMARY KEY,
        id_tienda INTEGER REFERENCES tiendas(id_tienda) ON DELETE CASCADE,
        id_plan INTEGER REFERENCES planes_suscripcion(id_plan),
        fecha_inicio TIMESTAMP DEFAULT NOW(),
        fecha_fin TIMESTAMP NOT NULL,
        dias_gracia INTEGER DEFAULT 5,
        estado VARCHAR(20) DEFAULT 'Activa',
        monto_pagado NUMERIC(10,2) DEFAULT 0,
        metodo_pago VARCHAR(50) DEFAULT 'QR',
        codigo_comprobante VARCHAR(100)
      )`,
    ];

    for (const q of queries) {
      try {
        await this.dataSource.query(q);
      } catch (err) {
        this.logger.warn(`Aviso al ejecutar tabla: ${(err as Error)?.message}`);
      }
    }
  }

  private async runMigrations() {
    const migrationQueries = [
      `ALTER TABLE colecciones ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMP DEFAULT NOW()`,
      `ALTER TABLE colecciones ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'Activa'`,
      `ALTER TABLE temporadas ADD COLUMN IF NOT EXISTS fecha_inicio DATE`,
      `ALTER TABLE temporadas ADD COLUMN IF NOT EXISTS fecha_fin DATE`,
      `ALTER TABLE temporadas ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'Activa'`,
      `ALTER TABLE productos ADD COLUMN IF NOT EXISTS descuento DECIMAL(5,2) DEFAULT 0`,
      `ALTER TABLE productos ADD COLUMN IF NOT EXISTS porcentaje_iva DECIMAL(5,2) DEFAULT 0`,
      `ALTER TABLE productos ADD COLUMN IF NOT EXISTS destacado BOOLEAN DEFAULT true`,
      `ALTER TABLE ventas ADD COLUMN IF NOT EXISTS total DECIMAL(10,2) DEFAULT 0`,
      `ALTER TABLE ventas ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'Completada'`,
      `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS id_tienda INTEGER REFERENCES tiendas(id_tienda) ON DELETE SET NULL`,
      `ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS id_tienda INTEGER REFERENCES tiendas(id_tienda) ON DELETE CASCADE`,
      `ALTER TABLE productos ADD COLUMN IF NOT EXISTS id_tienda INTEGER REFERENCES tiendas(id_tienda) ON DELETE CASCADE`,
      `ALTER TABLE ventas ADD COLUMN IF NOT EXISTS id_tienda INTEGER REFERENCES tiendas(id_tienda) ON DELETE CASCADE`,
      `ALTER TABLE reservas ADD COLUMN IF NOT EXISTS id_tienda INTEGER REFERENCES tiendas(id_tienda) ON DELETE CASCADE`,
    ];

    for (const mq of migrationQueries) {
      try {
        await this.dataSource.query(mq);
      } catch (err) {
        this.logger.warn(`Aviso migración: ${(err as Error)?.message}`);
      }
    }
  }

  private async seedAllData() {
    const hash = await bcrypt.hash('admin123', 10);

    // 1. Roles
    await this.dataSource.query(`
      INSERT INTO roles (id_rol, nombre_rol, descripcion, permisos_json, estado) VALUES
        (1, 'Administrador', 'Acceso total del sistema', '["*"]'::jsonb, 'Activo'),
        (2, 'Gerente', 'Administra ciudades, sucursales y catalogo', '["gestionar_usuarios","gestionar_reservas","gestionar_ciudades","gestionar_catalogo","gestionar_compras","ver_reportes","gestionar_temporadas"]'::jsonb, 'Activo'),
        (3, 'Vendedor', 'Atiende en mostrador y procesa ventas', '["ver_catalogo","registrar_venta","procesar_pago","gestionar_reservas","gestionar_devoluciones"]'::jsonb, 'Activo'),
        (4, 'Cliente', 'Compra por la web y app movil', '["ver_catalogo","gestionar_carrito","realizar_compra","gestionar_reservas","usar_vestidor_ra"]'::jsonb, 'Activo')
      ON CONFLICT (id_rol) DO UPDATE SET permisos_json = EXCLUDED.permisos_json;
    `);

    // 2. Usuarios
    await this.dataSource.query(`
      INSERT INTO usuarios (id_usuario, email, ci, password_hash, estado, intentos_fallidos) VALUES
        (1, 'admin@tiendasmontano.bo', '1000001-1A', '${hash}', 'Activo', 0),
        (2, 'gerencia@tiendasmontano.bo', '1000002-2B', '${hash}', 'Activo', 0),
        (3, 'vendedor.lapaz@tiendasmontano.bo', '1000005-5E', '${hash}', 'Activo', 0),
        (4, 'caja.lapaz@tiendasmontano.bo', '1000009-9J', '${hash}', 'Activo', 0),
        (5, 'maria.gonzales@correo.com', '4567890-1K', '${hash}', 'Activo', 0)
      ON CONFLICT (id_usuario) DO UPDATE SET password_hash = EXCLUDED.password_hash, estado = 'Activo';
    `);

    // 3. Asignar Roles
    await this.dataSource.query(`
      INSERT INTO usuarios_roles (id_usuario, id_rol) VALUES
        (1, 1),
        (2, 2),
        (3, 3),
        (4, 3),
        (5, 4)
      ON CONFLICT DO NOTHING;
    `);

    // 4. Ciudades y Sucursales
    await this.dataSource.query(`
      INSERT INTO ciudades (id_ciudad, nombre, pais, estado) VALUES
        (1, 'La Paz', 'Bolivia', 'Activa'),
        (2, 'Santa Cruz', 'Bolivia', 'Activa'),
        (3, 'Cochabamba', 'Bolivia', 'Activa')
      ON CONFLICT (id_ciudad) DO NOTHING;

      INSERT INTO sucursales (id_sucursal, nombre, direccion, id_ciudad, telefono, estado) VALUES
        (1, 'Sucursal Central La Paz', 'Av. 16 de Julio #1490 (El Prado)', 1, '2-2441122', 'Activa'),
        (2, 'Sucursal Santa Cruz Norte', 'Av. Cristo Redentor 4to Anillo', 2, '3-3445566', 'Activa'),
        (3, 'Sucursal Cochabamba Heroínas', 'Av. Heroínas #456', 3, '4-4223344', 'Activa')
      ON CONFLICT (id_sucursal) DO NOTHING;

      INSERT INTO usuarios_empleados (id_empleado, usuario_id, sucursal_id, nombre, rol, telefono) VALUES
        (1, 1, 1, 'Administrador Central', 'Administrador', '70011223'),
        (2, 3, 1, 'Carlos Vendedor', 'Vendedor', '70044556'),
        (3, 4, 1, 'Ana Cajera', 'Cajero', '70077889')
      ON CONFLICT (id_empleado) DO NOTHING;

      INSERT INTO clientes (id_cliente, usuario_id, nombre, telefono, direccion) VALUES
        (1, 5, 'María Gonzales', '71234567', 'Av. 6 de Agosto #123')
      ON CONFLICT (id_cliente) DO NOTHING;
    `);

    // 5. Tallas y Colores
    await this.dataSource.query(`
      INSERT INTO tallas (id_talla, nombre, orden) VALUES
        (1, 'XS', 1),
        (2, 'S', 2),
        (3, 'M', 3),
        (4, 'L', 4),
        (5, 'XL', 5),
        (6, 'XXL', 6),
        (7, 'Única', 7)
      ON CONFLICT (id_talla) DO NOTHING;

      INSERT INTO colores (id_color, nombre, codigo_hex) VALUES
        (1, 'Negro', '#000000'),
        (2, 'Blanco', '#FFFFFF'),
        (3, 'Azul Marino', '#1B2A41'),
        (4, 'Rojo Borgoña', '#800020'),
        (5, 'Verde Oliva', '#556B2F'),
        (6, 'Beige Arena', '#E8DCC4'),
        (7, 'Gris Jaspe', '#808080')
      ON CONFLICT (id_color) DO NOTHING;
    `);

    // 6. Categorías, Temporadas y Colecciones
    await this.dataSource.query(`
      INSERT INTO categorias (id_categoria, nombre, descripcion) VALUES
        (1, 'Poleras y Camisetas', 'Poleras de algodón pima, básicas y estampadas'),
        (2, 'Camisas y Blusas', 'Camisas formales y casuales para vestir elegante'),
        (3, 'Pantalones y Jeans', 'Jeans denim stretch y pantalones de vestir'),
        (4, 'Chaquetas y Chamarras', 'Chamarras abrigadas, cuero y bomber'),
        (5, 'Vestidos', 'Vestidos de fiesta y casuales de temporada'),
        (6, 'Ropa Deportiva', 'Conjuntos deportivos, buzos y licras')
      ON CONFLICT (id_categoria) DO NOTHING;

      INSERT INTO temporadas (id_temporada, nombre, fecha_inicio, fecha_fin, estado) VALUES
        (1, 'Colección Primavera - Verano 2026', '2026-09-01', '2027-02-28', 'Activa'),
        (2, 'Colección Permanente', NULL, NULL, 'Activa')
      ON CONFLICT (id_temporada) DO NOTHING;

      INSERT INTO colecciones (id_coleccion, nombre, descripcion, id_temporada, estado, fecha_creacion) VALUES
        (1, 'Esenciales Urbanos', 'Prendas básicas y versátiles para el día a día', 1, 'Activa', NOW()),
        (2, 'Elegancia Contemporánea', 'Moda premium de oficina y ocasiones especiales', 1, 'Activa', NOW())
      ON CONFLICT (id_coleccion) DO NOTHING;
    `);

    // 7. Productos con precios, fotos de prendas aisladas y stock
    await this.dataSource.query(`
      INSERT INTO productos (id_producto, codigo, nombre, descripcion, id_categoria, id_temporada, precio_base, porcentaje_iva, destacado, descuento, estado, fecha_registro) VALUES
        (1, 'POL-001', 'Polera Premium Algodón Pima', 'Polera suave de alta durabilidad, corte regular fit.', 1, 1, 120.00, 0, true, 0, 'Disponible', NOW()),
        (2, 'CAM-002', 'Camisa Oxford Slim Fit Celeste', 'Camisa clásica para oficina o eventos casuales.', 2, 1, 210.00, 0, true, 0, 'Disponible', NOW()),
        (3, 'JEA-003', 'Jeans Denim Clásico Azul', 'Jeans resistente de mezclilla premium con elasticidad.', 3, 2, 280.00, 0, true, 10, 'Disponible', NOW()),
        (4, 'CHA-004', 'Chamarra Bomber Negra', 'Chamarra impermeable con forro térmico y cierres metálicos.', 4, 1, 450.00, 0, true, 0, 'Disponible', NOW()),
        (5, 'VES-005', 'Vestido Floral de Verano', 'Vestido fresco con estampado floral y ajuste a la cintura.', 5, 1, 290.00, 0, true, 15, 'Disponible', NOW()),
        (6, 'DEP-006', 'Conjunto Deportivo Tech Fleece', 'Buzo y polerón térmico transpirable para entrenamiento.', 6, 2, 350.00, 0, true, 0, 'Disponible', NOW()),
        (7, 'TMU-REM-001', 'Remera Básica Algodón Montaño', 'Remera clásica de algodón peinado 100% boliviano.', 1, 1, 95.00, 0, true, 0, 'Disponible', NOW())
      ON CONFLICT (id_producto) DO UPDATE SET 
        nombre = EXCLUDED.nombre,
        precio_base = EXCLUDED.precio_base,
        destacado = EXCLUDED.destacado,
        estado = EXCLUDED.estado;

      INSERT INTO producto_imagenes (id_producto, url, orden, es_principal) VALUES
        (1, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80', 1, true),
        (2, 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80', 1, true),
        (3, 'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80', 1, true),
        (4, 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&auto=format&fit=crop&q=80', 1, true),
        (5, 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80', 1, true),
        (6, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80', 1, true),
        (7, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80', 1, true)
      ON CONFLICT DO NOTHING;

      INSERT INTO producto_talla_color (id_ptc, id_producto, id_talla, id_color, estado_stock) VALUES
        (1, 1, 2, 1, 'Disponible'),
        (2, 1, 3, 1, 'Disponible'),
        (3, 1, 4, 1, 'Disponible'),
        (4, 1, 3, 2, 'Disponible'),
        (5, 2, 3, 3, 'Disponible'),
        (6, 2, 4, 3, 'Disponible'),
        (7, 3, 3, 3, 'Disponible'),
        (8, 3, 4, 3, 'Disponible'),
        (9, 4, 3, 1, 'Disponible'),
        (10, 4, 4, 1, 'Disponible'),
        (11, 5, 2, 4, 'Disponible'),
        (12, 5, 3, 4, 'Disponible'),
        (13, 6, 3, 1, 'Disponible'),
        (14, 6, 4, 1, 'Disponible'),
        (15, 7, 3, 1, 'Disponible'),
        (16, 7, 4, 1, 'Disponible')
      ON CONFLICT (id_ptc) DO NOTHING;

      INSERT INTO inventario_stock (id_ptc, id_sucursal, cantidad_disponible, cantidad_reservada, cantidad_vendida, stock_minimo_alert) VALUES
        (1, 1, 25, 0, 5, 5),
        (2, 1, 40, 2, 10, 10),
        (3, 1, 30, 1, 8, 8),
        (4, 1, 20, 0, 4, 5),
        (5, 1, 15, 0, 3, 4),
        (6, 1, 22, 1, 5, 6),
        (7, 1, 18, 0, 7, 5),
        (8, 1, 24, 0, 6, 6),
        (9, 1, 12, 0, 2, 3),
        (10, 1, 16, 0, 4, 4),
        (11, 1, 14, 1, 3, 4),
        (12, 1, 19, 0, 5, 5),
        (13, 1, 20, 0, 8, 5),
        (14, 1, 25, 0, 10, 6),
        (15, 1, 35, 0, 12, 5),
        (16, 1, 28, 0, 8, 5)
      ON CONFLICT (id_ptc, id_sucursal) DO UPDATE SET cantidad_disponible = EXCLUDED.cantidad_disponible;

      -- Ventas para alimentar Dashboard
      INSERT INTO ventas (id_venta, numero_factura, id_cliente, id_usuario, id_sucursal, tipo_venta, subtotal, descuento, impuesto, total, metodo_pago, estado, fecha_venta)
      VALUES
        (1, 'FAC-2026-0001', 1, 1, 1, 'Presencial', 330.00, 0, 0, 330.00, 'Efectivo', 'Completada', NOW() - INTERVAL '3 days'),
        (2, 'FAC-2026-0002', 1, 1, 1, 'Presencial', 450.00, 0, 0, 450.00, 'Tarjeta', 'Completada', NOW() - INTERVAL '1 day'),
        (3, 'FAC-2026-0003', 1, 1, 1, 'Online', 280.00, 0, 0, 280.00, 'QR', 'Completada', NOW())
      ON CONFLICT (id_venta) DO NOTHING;

      INSERT INTO venta_items (id_venta_item, id_venta, id_ptc, cantidad, precio_unitario, subtotal)
      VALUES
        (1, 1, 1, 1, 120.00, 120.00),
        (2, 1, 5, 1, 210.00, 210.00),
        (3, 2, 9, 1, 450.00, 450.00),
        (4, 3, 7, 1, 280.00, 280.00)
      ON CONFLICT (id_venta_item) DO NOTHING;

      INSERT INTO respaldo_programacion (id_programacion, tipo_frecuencia, hora_ejecucion, activo, retencion_dias)
      VALUES (1, 'Diario', '02:00:00', true, 30)
      ON CONFLICT (id_programacion) DO NOTHING;

      -- 10. Planes de Suscripción SaaS
      INSERT INTO planes_suscripcion (id_plan, nombre, descripcion, precio_mensual, max_sucursales, max_productos, max_usuarios, vestidor_ra_habilitado, reportes_ia_habilitado, estado)
      VALUES
        (1, 'Emprendedor', 'Ideal para tiendas que inician con 1 sucursal física o virtual', 150.00, 1, 80, 3, false, true, 'Activo'),
        (2, 'Profesional', 'Para boutiques en crecimiento con vestidor virtual RA y múltiples sucursales', 350.00, 3, 300, 8, true, true, 'Activo'),
        (3, 'Empresarial Multi-Sucursal', 'Todo ilimitado: Vestidor RA, IA de voz, inventario centralizado y soporte 24/7', 700.00, 999, 99999, 999, true, true, 'Activo')
      ON CONFLICT (id_plan) DO NOTHING;

      -- 11. Tiendas Tenants Iniciales
      INSERT INTO tiendas (id_tienda, nombre, slug, logo_url, telefono, nit, estado)
      VALUES
        (1, 'Tiendas Montaño', 'tiendas-montano', '/logo.png', '78912345', '1029384756', 'Activa'),
        (2, 'Boutique Elegance & Moda', 'boutique-elegance', null, '71234567', '9876543210', 'Activa')
      ON CONFLICT (id_tienda) DO NOTHING;

      -- 12. Suscripciones Iniciales de Tiendas
      INSERT INTO suscripciones_tienda (id_suscripcion, id_tienda, id_plan, fecha_inicio, fecha_fin, dias_gracia, estado, monto_pagado, metodo_pago, codigo_comprobante)
      VALUES
        (1, 1, 3, NOW(), NOW() + INTERVAL '365 days', 7, 'Activa', 700.00, 'Transferencia_Anual', 'SUB-MONTANO-2026'),
        (2, 2, 2, NOW(), NOW() + INTERVAL '60 days', 5, 'Activa', 350.00, 'QR_Bancario', 'SUB-ELEGANCE-2026')
      ON CONFLICT (id_suscripcion) DO NOTHING;

      -- Vincular datos existentes a la tienda principal (id_tienda = 1)
      UPDATE sucursales SET id_tienda = 1 WHERE id_tienda IS NULL;
      UPDATE productos SET id_tienda = 1 WHERE id_tienda IS NULL;
      UPDATE usuarios SET id_tienda = 1 WHERE id_tienda IS NULL;
      UPDATE ventas SET id_tienda = 1 WHERE id_tienda IS NULL;
      UPDATE reservas SET id_tienda = 1 WHERE id_tienda IS NULL;
    `);

    // Ajuste de secuencias
    await this.dataSource.query(`
      SELECT setval('roles_id_rol_seq', (SELECT COALESCE(MAX(id_rol), 1) FROM roles));
      SELECT setval('usuarios_id_usuario_seq', (SELECT COALESCE(MAX(id_usuario), 1) FROM usuarios));
      SELECT setval('ciudades_id_ciudad_seq', (SELECT COALESCE(MAX(id_ciudad), 1) FROM ciudades));
      SELECT setval('sucursales_id_sucursal_seq', (SELECT COALESCE(MAX(id_sucursal), 1) FROM sucursales));
      SELECT setval('categorias_id_categoria_seq', (SELECT COALESCE(MAX(id_categoria), 1) FROM categorias));
      SELECT setval('temporadas_id_temporada_seq', (SELECT COALESCE(MAX(id_temporada), 1) FROM temporadas));
      SELECT setval('colecciones_id_coleccion_seq', (SELECT COALESCE(MAX(id_coleccion), 1) FROM colecciones));
      SELECT setval('productos_id_producto_seq', (SELECT COALESCE(MAX(id_producto), 1) FROM productos));
      SELECT setval('producto_talla_color_id_ptc_seq', (SELECT COALESCE(MAX(id_ptc), 1) FROM producto_talla_color));
      SELECT setval('inventario_stock_id_stock_seq', (SELECT COALESCE(MAX(id_stock), 1) FROM inventario_stock));
      SELECT setval('ventas_id_venta_seq', (SELECT COALESCE(MAX(id_venta), 1) FROM ventas));
      SELECT setval('venta_items_id_venta_item_seq', (SELECT COALESCE(MAX(id_venta_item), 1) FROM venta_items));
      SELECT setval('planes_suscripcion_id_plan_seq', (SELECT COALESCE(MAX(id_plan), 1) FROM planes_suscripcion));
      SELECT setval('tiendas_id_tienda_seq', (SELECT COALESCE(MAX(id_tienda), 1) FROM tiendas));
      SELECT setval('suscripciones_tienda_id_suscripcion_seq', (SELECT COALESCE(MAX(id_suscripcion), 1) FROM suscripciones_tienda));
    `);
  }
}
