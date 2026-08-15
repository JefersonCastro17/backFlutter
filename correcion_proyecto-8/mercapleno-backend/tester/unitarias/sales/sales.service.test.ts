process.env.INTERNAL_API_KEY = 'test-internal-key';
process.env.NODE_ENV = 'test';

import { BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { SalesService } from '../../../src/sales/sales.service';

describe('SalesService (Unitarias)', () => {
  let service: SalesService;
  let db: { query: jest.Mock; getConnection: jest.Mock };
  let cartService: { getCartSum: jest.Mock; clearCart: jest.Mock };
  let emailService: { sendLowStockAlertToAdmins: jest.Mock };

  beforeEach(() => {
    db = {
      query: jest.fn(),
      getConnection: jest.fn(),
    };

    cartService = {
      getCartSum: jest.fn(),
      clearCart: jest.fn(),
    };

    emailService = {
      sendLowStockAlertToAdmins: jest.fn(),
    };

    service = new SalesService(db as any, emailService as any, cartService as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('RF-003.1 - Catálogo', () => {
    it('CP-071 - debe devolver el catálogo con productos activos y stock disponible', async () => {
      db.query.mockResolvedValue([
        [
          {
            id: 1,
            nombre: 'Arroz Premium',
            descripcion: 'Arroz de primera calidad',
            precio: '2500',
            category: 'Abarrotes',
            image: 'arroz.png',
            stock: 10,
          },
          {
            id: 2,
            nombre: 'Leche Entera',
            descripcion: 'Leche 1L',
            precio: '3200',
            category: 'Lácteos',
            image: 'leche.png',
            stock: 15,
          },
        ],
      ]);

      const result = await service.getFilteredProducts({});

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: '1',
        nombre: 'Arroz Premium',
        price: 2500,
        category: 'abarrotes',
        stock: 10,
      });
    });

    it('CP-072 - no debe incluir productos inactivos ni sin stock', async () => {
      db.query.mockResolvedValue([
        [
          {
            id: 1,
            nombre: 'Producto activo',
            descripcion: 'Disponible',
            precio: '5000',
            category: 'Abarrotes',
            image: 'activo.png',
            stock: 5,
          },
        ],
      ]);

      const result = await service.getFilteredProducts({});

      expect(result).toHaveLength(1);
      expect(result[0].stock).toBeGreaterThan(0);
      expect(result[0].nombre).toBe('Producto activo');
      expect(result.every((product: any) => product.stock > 0)).toBe(true);
    });

    it('CP-075 - debe aplicar filtros por nombre, categoría y rango de precios', async () => {
      db.query.mockResolvedValue([
        [
          {
            id: 3,
            nombre: 'Pan integral',
            descripcion: 'Pan saludable',
            precio: '3500',
            category: 'Panadería',
            image: 'pan.png',
            stock: 8,
          },
        ],
      ]);

      const result = await service.getFilteredProducts({
        search: 'pan',
        category: 'Panadería',
        precioMin: '3000',
        precioMax: '4000',
      });

      expect(result).toHaveLength(1);
      expect(result[0].nombre).toBe('Pan integral');
      expect(result[0].category).toBe('panadería');
      expect(result[0].price).toBe(3500);
    });
  });

  describe('RF-003.2 - Búsqueda y filtros', () => {
    it('CP-076 - debe buscar productos por nombre', async () => {
      db.query.mockResolvedValue([
        [
          {
            id: 4,
            nombre: 'Gaseosa Cola',
            descripcion: 'Botella 600ml',
            precio: '2500',
            category: 'Bebidas',
            image: 'cola.png',
            stock: 11,
          },
        ],
      ]);

      const result = await service.getFilteredProducts({ search: 'cola' });

      expect(result).toHaveLength(1);
      expect(result[0].nombre).toContain('Cola');
    });

    it('CP-077 - debe filtrar por categoría', async () => {
      db.query.mockResolvedValue([
        [
          {
            id: 20,
            nombre: 'Yogurt Natural',
            descripcion: 'Lácteo',
            precio: '1800',
            category: 'Lácteos',
            image: 'yogurt.png',
            stock: 7,
          },
        ],
      ]);

      const result = await service.getFilteredProducts({ category: 'Lácteos' });

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('lácteos');
    });

    it('CP-078 - debe filtrar por rango de precios', async () => {
      db.query.mockResolvedValue([
        [
          {
            id: 30,
            nombre: 'Queso',
            descripcion: 'Queso fresco',
            precio: '7000',
            category: 'Lácteos',
            image: 'queso.png',
            stock: 4,
          },
        ],
      ]);

      const result = await service.getFilteredProducts({ precioMin: '6000', precioMax: '8000' });

      expect(result).toHaveLength(1);
      expect(result[0].price).toBe(7000);
    });

    it('CP-079 - debe devolver resultado vacío si no hay coincidencias', async () => {
      db.query.mockResolvedValue([[]]);

      const result = await service.getFilteredProducts({ search: 'producto-inexistente' });

      expect(result).toEqual([]);
    });
  });

  describe('RF-003.6 - Métodos de pago', () => {
    it('CP-095 - debe devolver los métodos de pago soportados', async () => {
      db.query.mockResolvedValue([
        [
          { id_metodo: 1, metodo_pago: 'Efectivo' },
          { id_metodo: 2, metodo_pago: 'Transferencia' },
        ],
      ]);

      const result = await service.getPaymentMethods();

      expect(result).toEqual([
        {
          id_metodo: '1',
          metodo_pago: 'Efectivo',
          value: '1',
          label: 'Efectivo',
        },
        {
          id_metodo: '2',
          metodo_pago: 'Transferencia',
          value: '2',
          label: 'Transferencia',
        },
      ]);
    });

    it('CP-097 - debe rechazar un método de pago no soportado', async () => {
      cartService.getCartSum.mockResolvedValue({
        items: [{ productId: 42, quantity: 1 }],
        total: 1500,
        subtotal: 1200,
        tax: 300,
      });

      const connection = {
        beginTransaction: jest.fn(),
        query: jest.fn().mockResolvedValue([[]]),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn(),
      };

      db.getConnection.mockResolvedValue(connection);

      await expect(service.createOrder({ id_metodo: 'M999' }, 5)).rejects.toThrow(BadRequestException);
    });
  });

  describe('RF-003.7 - Confirmación de compra', () => {
    it('CP-099 - debe crear una venta válida y limpiar el carrito', async () => {
      cartService.getCartSum.mockResolvedValue({
        items: [{ productId: 12, quantity: 2 }],
        total: 5000,
        subtotal: 4200,
        tax: 800,
      });

      const connection = {
        beginTransaction: jest.fn(),
        query: jest.fn((sql: string) => {
          if (sql.includes('SELECT id_metodo')) return Promise.resolve([[{ id_metodo: 1 }]]);
          if (sql.includes('INSERT INTO venta')) return Promise.resolve([{ insertId: 99 }]);
          if (sql.includes('SELECT COALESCE(SUM(stock)')) return Promise.resolve([[{ available: 10 }]]);
          if (sql.includes('SELECT nombre, precio FROM productos')) return Promise.resolve([[{ nombre: 'Galletas', precio: 2500 }]]);
          if (sql.includes('INSERT INTO movimiento')) return Promise.resolve([{ insertId: 77 }]);
          if (sql.includes('SELECT id_inventario, stock FROM stock_actual')) return Promise.resolve([[{ id_inventario: 1, stock: 10 }]]);
          if (sql.includes('UPDATE stock_actual')) return Promise.resolve([{ affectedRows: 1 }]);
          return Promise.resolve([[]]);
        }),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn(),
      };

      db.getConnection.mockResolvedValue(connection);

      const result = await service.createOrder({ id_metodo: 'M1' }, 5);

      expect(result).toMatchObject({
        message: 'Venta registrada con exito',
        ticketId: '99',
        total: 5000,
      });
      expect(cartService.clearCart).toHaveBeenCalledWith(5);
      expect(connection.commit).toHaveBeenCalled();
    });

    it('CP-100 - debe rechazar la compra cuando no hay stock suficiente', async () => {
      cartService.getCartSum.mockResolvedValue({
        items: [{ productId: 5, quantity: 4 }],
        total: 1000,
        subtotal: 800,
        tax: 200,
      });

      const connection = {
        beginTransaction: jest.fn(),
        query: jest.fn((sql: string) => {
          if (sql.includes('SELECT id_metodo')) return Promise.resolve([[{ id_metodo: 1 }]]);
          if (sql.includes('INSERT INTO venta')) return Promise.resolve([{ insertId: 88 }]);
          if (sql.includes('SELECT COALESCE(SUM(stock)')) return Promise.resolve([[{ available: 2 }]]);
          return Promise.resolve([[]]);
        }),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn(),
      };

      db.getConnection.mockResolvedValue(connection);

      await expect(service.createOrder({ id_metodo: 'M1' }, 5)).rejects.toThrow(ConflictException);
      expect(connection.rollback).toHaveBeenCalled();
    });

    it('CP-101 - debe hacer rollback completo cuando la transacción falla', async () => {
      cartService.getCartSum.mockResolvedValue({
        items: [{ productId: 9, quantity: 1 }],
        total: 2000,
        subtotal: 1700,
        tax: 300,
      });

      const connection = {
        beginTransaction: jest.fn(),
        query: jest.fn(() => {
          throw new Error('DB failure during transaction');
        }),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn(),
      };

      db.getConnection.mockResolvedValue(connection);

      await expect(service.createOrder({ id_metodo: 'M1' }, 5)).rejects.toThrow(InternalServerErrorException);
      expect(connection.rollback).toHaveBeenCalled();
    });

    it('CP-073, CP-080, CP-089 y CP-102 - debe bloquear la venta sin autenticación válida', async () => {
      await expect(service.createOrder({ id_metodo: 'M1' }, undefined as any)).rejects.toThrow(BadRequestException);
    });

    it('CP-085 y CP-087 - debe rechazar una orden con carrito vacío o payload inválido', async () => {
      cartService.getCartSum.mockResolvedValue({ items: [], total: 0, subtotal: 0, tax: 0 });

      await expect(service.createOrder({ id_metodo: 'M1' }, 5)).rejects.toThrow(BadRequestException);
    });

    it('CP-103 - debe validar los totales calculados por el servidor antes de crear la venta', async () => {
      cartService.getCartSum.mockResolvedValue({
        items: [{ productId: 7, quantity: 1 }],
        total: 3200,
        subtotal: 3000,
        tax: 200,
      });

      const connection = {
        beginTransaction: jest.fn(),
        query: jest.fn((sql: string) => {
          if (sql.includes('SELECT id_metodo')) return Promise.resolve([[{ id_metodo: 1 }]]);
          if (sql.includes('INSERT INTO venta')) return Promise.resolve([{ insertId: 121 }]);
          if (sql.includes('SELECT COALESCE(SUM(stock)')) return Promise.resolve([[{ available: 10 }]]);
          if (sql.includes('SELECT nombre, precio FROM productos')) return Promise.resolve([[{ nombre: 'Jugo', precio: 3000 }]]);
          if (sql.includes('INSERT INTO movimiento')) return Promise.resolve([{ insertId: 88 }]);
          if (sql.includes('SELECT id_inventario, stock FROM stock_actual')) return Promise.resolve([[{ id_inventario: 1, stock: 10 }]]);
          if (sql.includes('UPDATE stock_actual')) return Promise.resolve([{ affectedRows: 1 }]);
          return Promise.resolve([[]]);
        }),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn(),
      };

      db.getConnection.mockResolvedValue(connection);

      const result = await service.createOrder({ id_metodo: 'M1' }, 5);

      expect(result).toMatchObject({
        message: 'Venta registrada con exito',
        ticketId: '121',
        total: 3200,
      });
    });
  });

  describe('RF-003.8 - Comprobante de venta', () => {
    it('debe devolver el detalle de una venta por id con items y metodo de pago', async () => {
      db.query
        .mockResolvedValueOnce([
          [
            {
              id_venta: 45,
              fecha: '2026-08-10 10:00:00',
              total: 9500,
              id_metodo: 1,
              metodo_pago: 'Efectivo',
              nombre_usuario: 'Ana',
              apellido_usuario: 'García',
            },
          ],
        ])
        .mockResolvedValueOnce([
          [
            { id_productos: 1, nombre: 'Pan', cantidad: 2, precio: 2500 },
            { id_productos: 2, nombre: 'Leche', cantidad: 1, precio: 4500 },
          ],
        ]);

      const result = await service.getOrderById(45);

      expect(result).toMatchObject({
        id: 45,
        paymentMethod: 'Efectivo',
        customer: 'Ana García',
      });
      expect(result.items).toHaveLength(2);
      expect(result.items[0].subtotal).toBe(5000);
    });

    it('debe lanzar error cuando la venta no existe', async () => {
      db.query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);

      await expect(service.getOrderById(999)).rejects.toThrow(BadRequestException);
    });
  });

  describe('RF-003.1 - Categorías disponibles', () => {
    it('debe devolver las categorías con stock disponible', async () => {
      db.query.mockResolvedValue([
        [
          { category: 'Abarrotes', product_count: 5 },
          { category: 'Bebidas', product_count: 2 },
        ],
      ]);

      const result = await service.getAvailableCategories();

      expect(result).toEqual([
        { value: 'abarrotes', label: 'Abarrotes', count: 5 },
        { value: 'bebidas', label: 'Bebidas', count: 2 },
      ]);
    });
  });
});
