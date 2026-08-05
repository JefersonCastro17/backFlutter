import { Test, TestingModule } from '@nestjs/testing';
import { UsersAdminService } from '../../../src/users-admin/users-admin.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('UsersAdminService (Unitarias)', () => {
  let service: UsersAdminService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersAdminService,
        {
          provide: PrismaService,
          useValue: {
            usuarios: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            roles: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersAdminService>(UsersAdminService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Consultar Usuarios', () => {
    // CP-059
    it('debe retornar array vacío si no existen resultados de búsqueda', async () => {
      jest.spyOn(prismaService.usuarios, 'findMany').mockResolvedValue([]);

      const result = await service.findAll('criterio_que_no_existe');

      expect(prismaService.usuarios.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array)
          })
        })
      );
      expect(result).toEqual({
        success: true,
        usuarios: [],
      });
    });
  });

  describe('Crear Usuario (Admin)', () => {
    const createUserDto = {
      nombre: 'Admin',
      apellido: 'User',
      email: 'admin@test.com',
      password: 'Password123!',
      direccion: 'Admin St',
      fecha_nacimiento: '1990-01-01',
      id_rol: 2, // CP-056
      id_tipo_identificacion: 1,
      numero_identificacion: '987654321',
      email_verified: true,
    };

    // CP-054
    it('debe propagar un error si la BD rechaza por campos obligatorios', async () => {
      // Aunque la validación principal es del DTO, si llega a Prisma con nulos fallaría
      // Aquí simulamos que Prisma rechaza la creación
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hash' as never);
      jest.spyOn(prismaService.usuarios, 'create').mockRejectedValue(new Error('Prisma ValidationError: Missing required fields'));

      await expect(service.create(createUserDto)).rejects.toThrow();
    });

    // CP-056
    it('debe almacenar correctamente el rol asignado al nuevo usuario', async () => {
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hash' as never);
      jest.spyOn(prismaService.usuarios, 'create').mockResolvedValue({ id: 1 } as any);

      const result = await service.create(createUserDto);

      expect(prismaService.usuarios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id_rol: 2, // CP-056: Verificar que id_rol se mapea correctamente a la BD
          }),
        }),
      );
      expect(result).toEqual({
        success: true,
        message: 'Usuario agregado correctamente',
      });
    });
  });

  describe('Actualizar Usuario (Admin)', () => {
    // CP-064
    it('debe retornar "Sin cambios para actualizar" si se envía un DTO vacío', async () => {
      jest.spyOn(prismaService.usuarios, 'findUnique').mockResolvedValue({ id: 1 } as any);

      const result = await service.update('1', {});

      expect(result).toEqual({
        success: true,
        message: 'Sin cambios para actualizar',
      });
      // Verifica que no se llamó a update en la base de datos
      expect(prismaService.usuarios.update).not.toHaveBeenCalled();
    });
    
    it('debe arrojar ConflictException si el email ya existe', async () => {
      jest.spyOn(prismaService.usuarios, 'findUnique').mockResolvedValue({ id: 1 } as any);
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({ id: 2 } as any); // Conflicto

      await expect(service.update('1', { email: 'exist@test.com' })).rejects.toThrow(ConflictException);
    });
  });
});
