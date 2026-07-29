/// Entidad de dominio que representa un Proveedor del sistema.
class ProveedorEntity {
  final int id;
  final String nombre;
  final String apellido;
  final String? telefono;
  final int totalProductos;

  const ProveedorEntity({
    required this.id,
    required this.nombre,
    required this.apellido,
    this.telefono,
    this.totalProductos = 0,
  });

  /// Nombre completo del proveedor.
  String get nombreCompleto => '$nombre $apellido'.trim();

  factory ProveedorEntity.fromJson(Map<String, dynamic> json) {
    return ProveedorEntity(
      id: json['id'] as int? ?? 0,
      nombre: json['nombre'] as String? ?? '',
      apellido: json['apellido'] as String? ?? '',
      telefono: json['telefono'] as String?,
      totalProductos: json['total_productos'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'nombre': nombre,
        'apellido': apellido,
        if (telefono != null) 'telefono': telefono,
        'total_productos': totalProductos,
      };
}
