import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  ParseIntPipe,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SaasService, type CrearTiendaDto, type ExtenderSuscripcionDto } from './SRV_SaasService.js';
import type { Request } from 'express';

@Controller('saas')
export class SaasController {
  constructor(private readonly saasService: SaasService) {}

  @Get('tiendas')
  async listarTiendas() {
    return this.saasService.listarTiendas();
  }

  @Get('tiendas/:id')
  async obtenerTienda(@Param('id', ParseIntPipe) id: number) {
    return this.saasService.obtenerTienda(id);
  }

  @Post('tiendas')
  async crearTienda(@Body() body: CrearTiendaDto) {
    return this.saasService.crearTienda(body);
  }

  @Put('tiendas/:id')
  async actualizarTienda(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { nombre?: string; telefono?: string; nit?: string; logo_url?: string; estado?: string },
  ) {
    return this.saasService.actualizarTienda(id, body);
  }

  @Post('tiendas/:id/extender')
  async extenderSuscripcion(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ExtenderSuscripcionDto,
  ) {
    return this.saasService.extenderSuscripcion(id, body);
  }

  @Get('planes')
  async listarPlanes() {
    return this.saasService.listarPlanes();
  }

  @Post('planes')
  async crearPlan(@Body() body: any) {
    return this.saasService.crearPlan(body);
  }

  @Get('mi-tienda/suscripcion')
  async obtenerEstadoMiTienda(@Query('id_tienda') idTiendaQuery?: string) {
    const idTienda = idTiendaQuery ? parseInt(idTiendaQuery, 10) : 1;
    return this.saasService.obtenerEstadoMiTienda(idTienda);
  }

  @Post('registro-publico')
  async autoRegistroTienda(@Body() body: CrearTiendaDto) {
    return this.saasService.crearTienda({
      ...body,
      dias_iniciales: body.dias_iniciales || 30, // 30 días de prueba para nuevos clientes SaaS
    });
  }
}
