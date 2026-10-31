import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tienda, PlanSuscripcion, SuscripcionTienda } from './CE_Modelos.js';
import { SaasService } from './SRV_SaasService.js';
import { SaasController } from './CTR_Saas.js';
import { ProcesosCiclicosService } from './ProcesosCiclicos.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tienda, PlanSuscripcion, SuscripcionTienda]),
  ],
  controllers: [SaasController],
  providers: [SaasService, ProcesosCiclicosService],
  exports: [SaasService, ProcesosCiclicosService],
})
export class SaasModule {}
