import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../domain/entities/proveedor_entity.dart';
import '../../../../core/config/app_config.dart';

/// DataSource remoto para el CRUD de proveedores.
/// Conecta con los endpoints /api/proveedores del backend NestJS.
class ProveedorRemoteDataSource {
  final http.Client client;

  ProveedorRemoteDataSource(this.client);

  String get _baseUrl => '${AppConfig.apiBaseUrl}/api/proveedores';

  Map<String, String> _authHeaders(String token) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer $token',
    };
    if (AppConfig.apiKey.isNotEmpty) {
      headers['x-api-key'] = AppConfig.apiKey;
    }
    return headers;
  }

  /// Obtiene la lista de proveedores. No requiere token (público).
  Future<List<ProveedorEntity>> fetchProveedores({String? search}) async {
    final uri = Uri.parse(_baseUrl).replace(
      queryParameters:
          search != null && search.isNotEmpty ? {'search': search} : null,
    );
    final response =
        await client.get(uri, headers: {'Accept': 'application/json'});

    if (response.statusCode == 200) {
      final body = json.decode(response.body) as Map<String, dynamic>;
      final list = body['proveedores'] as List<dynamic>? ?? [];
      return list
          .map((e) => ProveedorEntity.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    throw Exception('Error al obtener proveedores (${response.statusCode})');
  }

  /// Obtiene el detalle de un proveedor por ID.
  Future<ProveedorEntity> fetchProveedorById(int id) async {
    final response = await client.get(
      Uri.parse('$_baseUrl/$id'),
      headers: {'Accept': 'application/json'},
    );

    if (response.statusCode == 200) {
      final body = json.decode(response.body) as Map<String, dynamic>;
      return ProveedorEntity.fromJson(body['proveedor'] as Map<String, dynamic>);
    }
    throw Exception('Proveedor no encontrado (${response.statusCode})');
  }

  /// Crea un proveedor. Requiere token de Admin.
  Future<ProveedorEntity> crearProveedor({
    required String token,
    required String nombre,
    required String apellido,
    String? telefono,
  }) async {
    final body = <String, dynamic>{
      'nombre': nombre,
      'apellido': apellido,
      if (telefono != null && telefono.isNotEmpty) 'telefono': telefono,
    };

    final response = await client.post(
      Uri.parse(_baseUrl),
      headers: _authHeaders(token),
      body: json.encode(body),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final resp = json.decode(response.body) as Map<String, dynamic>;
      return ProveedorEntity.fromJson(resp['proveedor'] as Map<String, dynamic>);
    }
    _throwFromResponse(response);
  }

  /// Actualiza un proveedor. Requiere token de Admin.
  Future<void> actualizarProveedor({
    required String token,
    required int id,
    String? nombre,
    String? apellido,
    String? telefono,
  }) async {
    final body = <String, dynamic>{
      if (nombre != null) 'nombre': nombre,
      if (apellido != null) 'apellido': apellido,
      if (telefono != null) 'telefono': telefono,
    };

    final response = await client.patch(
      Uri.parse('$_baseUrl/$id'),
      headers: _authHeaders(token),
      body: json.encode(body),
    );

    if (response.statusCode == 200) return;
    _throwFromResponse(response);
  }

  /// Elimina un proveedor. Requiere token de Admin.
  Future<void> eliminarProveedor({
    required String token,
    required int id,
  }) async {
    final response = await client.delete(
      Uri.parse('$_baseUrl/$id'),
      headers: _authHeaders(token),
    );

    if (response.statusCode == 200 || response.statusCode == 204) return;
    _throwFromResponse(response);
  }

  Never _throwFromResponse(http.Response response) {
    String message = 'Error del servidor (${response.statusCode})';
    try {
      final decoded = json.decode(response.body);
      if (decoded is Map) {
        message = decoded['message']?.toString() ?? message;
      }
    } catch (_) {}
    throw Exception(message);
  }
}
