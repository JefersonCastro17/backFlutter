import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { MysqlService } from '../common/database/mysql.service';

describe('ReportsService', () => {
  let service: ReportsService;
  const mockMysqlService = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: MysqlService, useValue: mockMysqlService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getVentasMes', () => {
    it('returns rows without filters', async () => {
      const rows = [{ mes: '2026-01', total: 100 }];
      mockMysqlService.query.mockResolvedValueOnce([rows]);

      const result = await service.getVentasMes();

      expect(mockMysqlService.query).toHaveBeenCalled();
      expect(result).toEqual(rows);
    });

    it('accepts inicio and fin params', async () => {
      const rows = [{ mes: '2026-02', total: 200 }];
      mockMysqlService.query.mockResolvedValueOnce([rows]);

      const result = await service.getVentasMes('2026-01', '2026-12');

      expect(mockMysqlService.query).toHaveBeenCalled();
      expect(result).toEqual(rows);
    });
  });

  describe('getTopProductos', () => {
    it('returns top products', async () => {
      const rows = [{ nombre: 'Producto A', total_vendido: 5, total_facturado: 500 }];
      mockMysqlService.query.mockResolvedValueOnce([rows]);

      const result = await service.getTopProductos();

      expect(mockMysqlService.query).toHaveBeenCalled();
      expect(result).toEqual(rows);
    });
  });

  describe('getResumen & getResumenMes', () => {
    it('returns resumen object', async () => {
      const resumenRow = { total_ventas: 3, dinero_total: '1000.00', promedio: '333.33' };
      mockMysqlService.query.mockResolvedValueOnce([[resumenRow]]);

      const result = await service.getResumen();

      expect(mockMysqlService.query).toHaveBeenCalled();
      expect(result).toEqual(resumenRow);
    });

    it('returns resumen mensual rows', async () => {
      const rows = [{ mes: '2026-01', cantidad_ventas: 2, total_mes: '700.00' }];
      mockMysqlService.query.mockResolvedValueOnce([rows]);

      const result = await service.getResumenMes();

      expect(mockMysqlService.query).toHaveBeenCalled();
      expect(result).toEqual(rows);
    });
  });

  describe('buildResumenPdf', () => {
    it('builds a PDF buffer', async () => {
      const resumenRow = { total_ventas: 2, dinero_total: '700.00', promedio: '350.00' };
      const topProductos = [{ nombre: 'Prod A', total_vendido: 2, total_facturado: 700 }];
      const resumenMes = [{ mes: '2026-01', cantidad_ventas: 2, total_mes: '700.00' }];

      // Sequence of calls inside buildResumenPdf:
      // - getResumen() -> query returns [[resumenRow]]
      // - query for topProductos -> returns [topProductos]
      // - query for resumenMes -> returns [resumenMes]
      mockMysqlService.query
        .mockResolvedValueOnce([[resumenRow]])
        .mockResolvedValueOnce([topProductos])
        .mockResolvedValueOnce([resumenMes]);

      const buffer = await service.buildResumenPdf();

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      expect(mockMysqlService.query).toHaveBeenCalled();
    }, 10000);
  });
});
