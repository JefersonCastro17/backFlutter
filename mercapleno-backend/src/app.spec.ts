import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './app.module';
import { ProductsService } from './products/products.service';
import { UsersAdminService } from './users-admin/users-admin.service';
import { InventoryService } from './inventory/inventory.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { envs } from './config';
import { PrismaService } from './prisma/prisma.service';

describe('App End-to-End (e2e)', () => {
  let app: INestApplication;
  let consoleLogSpy: jest.SpyInstance;
  let jwtGuardSpy: jest.SpyInstance;
  let rolesGuardSpy: jest.SpyInstance;
  let prismaInitSpy: jest.SpyInstance;

  const mockProductsService = {
    findAll: jest.fn().mockResolvedValue([
      { id_productos: 1, nombre: 'E2E Product', precio: 10.99, estado: 'Disponible' }
    ]),
    create: jest.fn().mockResolvedValue({ message: 'Producto agregado correctamente', id: 1 }),
  };

  const mockUsersAdminService = {
    findAll: jest.fn().mockResolvedValue([
      { id: 1, nombre: 'Admin User', email: 'admin@mercapleno.com' }
    ]),
  };

  const mockInventoryService = {
    registerMovement: jest.fn().mockResolvedValue({ message: 'Movimiento registrado con exito' }),
  };

  beforeAll(async () => {
    // Spy on console.log to avoid cluttering test output during E2E executions
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Spy on guards to bypass auth in E2E tests
    jwtGuardSpy = jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockImplementation(() => true);
    rolesGuardSpy = jest.spyOn(RolesGuard.prototype, 'canActivate').mockImplementation(() => true);

    // Silence Prisma connection warning by mocking onModuleInit
    prismaInitSpy = jest.spyOn(PrismaService.prototype, 'onModuleInit').mockImplementation(async () => {});

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ProductsService)
      .useValue(mockProductsService)
      .overrideProvider(UsersAdminService)
      .useValue(mockUsersAdminService)
      .overrideProvider(InventoryService)
      .useValue(mockInventoryService)
      .compile();

    app = moduleFixture.createNestApplication();
    
    // Mimic the production bootstrapping configuration in main.ts
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
    consoleLogSpy.mockRestore();
    jwtGuardSpy.mockRestore();
    rolesGuardSpy.mockRestore();
    prismaInitSpy.mockRestore();
  });

  describe('Products Module', () => {
    it('GET /api/productos - should fetch all products', () => {
      return request(app.getHttpServer())
        .get('/api/productos')
        .expect(200)
        .expect(res => {
          expect(res.body).toBeInstanceOf(Array);
          expect(res.body[0].nombre).toBe('E2E Product');
        });
    });

    it('POST /api/productos - validation check - should fail if state/properties are invalid', () => {
      return request(app.getHttpServer())
        .post('/api/productos')
        .send({ nombre: 'Short', precio: -5 }) // invalid price, missing required properties
        .expect(400)
        .expect(res => {
          expect(res.body.message).toBeDefined();
        });
    });
  });

  describe('Inventory Module', () => {
    it('POST /api/movimientos/registrar - should register a movement', () => {
      const payload = {
        tipo_movimiento: 'ENTRADA',
        id_producto: 1,
        cantidad: 10,
        id_documento: '01',
        comentario: 'E2E Test Comment'
      };

      return request(app.getHttpServer())
        .post('/api/movimientos/registrar')
        .send(payload)
        .expect(201)
        .expect(res => {
          expect(res.body.message).toContain('exito');
        });
    });
  });

  describe('ApiKeyMiddleware Integration', () => {
    it('GET /api/admin/users - should reject with 401 if x-api-key header is missing', () => {
      return request(app.getHttpServer())
        .get('/api/admin/users')
        .expect(401)
        .expect(res => {
          expect(res.body.message).toBe('Falta clave API');
        });
    });

    it('GET /api/admin/users - should reject with 403 if x-api-key header is incorrect', () => {
      return request(app.getHttpServer())
        .get('/api/admin/users')
        .set('x-api-key', 'wrong-api-key-value')
        .expect(403)
        .expect(res => {
          expect(res.body.message).toBe('Clave API invalida');
        });
    });

    it('GET /api/admin/users - should allow access and return 200 with valid x-api-key', () => {
      return request(app.getHttpServer())
        .get('/api/admin/users')
        .set('x-api-key', envs.internalApiKey || 'testkey123456789')
        .expect(200)
        .expect(res => {
          expect(res.body).toBeInstanceOf(Array);
          expect(res.body[0].nombre).toBe('Admin User');
        });
    });
  });
});
