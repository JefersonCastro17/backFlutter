/**
 * PRUEBA UNITARIA — Módulo Productos (Registrar Producto)
 * Ubicación real sugerida: src/products/products.service.spec.ts
 *
 * Objetivo: probar products.service.ts de forma AISLADA.
 * PrismaService se reemplaza por un mock -> no toca base de datos real.
 * Esto corresponde al nivel "Pruebas Unitarias" del Plan Maestro de QA.
 *
 * Mapeo a Casos de Prueba:
 *  - CP-046 Registro exitoso de producto
 *  - CP-047 Registro con nombre que contiene números (validación)
 *  - (CP-048 -> es sobre 401/403 (JWT). Eso es un problema de INTEGRACIÓN,
 *     no de esta prueba unitaria. Se cubre en productos.e2e-spec.ts)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateProductDto } from './dto/create-product.dto';

describe('ProductsService', () => {
  let service: ProductsService;

  // Mock de PrismaService: simulamos únicamente los métodos que el
  // service realmente usa (productos.create), sin conectar a MySQL.
  const prismaMock = {
    productos: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  // ---------------------------------------------------------------
  // CP-046 — Registro exitoso de producto
  // ---------------------------------------------------------------
  it('CP-046: debe registrar el producto y mapear el estado correctamente', async () => {
    // Dado
    const dto: CreateProductDto = {
      nombre: 'Pan Frances',
      id_categoria: 1,
      id_proveedor: 1,
      precio: 3500,
      estado: 'Disponible',
    };
    const productoCreado = { id_productos: 1, ...dto, estado: 'Disponible' };
    prismaMock.productos.create.mockResolvedValue(productoCreado as any);

    // Cuando
    const resultado = await service.create(dto);

    // Entonces
    expect(prismaMock.productos.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.productos.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nombre: 'Pan Frances', estado: 'Disponible' }),
      }),
    );
    expect(resultado).toEqual({
      message: 'Producto agregado correctamente',
      id: 1,
    });
  });

  // ---------------------------------------------------------------
  // CP-046 (variante) — Error de conexión con la base de datos
  // ---------------------------------------------------------------
  it('debe propagar el error si Prisma falla al crear el producto', async () => {
    const dto: CreateProductDto = {
      nombre: 'Pan Frances',
      id_categoria: 1,
      id_proveedor: 1,
      precio: 3500,
      estado: 'Disponible',
    };
    prismaMock.productos.create.mockRejectedValue(new Error('Connection lost'));

    await expect(service.create(dto)).rejects.toThrow('No se pudo crear el producto');
  });

  // ---------------------------------------------------------------
  // CP-047 — Nombre con números (validación a nivel de DTO)
  // ---------------------------------------------------------------
  it('CP-047: debe rechazar un nombre de producto que contenga números', async () => {
    const dtoInstance = plainToInstance(CreateProductDto, {
      nombre: 'Pan123',
      id_categoria: 1,
      id_proveedor: 1,
      precio: 3500,
      estado: 'Disponible',
    });

    const errores = await validate(dtoInstance);

    expect(errores.length).toBeGreaterThan(0);
    expect(errores.some((e) => e.property === 'nombre')).toBe(true);
  });

  it('debe aceptar un nombre de producto válido (sin números)', async () => {
    const dtoInstance = plainToInstance(CreateProductDto, {
      nombre: 'Pan Frances',
      id_categoria: 1,
      id_proveedor: 1,
      precio: 3500,
      estado: 'Disponible',
    });

    const errores = await validate(dtoInstance);
    expect(errores.length).toBe(0);
  });
});

