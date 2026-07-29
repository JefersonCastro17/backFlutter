import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';

@Injectable()
export class ProveedoresService {
  constructor(private readonly prisma: PrismaService) {}

  private parseId(id: string): number {
    const parsed = Number(id);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ success: false, message: 'ID de proveedor inválido' });
    }
    return parsed;
  }

  private handlePrismaError(error: unknown, fallback: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        throw new ConflictException({
          success: false,
          message: 'No se puede realizar la operación porque el proveedor tiene productos asociados',
        });
      }
    }
    throw new InternalServerErrorException({ success: false, message: fallback });
  }

  async findAll(search?: string, soloActivos = true) {
    const where: Prisma.proveedorWhereInput = {};

    // Por defecto solo devuelve proveedores activos
    if (soloActivos) {
      where.activo = true;
    }

    if (search) {
      const q = search.trim();
      where.OR = [
        { nombre: { contains: q } },
        { apellido: { contains: q } },
        { telefono: { contains: q } },
      ];
    }

    const proveedores = await this.prisma.proveedor.findMany({
      where,
      select: {
        id_proveedor: true,
        nombre: true,
        apellido: true,
        telefono: true,
        activo: true,
        _count: { select: { productos: true } },
      },
      orderBy: { nombre: 'asc' },
    });

    return {
      success: true,
      proveedores: proveedores.map((p) => ({
        id: p.id_proveedor,
        nombre: p.nombre,
        apellido: p.apellido,
        telefono: p.telefono,
        activo: p.activo,
        total_productos: p._count.productos,
      })),
    };
  }

  async findAllAdmin(search?: string) {
    // Admin ve todos (activos e inactivos) para gestionar
    return this.findAll(search, false);
  }

  async findOne(id: string) {
    const proveedorId = this.parseId(id);

    const proveedor = await this.prisma.proveedor.findUnique({
      where: { id_proveedor: proveedorId },
      select: {
        id_proveedor: true,
        nombre: true,
        apellido: true,
        telefono: true,
        activo: true,
        _count: { select: { productos: true } },
      },
    });

    if (!proveedor) {
      throw new NotFoundException({ success: false, message: 'Proveedor no encontrado' });
    }

    return {
      success: true,
      proveedor: {
        id: proveedor.id_proveedor,
        nombre: proveedor.nombre,
        apellido: proveedor.apellido,
        telefono: proveedor.telefono,
        activo: proveedor.activo,
        total_productos: proveedor._count.productos,
      },
    };
  }

  async create(dto: CreateProveedorDto) {
    try {
      const proveedor = await this.prisma.proveedor.create({
        data: {
          nombre: dto.nombre.trim(),
          apellido: dto.apellido.trim(),
          telefono: dto.telefono?.trim() ?? null,
          activo: true,
        },
      });

      return {
        success: true,
        message: 'Proveedor creado correctamente',
        proveedor: {
          id: proveedor.id_proveedor,
          nombre: proveedor.nombre,
          apellido: proveedor.apellido,
          telefono: proveedor.telefono,
          activo: proveedor.activo,
        },
      };
    } catch (error) {
      this.handlePrismaError(error, 'Error al crear el proveedor');
    }
  }

  async update(id: string, dto: UpdateProveedorDto) {
    const proveedorId = this.parseId(id);

    const existing = await this.prisma.proveedor.findUnique({
      where: { id_proveedor: proveedorId },
      select: { id_proveedor: true },
    });

    if (!existing) {
      throw new NotFoundException({ success: false, message: 'Proveedor no encontrado' });
    }

    if (Object.keys(dto).length === 0) {
      return { success: true, message: 'Sin cambios para actualizar' };
    }

    const data: Prisma.proveedorUpdateInput = {
      ...(dto.nombre !== undefined ? { nombre: dto.nombre.trim() } : {}),
      ...(dto.apellido !== undefined ? { apellido: dto.apellido.trim() } : {}),
      ...(dto.telefono !== undefined ? { telefono: dto.telefono.trim() || null } : {}),
    };

    try {
      await this.prisma.proveedor.update({
        where: { id_proveedor: proveedorId },
        data,
      });

      return { success: true, message: 'Proveedor actualizado correctamente' };
    } catch (error) {
      this.handlePrismaError(error, 'Error al actualizar el proveedor');
    }
  }

  /** Deshabilita un proveedor (soft-delete). No importa si tiene productos. */
  async deshabilitar(id: string) {
    const proveedorId = this.parseId(id);

    const existing = await this.prisma.proveedor.findUnique({
      where: { id_proveedor: proveedorId },
      select: { id_proveedor: true, activo: true },
    });

    if (!existing) {
      throw new NotFoundException({ success: false, message: 'Proveedor no encontrado' });
    }

    if (!existing.activo) {
      return { success: true, message: 'El proveedor ya estaba deshabilitado' };
    }

    await this.prisma.proveedor.update({
      where: { id_proveedor: proveedorId },
      data: { activo: false },
    });

    return { success: true, message: 'Proveedor deshabilitado correctamente' };
  }

  /** Reactiva un proveedor deshabilitado. */
  async habilitar(id: string) {
    const proveedorId = this.parseId(id);

    const existing = await this.prisma.proveedor.findUnique({
      where: { id_proveedor: proveedorId },
      select: { id_proveedor: true, activo: true },
    });

    if (!existing) {
      throw new NotFoundException({ success: false, message: 'Proveedor no encontrado' });
    }

    await this.prisma.proveedor.update({
      where: { id_proveedor: proveedorId },
      data: { activo: true },
    });

    return { success: true, message: 'Proveedor habilitado correctamente' };
  }

  async remove(id: string) {
    const proveedorId = this.parseId(id);

    const existing = await this.prisma.proveedor.findUnique({
      where: { id_proveedor: proveedorId },
      select: { id_proveedor: true, _count: { select: { productos: true } } },
    });

    if (!existing) {
      throw new NotFoundException({ success: false, message: 'Proveedor no encontrado' });
    }

    if (existing._count.productos > 0) {
      throw new ConflictException({
        success: false,
        message: `No se puede eliminar el proveedor porque tiene ${existing._count.productos} producto(s) asociado(s). Usa "Deshabilitar" en su lugar.`,
      });
    }

    try {
      await this.prisma.proveedor.delete({ where: { id_proveedor: proveedorId } });
      return { success: true, message: 'Proveedor eliminado correctamente' };
    } catch (error) {
      this.handlePrismaError(error, 'Error al eliminar el proveedor');
    }
  }
}
