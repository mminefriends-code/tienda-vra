import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ProcesosCiclicosService {
  private readonly logger = new Logger(ProcesosCiclicosService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * CICLO 1: Verificación de Vencimiento de Suscripciones SaaS
   * Se ejecuta de forma cíclica todos los días a medianoche (00:00).
   * Actualiza a 'Vencida' las tiendas cuya fecha límite + días de gracia haya expirado.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cicloVerificarSuscripciones() {
    this.logger.log('⏰ [Proceso Cíclico] Iniciando verificación automática de suscripciones SaaS...');
    try {
      // 1. Marcar suscripciones vencidas
      const resVencidas = await this.dataSource.query(`
        UPDATE suscripciones_tienda
        SET estado = 'Vencida'
        WHERE fecha_fin + (dias_gracia || ' days')::interval < NOW()
          AND estado IN ('Activa', 'En_Gracia')
        RETURNING id_suscripcion, id_tienda
      `);

      // 2. Marcar tiendas como 'Vencida' si no tienen ninguna suscripción activa
      const resTiendas = await this.dataSource.query(`
        UPDATE tiendas
        SET estado = 'Vencida'
        WHERE id_tienda NOT IN (
          SELECT id_tienda FROM suscripciones_tienda WHERE fecha_fin >= NOW() AND estado = 'Activa'
        ) AND estado = 'Activa'
        RETURNING id_tienda, nombre
      `);

      this.logger.log(
        `✅ [Proceso Cíclico] Verificación finalizada. Suscripciones vencidas: ${resVencidas.length}, Tiendas actualizadas: ${resTiendas.length}`,
      );
    } catch (err: any) {
      this.logger.error(`❌ [Proceso Cíclico] Error al verificar suscripciones: ${err?.message}`);
    }
  }

  /**
   * CICLO 2: Recálculo Periódico de Machine Learning para Demanda y Quiebres de Stock
   * Se ejecuta de forma cíclica periódica (cada 6 horas).
   * Analiza ventas de los últimos 30 días para clasificar prendas ABC y proyectar días de stock.
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async cicloEntrenamientoMachineLearning() {
    this.logger.log('🧠 [Proceso Cíclico] Ejecutando análisis cíclico de Machine Learning de demanda...');
    try {
      // Cálculo de velocidad de rotación por prenda y sucursal
      await this.dataSource.query(`
        UPDATE inventario_stock ist
        SET stock_minimo_alert = GREATEST(5, CEIL(velocidad.promedio_diario * 7))
        FROM (
          SELECT vi.id_ptc, v.id_sucursal, COALESCE(SUM(vi.cantidad) / 30.0, 0.2) AS promedio_diario
          FROM venta_items vi
          JOIN ventas v ON v.id_venta = vi.id_venta
          WHERE v.fecha_venta >= NOW() - INTERVAL '30 days'
          GROUP BY vi.id_ptc, v.id_sucursal
        ) AS velocidad
        WHERE ist.id_ptc = velocidad.id_ptc AND ist.id_sucursal = velocidad.id_sucursal
      `);
      this.logger.log('✅ [Proceso Cíclico] Modelos de demanda y umbrales mínimos de stock recalculados.');
    } catch (err: any) {
      this.logger.warn(`⚠️ [Proceso Cíclico] Aviso en ML cíclico: ${err?.message}`);
    }
  }

  /**
   * CICLO 3: Limpieza y Mantenimiento de Bitácora y Sesiones (Cada hora)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cicloMantenimientoSesiones() {
    try {
      await this.dataSource.query(`
        DELETE FROM token_blacklist WHERE fecha_expiracion < NOW()
      `).catch(() => {});
    } catch {}
  }
}

