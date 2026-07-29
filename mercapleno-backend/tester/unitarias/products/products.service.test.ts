import { ProductsService } from '../../../src/products/products.service';

describe('ProductsService proveedores CRUD', () => {
  it('debe listar proveedores desde prisma', async () => {
    const prisma = {
      proveedor: {
        findMany: jest.fn().mockResolvedValue([
          { id_proveedor: 1, nombre: 'Juan', apellido: 'Pérez', telefono: '123456' },
        ]),
      },
    };

    const service = new ProductsService(prisma as any);
    const result = await service.findProveedores();

    expect(prisma.proveedor.findMany).toHaveBeenCalled();
    expect(result).toEqual([
      { id: 1, nombre: 'Juan', apellido: 'Pérez', telefono: '123456' },
    ]);
  });

  it('debe crear proveedores a través de prisma', async () => {
    const created = { id_proveedor: 2, nombre: 'Ana', apellido: 'García', telefono: '654321' };
    const prisma = {
      proveedor: {
        create: jest.fn().mockResolvedValue(created),
      },
    };

    const service = new ProductsService(prisma as any);
    const result = await service.createProveedor({ nombre: 'Ana', apellido: 'García', telefono: '654321' });

    expect(prisma.proveedor.create).toHaveBeenCalledWith({
      data: {
        nombre: 'Ana',
        apellido: 'García',
        telefono: '654321',
      },
    });
    expect(result).toEqual({ message: 'Proveedor creado correctamente', id: 2 });
  });
});
