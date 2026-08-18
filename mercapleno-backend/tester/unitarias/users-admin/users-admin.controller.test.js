"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const users_admin_controller_1 = require("../../../src/users-admin/users-admin.controller");
const users_admin_service_1 = require("../../../src/users-admin/users-admin.service");
describe('UsersAdminController (Unitarias)', () => {
    let controller;
    let service;
    const mockUsersAdminService = {
        findAll: jest.fn(),
        findRoles: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [users_admin_controller_1.UsersAdminController],
            providers: [
                {
                    provide: users_admin_service_1.UsersAdminService,
                    useValue: mockUsersAdminService,
                },
            ],
        }).compile();
        controller = module.get(users_admin_controller_1.UsersAdminController);
        service = module.get(users_admin_service_1.UsersAdminService);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('findAll', () => {
        it('debe listar los usuarios administrativos delegando al servicio', async () => {
            const mockUsers = [{ id: 1, nombre: 'Admin' }];
            mockUsersAdminService.findAll.mockResolvedValue({ success: true, usuarios: mockUsers });
            const result = await controller.findAll('search_term');
            expect(service.findAll).toHaveBeenCalledWith('search_term');
            expect(result).toEqual({ success: true, usuarios: mockUsers });
        });
    });
    describe('findRoles', () => {
        it('debe listar los roles disponibles delegando al servicio', async () => {
            const mockRoles = [{ id: 1, nombre: 'SuperAdmin' }, { id: 2, nombre: 'Admin' }];
            mockUsersAdminService.findRoles.mockResolvedValue({ success: true, roles: mockRoles });
            const result = await controller.findRoles();
            expect(service.findRoles).toHaveBeenCalled();
            expect(result).toEqual({ success: true, roles: mockRoles });
        });
    });
    describe('findOne', () => {
        it('debe consultar un usuario por ID delegando al servicio', async () => {
            const mockUser = { id: 1, nombre: 'Admin' };
            mockUsersAdminService.findOne.mockResolvedValue({ success: true, usuario: mockUser });
            const result = await controller.findOne('1');
            expect(service.findOne).toHaveBeenCalledWith('1');
            expect(result).toEqual({ success: true, usuario: mockUser });
        });
    });
    describe('create', () => {
        it('debe crear un usuario administrativo delegando al servicio', async () => {
            const dto = {
                nombre: 'Nuevo',
                apellido: 'Admin',
                email: 'nuevo@admin.com',
                password: 'Password123!',
                direccion: 'Calle 456',
                fecha_nacimiento: '1990-01-01',
                id_rol: 2,
                id_tipo_identificacion: 1,
                numero_identificacion: '987654321',
            };
            const mockResponse = { success: true, message: 'Usuario agregado correctamente' };
            mockUsersAdminService.create.mockResolvedValue(mockResponse);
            const result = await controller.create(dto);
            expect(service.create).toHaveBeenCalledWith(dto);
            expect(result).toEqual(mockResponse);
        });
    });
    describe('update & updatePut', () => {
        it('debe actualizar un usuario vía PATCH delegando al servicio', async () => {
            const dto = { nombre: 'Actualizado' };
            const mockResponse = { success: true, message: 'Usuario actualizado correctamente' };
            mockUsersAdminService.update.mockResolvedValue(mockResponse);
            const result = await controller.update('1', dto);
            expect(service.update).toHaveBeenCalledWith('1', dto);
            expect(result).toEqual(mockResponse);
        });
        it('debe actualizar un usuario vía PUT delegando al servicio', async () => {
            const dto = { nombre: 'Actualizado Put' };
            const mockResponse = { success: true, message: 'Usuario actualizado correctamente' };
            mockUsersAdminService.update.mockResolvedValue(mockResponse);
            const result = await controller.updatePut('1', dto);
            expect(service.update).toHaveBeenCalledWith('1', dto);
            expect(result).toEqual(mockResponse);
        });
    });
    describe('remove', () => {
        it('debe eliminar un usuario delegando al servicio', async () => {
            const mockResponse = { success: true, message: 'Usuario eliminado correctamente' };
            mockUsersAdminService.remove.mockResolvedValue(mockResponse);
            const result = await controller.remove('1');
            expect(service.remove).toHaveBeenCalledWith('1');
            expect(result).toEqual(mockResponse);
        });
    });
});
//# sourceMappingURL=users-admin.controller.test.js.map