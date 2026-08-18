"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const users_admin_service_1 = require("../../../src/users-admin/users-admin.service");
const prisma_service_1 = require("../../../src/prisma/prisma.service");
const common_1 = require("@nestjs/common");
const bcrypt = require("bcryptjs");
describe('UsersAdminService (Unitarias)', () => {
    let service;
    let prismaService;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                users_admin_service_1.UsersAdminService,
                {
                    provide: prisma_service_1.PrismaService,
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
        service = module.get(users_admin_service_1.UsersAdminService);
        prismaService = module.get(prisma_service_1.PrismaService);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('Crear Usuario (Admin)', () => {
        const createUserDto = {
            nombre: 'Admin',
            apellido: 'User',
            email: 'admin@test.com',
            password: 'Password123!',
            direccion: 'Admin St',
            fecha_nacimiento: '1990-01-01',
            id_rol: 2,
            id_tipo_identificacion: 1,
            numero_identificacion: '987654321',
            email_verified: true,
        };
        it('CP-049 - debe registrar correctamente un nuevo usuario con datos válidos', async () => {
            const findFirstSpy = jest.spyOn(prismaService.usuarios, 'findFirst');
            findFirstSpy.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
            jest.spyOn(bcrypt, 'hash').mockResolvedValue('hash');
            const createSpy = jest.spyOn(prismaService.usuarios, 'create').mockResolvedValue({ id: 1 });
            const result = await service.create(createUserDto);
            expect(findFirstSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({
                where: { email: createUserDto.email },
                select: { id: true },
            }));
            expect(findFirstSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({
                where: { numero_identificacion: createUserDto.numero_identificacion },
                select: { id: true },
            }));
            expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);
            expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    id_rol: createUserDto.id_rol,
                    numero_identificacion: createUserDto.numero_identificacion,
                }),
            }));
            expect(result).toEqual({ success: true, message: 'Usuario agregado correctamente' });
        });
        it('CP-050 - debe rechazar si el correo electrónico ya está registrado', async () => {
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({ id: 1 });
            await expect(service.create(createUserDto)).rejects.toThrow(common_1.ConflictException);
        });
        it('CP-051 - debe rechazar si el número de identificación ya está registrado', async () => {
            const findFirstSpy = jest.spyOn(prismaService.usuarios, 'findFirst');
            findFirstSpy.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 2 });
            await expect(service.create(createUserDto)).rejects.toThrow(common_1.ConflictException);
        });
        it('CP-052 - debe propagar un error si la BD rechaza por campos obligatorios', async () => {
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue(null);
            jest.spyOn(bcrypt, 'hash').mockResolvedValue('hash');
            jest.spyOn(prismaService.usuarios, 'create').mockRejectedValue(new Error('Prisma ValidationError: Missing required fields'));
            await expect(service.create(createUserDto)).rejects.toThrow();
        });
        it('CP-054 - debe almacenar correctamente el rol asignado al nuevo usuario', async () => {
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue(null);
            jest.spyOn(bcrypt, 'hash').mockResolvedValue('hash');
            jest.spyOn(prismaService.usuarios, 'create').mockResolvedValue({ id: 1 });
            const result = await service.create(createUserDto);
            expect(prismaService.usuarios.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    id_rol: 2,
                }),
            }));
            expect(result).toEqual({
                success: true,
                message: 'Usuario agregado correctamente',
            });
        });
    });
    describe('RF-002.2 Consultar Usuario', () => {
        it('CP-055 - debe consultar el listado de usuarios registrados', async () => {
            jest.spyOn(prismaService.usuarios, 'findMany').mockResolvedValue([
                { id: 1, nombre: 'Admin', apellido: 'User', email: 'admin@test.com' },
            ]);
            const result = await service.findAll('');
            expect(prismaService.usuarios.findMany).toHaveBeenCalled();
            expect(result).toMatchObject({
                success: true,
                usuarios: [
                    {
                        id: 1,
                        nombre: 'Admin',
                        apellido: 'User',
                        email: 'admin@test.com',
                    },
                ],
            });
        });
        it('CP-056 - debe informar cuando no existen usuarios o resultados para la consulta', async () => {
            jest.spyOn(prismaService.usuarios, 'findMany').mockResolvedValue([]);
            const result = await service.findAll('criterio_que_no_existe');
            expect(prismaService.usuarios.findMany).toHaveBeenCalled();
            expect(result).toEqual({
                success: true,
                usuarios: [],
            });
        });
    });
    describe('RF-002.3 Editar Usuario', () => {
        it('CP-058 - debe actualizar correctamente la información de un usuario', async () => {
            jest.spyOn(prismaService.usuarios, 'findUnique').mockResolvedValue({ id: 1 });
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue(null);
            jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({ id: 1 });
            const result = await service.update('1', {
                nombre: 'Nuevo',
                apellido: 'Usuario',
                email: 'nuevo@test.com',
            });
            expect(prismaService.usuarios.update).toHaveBeenCalled();
            expect(result).toEqual({
                success: true,
                message: 'Usuario actualizado correctamente',
            });
        });
        it('CP-059 - debe impedir actualizar un correo registrado por otro usuario', async () => {
            jest.spyOn(prismaService.usuarios, 'findUnique').mockResolvedValue({ id: 1 });
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({ id: 2 });
            await expect(service.update('1', { email: 'exist@test.com' })).rejects.toThrow(common_1.ConflictException);
        });
        it('CP-060 - debe impedir actualizar un número de identificación registrado por otro usuario', async () => {
            jest.spyOn(prismaService.usuarios, 'findUnique').mockResolvedValue({ id: 1 });
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({ id: 2 });
            await expect(service.update('1', { numero_identificacion: '222222222' })).rejects.toThrow(common_1.ConflictException);
        });
        it('CP-061 - debe validar los campos obligatorios al actualizar la información de un usuario', async () => {
            jest.spyOn(prismaService.usuarios, 'findUnique').mockResolvedValue({ id: 1 });
            const result = await service.update('1', {
                nombre: '',
                apellido: '',
            });
            expect(result).toEqual({
                success: true,
                message: 'Sin cambios para actualizar',
            });
        });
        it('CP-062 - debe ignorar valores vacíos y devolver sin cambios cuando no hay información útil para actualizar', async () => {
            jest.spyOn(prismaService.usuarios, 'findUnique').mockResolvedValue({ id: 1 });
            const result = await service.update('1', { nombre: '   ', apellido: '' });
            expect(result).toEqual({
                success: true,
                message: 'Sin cambios para actualizar',
            });
            expect(prismaService.usuarios.update).not.toHaveBeenCalled();
        });
    });
    describe('RF-002.4 Eliminar Usuario', () => {
        it('CP-063 - debe eliminar correctamente un usuario que no tiene registros asociados', async () => {
            jest.spyOn(prismaService.usuarios, 'findUnique').mockResolvedValue({ id: 1 });
            jest.spyOn(prismaService.usuarios, 'delete').mockResolvedValue({ id: 1 });
            const result = await service.remove('1');
            expect(prismaService.usuarios.delete).toHaveBeenCalledWith({ where: { id: 1 } });
            expect(result).toEqual({
                success: true,
                message: 'Usuario eliminado correctamente',
            });
        });
        it('CP-064 - debe impedir eliminar un usuario que tiene registros asociados', async () => {
            const relationError = new Error('Foreign key constraint failed');
            Object.assign(relationError, {
                code: 'P2003',
                meta: { modelName: 'usuarios' },
            });
            jest.spyOn(prismaService.usuarios, 'findUnique').mockResolvedValue({ id: 1 });
            jest.spyOn(prismaService.usuarios, 'delete').mockRejectedValue(relationError);
            await expect(service.remove('1')).rejects.toThrow('Error al eliminar usuario');
        });
        it('CP-065 - debe ejecutar la eliminación solo después de validar el usuario y la confirmación del flujo', async () => {
            jest.spyOn(prismaService.usuarios, 'findUnique').mockResolvedValue({ id: 1 });
            const deleteSpy = jest.spyOn(prismaService.usuarios, 'delete').mockResolvedValue({ id: 1 });
            const result = await service.remove('1');
            expect(deleteSpy).toHaveBeenCalledTimes(1);
            expect(result).toEqual({
                success: true,
                message: 'Usuario eliminado correctamente',
            });
        });
    });
});
//# sourceMappingURL=users-admin.service.test.js.map