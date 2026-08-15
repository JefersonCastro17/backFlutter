import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PoolConnection } from 'mysql2/promise';
import { MysqlService } from '../common/database/mysql.service';
import { buildLowStockAlert, getLowStockMetadata, LowStockAlert } from '../common/stock/low-stock.util';
import { EmailService } from '../email/email.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CartService } from '../cart/cart.service';

const MOVIMIENTO_VENTA_ID = 3;

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly db: MysqlService,
    private readonly emailService: EmailService,
    private readonly cartService: CartService,
  ) {}

  private resolvePaymentMethod(value: unknown): string | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return `M${Math.trunc(value)}`;
    }

    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      return null;
    }

    if (/^M\d+$/.test(normalized)) {
      return normalized;
    }

    if (/^\d+$/.test(normalized)) {
      return `M${normalized}`;
    }

    return normalized;
  }

  async getFilteredProducts(filters: {
    search?: string;
    category?: string;
    precioMin?: string;
    precioMax?: string;
  }) {
    let sql = `
      SELECT
        p.id_productos AS id,
        p.nombre,
        p.descripcion,
        p.precio,
        c.nombre AS category,
        p.imagen AS image,
        COALESCE(sa.stock, 0) AS stock
      FROM productos p
      LEFT JOIN stock_actual sa ON p.id_productos = sa.id_productos
      LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
      WHERE p.estado = 'Disponible'
      AND COALESCE(sa.stock, 0) > 0
    `;

    const params: any[] = [];

    if (filters.category && filters.category !== 'todas') {
      sql += ' AND LOWER(c.nombre) = LOWER(?)';
      params.push(filters.category);
    }

    if (filters.search) {
      sql += ' AND p.nombre LIKE ?';
      params.push(`%${filters.search}%`);
    }

    const minValue = Number(filters.precioMin);
    if (!Number.isNaN(minValue)) {
      sql += ' AND p.precio >= ?';
      params.push(minValue);
    }

    const maxValue = Number(filters.precioMax);
    if (!Number.isNaN(maxValue)) {
      sql += ' AND p.precio <= ?';
      params.push(maxValue);
    }

    sql += ' ORDER BY p.nombre ASC';

    const [rows] = await this.db.query<any>(sql, params);
    return rows.map((row: any) => {
      const stock = Number(row.stock || 0);

      return {
        id: String(row.id),
        nombre: row.nombre,
        descripcion: row.descripcion || '',
        price: Number(row.precio),
        category: (row.category || 'otros').toLowerCase(),
        image: row.image,
        stock,
        ...getLowStockMetadata(stock),
      };
    });
  }

  async getAvailableCategories() {
    const sql = `
      SELECT
        c.nombre AS category,
        COUNT(p.id_productos) AS product_count
      FROM categoria c
      JOIN productos p ON c.id_categoria = p.id_categoria
      JOIN stock_actual sa ON p.id_productos = sa.id_productos
      WHERE sa.stock > 0
      GROUP BY c.nombre
      ORDER BY c.nombre
    `;

    const [rows] = await this.db.query<any>(sql);
    return rows.map((row: any) => ({
      value: String(row.category).toLowerCase(),
      label: String(row.category).charAt(0).toUpperCase() + String(row.category).slice(1),
      count: Number(row.product_count),
    }));
  }

  async getPaymentMethods() {
    const sql = `
      SELECT
        id_metodo,
        metodo_pago
      FROM metodo
      ORDER BY id_metodo ASC
    `;

    const [rows] = await this.db.query<any>(sql);

    return rows.map((row: any) => ({
      id_metodo: String(row.id_metodo),
      metodo_pago: String(row.metodo_pago ?? '').trim(),
      value: String(row.id_metodo),
      label: String(row.metodo_pago ?? row.id_metodo ?? 'Metodo de pago'),
    }));
  }

  async getOrderById(id: number) {
    const saleSql = `
      SELECT
        v.id_venta,
        v.fecha,
        v.total,
        v.id_metodo,
        m.metodo_pago,
        u.nombre AS nombre_usuario,
        u.apellido AS apellido_usuario
      FROM venta v
      LEFT JOIN metodo m ON m.id_metodo = v.id_metodo
      LEFT JOIN usuarios u ON u.id = v.id_usuario
      WHERE v.id_venta = ?
      LIMIT 1
    `;

    const [saleRows] = await this.db.query<any[]>(saleSql, [id]);
    const sale = saleRows?.[0];

    if (!sale) {
      throw new BadRequestException({
        error: 'Venta no encontrada',
        message: `No existe una venta con el identificador ${id}.`,
      });
    }

    const itemsSql = `
      SELECT
        vp.id_productos,
        p.nombre,
        vp.cantidad,
        vp.precio
      FROM venta_productos vp
      JOIN productos p ON p.id_productos = vp.id_productos
      WHERE vp.id_venta = ?
      ORDER BY p.nombre ASC
    `;

    const [itemRows] = await this.db.query<any[]>(itemsSql, [id]);

    const customerName = [sale.nombre_usuario, sale.apellido_usuario]
      .filter(Boolean)
      .join(' ')
      .trim();

    return {
      message: 'Detalle de venta obtenido correctamente',
      id: Number(sale.id_venta),
      date: sale.fecha,
      total: Number(sale.total ?? 0),
      paymentMethod: sale.metodo_pago || sale.id_metodo || 'No informado',
      customer: customerName || 'Cliente no disponible',
      items: itemRows.map((item: any) => ({
        id: Number(item.id_productos),
        name: item.nombre,
        quantity: Number(item.cantidad || 0),
        price: Number(item.precio ?? 0),
        subtotal: Number((Number(item.precio ?? 0) * Number(item.cantidad || 0)).toFixed(2)),
      })),
    };
  }

  async getOrdersByUser(userId: number) {
    const sql = `
      SELECT
        v.id_venta AS id,
        v.fecha,
        v.total,
        v.id_metodo,
        m.metodo_pago,
        (
          SELECT COUNT(*) FROM venta_productos vp WHERE vp.id_venta = v.id_venta
        ) AS items_count
      FROM venta v
      LEFT JOIN metodo m ON m.id_metodo = v.id_metodo
      WHERE v.id_usuario = ?
      ORDER BY v.fecha DESC
    `;

    const [rows] = await this.db.query<any[]>(sql, [userId]);

    return (rows || []).map((row: any) => ({
      id: Number(row.id),
      date: row.fecha,
      total: Number(row.total ?? 0),
      paymentMethod: row.metodo_pago || row.id_metodo || 'No informado',
      itemsCount: Number(row.items_count || 0),
    }));
  }

  async createOrder(dto: CreateOrderDto, userId?: number) {
    const idMetodo = this.resolvePaymentMethod(dto.id_metodo ?? dto.metodo_pago);
    if (!idMetodo) {
      throw new BadRequestException({ error: 'Datos de orden incompletos o invalidos.' });
    }

    if (!Number.isFinite(Number(userId))) {
      throw new BadRequestException({ error: 'Usuario no autenticado.' });
    }

    const authUserId = Number(userId);
    const cartSummary = await this.cartService.getCartSum(authUserId);
    if (!cartSummary?.items || cartSummary.items.length === 0) {
      throw new BadRequestException({ error: 'Carrito vacio o no disponible.' });
    }

    const orderTotal = Number(cartSummary.total || 0);
    if (orderTotal <= 0) {
      throw new BadRequestException({ error: 'Total de orden invalido.' });
    }

    let connection: PoolConnection | null = null;
    const lowStockAlerts = new Map<number, LowStockAlert>();

    try {
      connection = await this.db.getConnection();
      await connection.beginTransaction();

      const [[metodo]] = await connection.query<any[]>(
        'SELECT id_metodo FROM metodo WHERE id_metodo = ? LIMIT 1',
        [idMetodo],
      );

      if (!metodo) {
        throw new BadRequestException({
          error: 'Metodo de pago invalido',
          message: `No existe el metodo de pago ${idMetodo}.`,
        });
      }

      const [ventaResult] = await connection.query<any>(
        `INSERT INTO venta (id_documento, id_usuario, id_metodo, fecha, total) VALUES (NULL, ?, ?, NOW(), ?)`,
        [authUserId, idMetodo, orderTotal],
      );

      const idVenta = ventaResult.insertId;
      if (!idVenta) {
        throw new InternalServerErrorException('No se genero la venta');
      }

      for (const item of cartSummary.items) {
        const idProducto = Number(item.productId);
        const cantidad = Number(item.quantity);

        const [[availRow]] = await connection.query<any[]>(
          `SELECT COALESCE(SUM(stock), 0) AS available FROM stock_actual WHERE id_productos = ? FOR UPDATE`,
          [idProducto],
        );

        const available = Number((availRow && availRow.available) || 0);
        if (available < cantidad) {
          throw new ConflictException({
            error: 'Stock Insuficiente',
            message: `El producto ID ${idProducto} no tiene la cantidad solicitada disponible.`,
          });
        }

        const [[prodRow]] = await connection.query<any[]>(
          `SELECT nombre, precio FROM productos WHERE id_productos = ? LIMIT 1`,
          [idProducto],
        );

        const precioActual = prodRow ? Number(prodRow.precio || 0) : 0;
        const nombreProducto = prodRow ? prodRow.nombre : 'Producto';

        await connection.query(
          `INSERT INTO venta_productos (id_venta, id_productos, cantidad, precio) VALUES (?, ?, ?, ?)`,
          [idVenta, idProducto, cantidad, precioActual],
        );

        const [movimientoResult] = await connection.query(
          `INSERT INTO movimiento (id_tipo, descripcion, fecha_generar) VALUES (?, ?, NOW())`,
          [MOVIMIENTO_VENTA_ID, `Salida por venta ID: ${idVenta}`],
        );
        const idMovimientoGenerado = (movimientoResult as any).insertId;

        await connection.query(
          `INSERT INTO salida_productos (id_productos, cantidad, fecha, id_documento, id_usuario, id_movimiento) VALUES (?, ?, NOW(), ?, ?, ?)`,
          [idProducto, cantidad, null, authUserId, idMovimientoGenerado],
        );

        let remaining = cantidad;
        const [stockRows] = await connection.query<any[]>(
          `SELECT id_inventario, stock FROM stock_actual WHERE id_productos = ? AND stock > 0 ORDER BY id_inventario ASC FOR UPDATE`,
          [idProducto],
        );

        for (const sr of stockRows) {
          if (remaining <= 0) break;
          const availableInRow = Number(sr.stock || 0);
          if (availableInRow <= 0) continue;
          const deduct = Math.min(availableInRow, remaining);
          await connection.query(
            `UPDATE stock_actual SET stock = stock - ?, id_movimiento = ?, fecha_vencimiento = CURDATE() WHERE id_inventario = ?`,
            [deduct, idMovimientoGenerado, sr.id_inventario],
          );
          remaining -= deduct;
        }

        if (remaining > 0) {
          throw new ConflictException({
            error: 'Stock Insuficiente',
            message: `No se pudo consumir stock suficiente para producto ${idProducto}`,
          });
        }

        const remainingStock = available - cantidad;
        const lowStockAlert = buildLowStockAlert(idProducto, remainingStock, nombreProducto);
        if (lowStockAlert) {
          lowStockAlerts.set(idProducto, lowStockAlert);
        }
      }

      await connection.commit();
      await this.cartService.clearCart(authUserId);
      const warnings = Array.from(lowStockAlerts.values());

      if (warnings.length > 0) {
        this.logger.log(
          `Se detecto stock bajo para ${warnings.length} producto(s) tras venta. Se intentara notificar por correo.`,
        );
        await this.notifyLowStockAdmins(warnings, 'registro de venta');
      }

      return {
        message: 'Venta registrada con exito',
        ticketId: String(idVenta),
        total: orderTotal,
        subtotal: Number(cartSummary.subtotal ?? 0),
        tax: Number(cartSummary.tax ?? 0),
        ...(warnings.length > 0 ? { warnings } : {}),
      };
    } catch (error) {
      await this.rollbackSafely(connection, 'createOrder', error);

      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }

      this.logger.error(
        `No se pudo procesar la venta: ${this.describeError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException({
        error: 'Error Interno del Servidor',
        message: 'Fallo al procesar la venta y actualizar el inventario.',
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  private async rollbackSafely(connection: PoolConnection | null, context: string, originalError: unknown) {
    if (!connection) {
      return;
    }

    try {
      await connection.rollback();
    } catch (rollbackError) {
      this.logger.warn(
        `No se pudo hacer rollback en ${context}. Error original: ${this.describeError(
          originalError,
        )}. Error de rollback: ${this.describeError(rollbackError)}`,
      );
    }
  }

  private describeError(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return 'Error desconocido';
    }
  }

  private async notifyLowStockAdmins(alerts: LowStockAlert[], source: string) {
    try {
      await this.emailService.sendLowStockAlertToAdmins(alerts, source);
    } catch (error) {
      this.logger.warn(`No se pudo enviar correo de stock bajo: ${this.describeError(error)}`);
    }
  }
}
