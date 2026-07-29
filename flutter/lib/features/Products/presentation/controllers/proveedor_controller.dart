import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../../domain/entities/proveedor_entity.dart';
import '../../data/datasources/proveedor_remote_datasource.dart';

enum ProveedorEstadoCarga { inicial, cargando, exito, error }

/// Controller (ChangeNotifier) para la gestión de proveedores.
class ProveedorController extends ChangeNotifier {
  final ProveedorRemoteDataSource _dataSource;

  ProveedorController({ProveedorRemoteDataSource? dataSource})
      : _dataSource =
            dataSource ?? ProveedorRemoteDataSource(http.Client());

  // ─── Estado ────────────────────────────────────────────────────────────────
  List<ProveedorEntity> proveedores = [];
  ProveedorEstadoCarga estadoCarga = ProveedorEstadoCarga.inicial;
  String mensajeError = '';
  bool operando = false; // true durante crear/actualizar/eliminar

  bool get cargando => estadoCarga == ProveedorEstadoCarga.cargando;

  // ─── Cargar lista ──────────────────────────────────────────────────────────
  Future<void> cargarProveedores({String? busqueda}) async {
    estadoCarga = ProveedorEstadoCarga.cargando;
    mensajeError = '';
    notifyListeners();

    try {
      proveedores = await _dataSource.fetchProveedores(search: busqueda);
      estadoCarga = ProveedorEstadoCarga.exito;
    } catch (e) {
      mensajeError = _limpiar(e.toString());
      estadoCarga = ProveedorEstadoCarga.error;
    } finally {
      notifyListeners();
    }
  }

  // ─── Crear ─────────────────────────────────────────────────────────────────
  Future<ProveedorEntity> crearProveedor({
    required String token,
    required String nombre,
    required String apellido,
    String? telefono,
  }) async {
    operando = true;
    notifyListeners();

    try {
      final creado = await _dataSource.crearProveedor(
        token: token,
        nombre: nombre,
        apellido: apellido,
        telefono: telefono,
      );
      await cargarProveedores();
      return creado;
    } catch (e) {
      throw Exception(_limpiar(e.toString()));
    } finally {
      operando = false;
      notifyListeners();
    }
  }

  // ─── Actualizar ────────────────────────────────────────────────────────────
  Future<void> actualizarProveedor({
    required String token,
    required int id,
    String? nombre,
    String? apellido,
    String? telefono,
  }) async {
    operando = true;
    notifyListeners();

    try {
      await _dataSource.actualizarProveedor(
        token: token,
        id: id,
        nombre: nombre,
        apellido: apellido,
        telefono: telefono,
      );
      await cargarProveedores();
    } catch (e) {
      throw Exception(_limpiar(e.toString()));
    } finally {
      operando = false;
      notifyListeners();
    }
  }

  // ─── Eliminar ──────────────────────────────────────────────────────────────
  Future<void> eliminarProveedor({
    required String token,
    required int id,
  }) async {
    operando = true;
    notifyListeners();

    try {
      await _dataSource.eliminarProveedor(token: token, id: id);
      proveedores.removeWhere((p) => p.id == id);
    } catch (e) {
      throw Exception(_limpiar(e.toString()));
    } finally {
      operando = false;
      notifyListeners();
    }
  }

  String _limpiar(String raw) {
    if (raw.startsWith('Exception: ')) return raw.substring(11);
    return raw;
  }
}
