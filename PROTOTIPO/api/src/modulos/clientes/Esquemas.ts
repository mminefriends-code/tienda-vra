import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegistroRequest {
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' })
  nombre!: string;

  @IsEmail({}, { message: 'Correo electrónico inválido.' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'El teléfono no debe superar 30 caracteres.' })
  telefono?: string;

  @IsOptional()
  @IsString()
  token_invitado?: string;
}

export class RegistroResponse {
  detail!: string;
  usuario_id!: number;
  confirmacion_email: string = 'enviado';
  warning?: string;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  usuario?: {
    id: number;
    nombre: string | null;
    email: string;
    rol: string | null;
    permisos: unknown[];
  };
}