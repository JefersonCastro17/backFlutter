import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { MysqlService } from '../common/database/mysql.service';
import { EmailService } from '../email/email.service';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

describe('InventoryService', () => {
  let service: InventoryService;
  let mysqlService: MysqlService;
  let emailService: EmailService;

  let mockConnection: any;

  const mockMysqlService = {
    query: jest.fn(),
    getConnection: jest.fn(),
  };

  const mockEmailService = {
    sendLowStockAlertToAdmins: jest.fn(),
  };

  beforeEach(async () => {
    mockConnection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn().mockResolvedValue([[{ insertId: 1 }], []]),
      query: jest.fn().mockResolvedValue([[{}], []]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: MysqlService, useValue: mockMysqlService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    mysqlService = module.get<MysqlService>(MysqlService);
    emailService = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProductsWithStock', () => {
    it('should return products with calculated stock metadata', async () => {
      const mockRows = [
        {
          id: 1,
          nombre: 'Product 1',
          precio: '10.50',
          imagen: 'img1.png',
          categoria: 'Cat 1',
          stock: '15',
        },
      ];
      mockMysqlService.query.mockResolvedValue([mockRows]);

      const result = await service.getProductsWithStock();

      expect(mockMysqlService.query).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 1,
          nombre: 'Product 1',
          precio: 10.5,
          stock: 15,
          isLowStock: false,
        })
      );
    });
  });

  describe('getReferenceDocuments', () => {
    it('should fetch and map reference documents', async () => {
      const mockDocs = [
        {
          id_documento: 'DOC01',
          label: 'DOC01',
          total_usos: 3,
        },
      ];
      mockMysqlService.query.mockResolvedValue([mockDocs]);

      const result = await service.getReferenceDocuments('ENTRADA');

      expect(mockMysqlService.query).toHaveBeenCalled();
      expect(result).toEqual([
        {
          id_documento: 'DOC01',
          label: 'DOC01',
          total_usos: 3,
        },
      ]);
    });
  });

  describe('registerMovement', () => {
    const entradaDto = {
      tipo_movimiento: 'ENTRADA' as const,
      id_producto: 1,
      cantidad: 10,
      comentario: 'Test entrada',
      id_documento: 'DOC01',
    };

    const salidaDto = {
      tipo_movimiento: 'SALIDA' as const,
      id_producto: 1,
      cantidad: 5,
      comentario: 'Test salida',
      id_documento: 'DOC02',
    };

    beforeEach(() => {
      mockMysqlService.getConnection.mockResolvedValue(mockConnection);
    });

    it('should throw BadRequestException if document ID is empty', async () => {
      const invalidDto = { ...entradaDto, id_documento: '' };

      await expect(service.registerMovement(invalidDto, 1)).rejects.toThrow(
        new BadRequestException({ error: 'Debe seleccionar un documento de referencia valido' })
      );
    });

    it('should successfully register ENTRADA movement and update stock_actual', async () => {
      // Mock insert movimiento maestro
      mockConnection.execute.mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO movimiento')) {
          return Promise.resolve([{ insertId: 456 }]);
        }
        if (sql.includes('INSERT INTO entrada_productos')) {
          return Promise.resolve([{}]);
        }
        if (sql.includes('UPDATE stock_actual')) {
          // affectedRows = 1
          return Promise.resolve([{ affectedRows: 1 }]);
        }
        return Promise.resolve([{}]);
      });

      // Mock getStockSnapshot
      mockConnection.query.mockResolvedValue([[{ id: 1, nombre: 'Prod 1', stock: 15 }]]);

      const result = await service.registerMovement(entradaDto, 1);

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(result.message).toBe('Movimiento registrado con exito');
      expect(result.warning).toBeUndefined(); // Stock is 15 (not low)
    });

    it('should successfully register ENTRADA movement and insert stock_actual if update affectedRows is 0', async () => {
      mockConnection.execute.mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO movimiento')) {
          return Promise.resolve([{ insertId: 456 }]);
        }
        if (sql.includes('INSERT INTO entrada_productos')) {
          return Promise.resolve([{}]);
        }
        if (sql.includes('UPDATE stock_actual')) {
          // affectedRows = 0
          return Promise.resolve([{ affectedRows: 0 }]);
        }
        if (sql.includes('INSERT INTO stock_actual')) {
          return Promise.resolve([{}]);
        }
        return Promise.resolve([{}]);
      });

      mockConnection.query.mockResolvedValue([[{ id: 1, nombre: 'Prod 1', stock: 10 }]]);

      const result = await service.registerMovement(entradaDto, 1);

      expect(mockConnection.commit).toHaveBeenCalled();
      expect(result.message).toBe('Movimiento registrado con exito');
    });

    it('should successfully register SALIDA movement when stock is sufficient', async () => {
      // Query mock: check stock
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT stock FROM stock_actual')) {
          return Promise.resolve([[{ stock: 20 }]]); // Sufficient stock (20 > 5)
        }
        if (sql.includes('SELECT p.id_productos')) {
          // snapshot
          return Promise.resolve([[{ id: 1, nombre: 'Prod 1', stock: 15 }]]);
        }
        return Promise.resolve([[]]);
      });

      mockConnection.execute.mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO movimiento')) {
          return Promise.resolve([{ insertId: 789 }]);
        }
        if (sql.includes('INSERT INTO salida_productos')) {
          return Promise.resolve([{}]);
        }
        if (sql.includes('UPDATE stock_actual')) {
          return Promise.resolve([{ affectedRows: 1 }]);
        }
        return Promise.resolve([{}]);
      });

      const result = await service.registerMovement(salidaDto, 1);

      expect(mockConnection.commit).toHaveBeenCalled();
      expect(result.message).toBe('Movimiento registrado con exito');
    });

    it('should throw BadRequestException on SALIDA if stock is insufficient', async () => {
      // Query mock: insufficient stock
      mockConnection.query.mockResolvedValue([[{ stock: 3 }]]); // Insufficient stock (3 < 5)

      await expect(service.registerMovement(salidaDto, 1)).rejects.toThrow(
        new BadRequestException({ error: 'Stock insuficiente para registrar salida' })
      );

      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException and rollback on general database failure', async () => {
      const dbError = new Error('Database connection lost');
      mockConnection.execute.mockRejectedValue(dbError);

      await expect(service.registerMovement(entradaDto, 1)).rejects.toThrow(
        new InternalServerErrorException({ error: 'No se pudo registrar el movimiento' })
      );

      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });
});
