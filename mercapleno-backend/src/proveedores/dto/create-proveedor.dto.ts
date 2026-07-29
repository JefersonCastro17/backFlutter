import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateProveedorDto {
  @ApiProperty({ example: 'Luis', description: 'Nombre del proveedor' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString({ message: 'El nombre debe ser un texto' })
  @MaxLength(50, { message: 'El nombre no puede superar los 50 caracteres' })
  @Matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/, {
    message: 'El nombre solo puede contener letras y espacios',
  })
  nombre: string;

  @ApiProperty({ example: 'González', description: 'Apellido del proveedor' })
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  @IsString({ message: 'El apellido debe ser un texto' })
  @MaxLength(50, { message: 'El apellido no puede superar los 50 caracteres' })
  @Matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/, {
    message: 'El apellido solo puede contener letras y espacios',
  })
  apellido: string;

  @ApiProperty({
    example: '3001234567',
    description: 'Teléfono del proveedor',
    required: true,
  })
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @IsString({ message: 'El teléfono debe ser un texto' })
  @MaxLength(10, { message: 'El teléfono no puede superar los 10 caracteres' })
  @Matches(/^[0-9]+$/, {
    message: 'El teléfono solo puede contener números',
  })
  telefono: string;
}
