import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { ClienteService } from './SRV_ClienteService.js';
import { RegistroRequest } from './Esquemas.js';

@Controller('clientes')
export class ClienteController {
  constructor(
    private readonly clienteService: ClienteService,
    private readonly config: ConfigService,
  ) {}

  private get cookieSecure(): boolean {
    return String(this.config.get<string>('COOKIE_SECURE', 'false')).toLowerCase() === 'true';
  }

  @Post('registrar')
  async registrar(
    @Body() body: RegistroRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { statusCode, ...resultado } = await this.clienteService.registrarCliente(body, request);
    if (resultado.access_token) {
      response.cookie('access_token', resultado.access_token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.cookieSecure,
        maxAge: Number(this.config.get('JWT_ACCESS_TOKEN_MINUTES', 15)) * 60 * 1000,
        path: '/',
      });
    }
    if (resultado.refresh_token) {
      response.cookie('refresh_token', resultado.refresh_token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.cookieSecure,
        maxAge: Number(this.config.get('JWT_REFRESH_TOKEN_DAYS', 7)) * 86400 * 1000,
        path: '/',
      });
    }
    response.status(statusCode);
    return resultado;
  }
}