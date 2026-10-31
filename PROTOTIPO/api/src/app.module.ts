import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health.controller.js';
import { SeguridadModule } from './modulos/seguridad/seguridad.module.js';
import { ClientesModule } from './modulos/clientes/clientes.module.js';
import { CatalogoModule } from './modulos/catalogo/catalogo.module.js';
import { ProveedoresModule } from './modulos/proveedores/proveedores.module.js';
import { ComprasModule } from './modulos/compras/compras.module.js';
import { InventarioModule } from './modulos/inventario/inventario.module.js';
import { RespaldosModule } from './modulos/respaldos/RespaldosModule.js';
import { ReservasModule } from './modulos/reservas/ReservasModule.js';
import { SesionesRaModule } from './modulos/sesiones-ra/SesionesRaModule.js';
import { CarritoModule } from './modulos/carrito/CarritoModule.js';
import { VentasModule } from './modulos/ventas/VentasModule.js';
import { PagosModule } from './modulos/pagos/PagosModule.js';
import { ComprobantesModule } from './modulos/comprobantes/ComprobantesModule.js';
import { RecomendacionesModule } from './modulos/recomendaciones/RecomendacionesModule.js';
import { ReportesVozModule } from './modulos/reportes-voz/ReportesVozModule.js';
import { DashboardModule } from './modulos/dashboard/DashboardModule.js';
import { AlertasCriticasModule } from './modulos/alertas/AlertasCriticasModule.js';
import { SaasModule } from './modulos/saas/SaasModule.js';

import { DatabaseInitializerService } from './database-initializer.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: config.get<string>('DATABASE_SYNCHRONIZE') === 'true' || config.get<string>('NODE_ENV') !== 'production',
        ssl: config.get<string>('DATABASE_SSL') === 'true' ? { rejectUnauthorized: false } : false,
      }),
    }),
    SeguridadModule,
    ClientesModule,
    CatalogoModule,
    ProveedoresModule,
    ComprasModule,
    InventarioModule,
    RespaldosModule,
    ReservasModule,
    SesionesRaModule,
    CarritoModule,
    VentasModule,
    PagosModule,
    ComprobantesModule,
    RecomendacionesModule,
    ReportesVozModule,
    DashboardModule,
    AlertasCriticasModule,
    SaasModule,
  ],
  controllers: [HealthController],
  providers: [DatabaseInitializerService],
})
export class AppModule {}