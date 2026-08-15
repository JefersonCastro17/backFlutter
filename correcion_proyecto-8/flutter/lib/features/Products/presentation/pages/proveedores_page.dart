import 'package:flutter/material.dart';
import '../../domain/entities/proveedor_entity.dart';
import '../controllers/proveedor_controller.dart';

/// Página CRUD completa de Proveedores. Solo accesible para el Administrador.
class ProveedoresPage extends StatefulWidget {
  final ProveedorController controller;
  final String token;

  const ProveedoresPage({
    super.key,
    required this.controller,
    required this.token,
  });

  @override
  State<ProveedoresPage> createState() => _ProveedoresPageState();
}

class _ProveedoresPageState extends State<ProveedoresPage> {
  final _busquedaCtrl = TextEditingController();
  String _terminoBusqueda = '';

  @override
  void initState() {
    super.initState();
    widget.controller.cargarProveedores();
    widget.controller.addListener(_alActualizar);
  }

  void _alActualizar() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    widget.controller.removeListener(_alActualizar);
    _busquedaCtrl.dispose();
    super.dispose();
  }

  // ─── Snackbar ──────────────────────────────────────────────────────────────

  void _mostrarSnack(String msg, {bool esError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: esError ? Colors.red : Colors.green,
    ));
  }

  // ─── Abrir formulario ──────────────────────────────────────────────────────

  void _abrirFormulario({ProveedorEntity? proveedor}) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => _DialogoFormProveedor(
        proveedor: proveedor,
        onGuardar: (nombre, apellido, telefono) async {
          Navigator.of(context).pop();
          try {
            if (proveedor == null) {
              await widget.controller.crearProveedor(
                token: widget.token,
                nombre: nombre,
                apellido: apellido,
                telefono: telefono,
              );
              _mostrarSnack('Proveedor "$nombre $apellido" creado correctamente');
            } else {
              await widget.controller.actualizarProveedor(
                token: widget.token,
                id: proveedor.id,
                nombre: nombre,
                apellido: apellido,
                telefono: telefono,
              );
              _mostrarSnack('Proveedor actualizado correctamente');
            }
          } catch (e) {
            _mostrarSnack(e.toString(), esError: true);
          }
        },
      ),
    );
  }

  // ─── Confirmar eliminación ─────────────────────────────────────────────────

  Future<void> _confirmarEliminar(ProveedorEntity proveedor) async {
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Eliminar Proveedor'),
        content: Text(
          '¿Seguro que deseas eliminar a "${proveedor.nombreCompleto}"?\n\n'
          'Solo es posible si no tiene productos asociados.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );

    if (confirmar != true) return;

    try {
      await widget.controller.eliminarProveedor(
        token: widget.token,
        id: proveedor.id,
      );
      _mostrarSnack('Proveedor eliminado correctamente');
    } catch (e) {
      _mostrarSnack(e.toString(), esError: true);
    }
  }

  // ─── Filtro local ──────────────────────────────────────────────────────────

  List<ProveedorEntity> get _filtrados {
    final q = _terminoBusqueda.trim().toLowerCase();
    if (q.isEmpty) return widget.controller.proveedores;
    return widget.controller.proveedores.where((p) {
      return p.nombre.toLowerCase().contains(q) ||
          p.apellido.toLowerCase().contains(q) ||
          (p.telefono?.toLowerCase().contains(q) ?? false) ||
          p.id.toString().contains(q);
    }).toList();
  }

  // ─── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final ctrl = widget.controller;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Gestión de Proveedores'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Recargar',
            onPressed: () => ctrl.cargarProveedores(
              busqueda: _terminoBusqueda.isNotEmpty ? _terminoBusqueda : null,
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _abrirFormulario(),
        icon: const Icon(Icons.person_add),
        label: const Text('Nuevo Proveedor'),
      ),
      body: Column(
        children: [
          // ── Buscador ───────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              controller: _busquedaCtrl,
              decoration: InputDecoration(
                hintText: 'Buscar por nombre, apellido o teléfono…',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _terminoBusqueda.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () {
                          _busquedaCtrl.clear();
                          setState(() => _terminoBusqueda = '');
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
              ),
              onChanged: (v) => setState(() => _terminoBusqueda = v),
            ),
          ),

          // ── Contador ───────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
            child: Row(
              children: [
                Text(
                  '${_filtrados.length} proveedor(es)',
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: Colors.grey.shade600),
                ),
              ],
            ),
          ),

          // ── Contenido ──────────────────────────────────────────────────────
          Expanded(
            child: ctrl.cargando
                ? const Center(child: CircularProgressIndicator())
                : ctrl.mensajeError.isNotEmpty
                    ? _construirError(ctrl)
                    : _filtrados.isEmpty
                        ? _construirVacio()
                        : _construirLista(),
          ),
        ],
      ),
    );
  }

  Widget _construirError(ProveedorController ctrl) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 52, color: Colors.red),
            const SizedBox(height: 12),
            Text('Error al cargar proveedores',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(ctrl.mensajeError, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () => ctrl.cargarProveedores(),
              icon: const Icon(Icons.refresh),
              label: const Text('Reintentar'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _construirVacio() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.people_outline, size: 64, color: Colors.grey.shade400),
          const SizedBox(height: 16),
          Text(
            _terminoBusqueda.isEmpty
                ? 'No hay proveedores registrados'
                : 'Sin resultados para "$_terminoBusqueda"',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (_terminoBusqueda.isEmpty) ...[
            const SizedBox(height: 8),
            const Text('Toca + para agregar el primer proveedor'),
          ],
        ],
      ),
    );
  }

  Widget _construirLista() {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 80),
      itemCount: _filtrados.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (ctx, idx) => _TarjetaProveedor(
        proveedor: _filtrados[idx],
        onEditar: () => _abrirFormulario(proveedor: _filtrados[idx]),
        onEliminar: () => _confirmarEliminar(_filtrados[idx]),
      ),
    );
  }
}

// ─── TARJETA DE PROVEEDOR ────────────────────────────────────────────────────

class _TarjetaProveedor extends StatelessWidget {
  final ProveedorEntity proveedor;
  final VoidCallback onEditar;
  final VoidCallback onEliminar;

  const _TarjetaProveedor({
    required this.proveedor,
    required this.onEditar,
    required this.onEliminar,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Avatar
            CircleAvatar(
              radius: 26,
              backgroundColor: Colors.indigo.shade100,
              child: Text(
                proveedor.nombre.isNotEmpty
                    ? proveedor.nombre[0].toUpperCase()
                    : '?',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Colors.indigo.shade700,
                ),
              ),
            ),
            const SizedBox(width: 14),

            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    proveedor.nombreCompleto,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 3),
                  if (proveedor.telefono != null &&
                      proveedor.telefono!.isNotEmpty)
                    Row(
                      children: [
                        Icon(Icons.phone,
                            size: 13, color: Colors.grey.shade500),
                        const SizedBox(width: 4),
                        Text(
                          proveedor.telefono!,
                          style: TextStyle(
                              color: Colors.grey.shade600, fontSize: 13),
                        ),
                      ],
                    ),
                  const SizedBox(height: 4),
                  _chip(
                    label: '${proveedor.totalProductos} producto(s)',
                    color: proveedor.totalProductos > 0
                        ? Colors.green
                        : Colors.grey,
                  ),
                ],
              ),
            ),

            // Acciones
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.edit_outlined),
                  color: Colors.blue.shade700,
                  tooltip: 'Editar',
                  onPressed: onEditar,
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline),
                  color: proveedor.totalProductos > 0
                      ? Colors.grey.shade400
                      : Colors.red.shade400,
                  tooltip: proveedor.totalProductos > 0
                      ? 'Tiene productos asociados'
                      : 'Eliminar',
                  onPressed:
                      proveedor.totalProductos > 0 ? null : onEliminar,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _chip({required String label, required Color color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
            color: color, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}

// ─── DIÁLOGO FORMULARIO ───────────────────────────────────────────────────────

class _DialogoFormProveedor extends StatefulWidget {
  final ProveedorEntity? proveedor;
  final Future<void> Function(
      String nombre, String apellido, String? telefono) onGuardar;

  const _DialogoFormProveedor({this.proveedor, required this.onGuardar});

  @override
  State<_DialogoFormProveedor> createState() => _DialogoFormProveedorState();
}

class _DialogoFormProveedorState extends State<_DialogoFormProveedor> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nombreCtrl;
  late final TextEditingController _apellidoCtrl;
  late final TextEditingController _telCtrl;
  bool _guardando = false;

  @override
  void initState() {
    super.initState();
    _nombreCtrl =
        TextEditingController(text: widget.proveedor?.nombre ?? '');
    _apellidoCtrl =
        TextEditingController(text: widget.proveedor?.apellido ?? '');
    _telCtrl =
        TextEditingController(text: widget.proveedor?.telefono ?? '');
  }

  @override
  void dispose() {
    _nombreCtrl.dispose();
    _apellidoCtrl.dispose();
    _telCtrl.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _guardando = true);
    try {
      await widget.onGuardar(
        _nombreCtrl.text.trim(),
        _apellidoCtrl.text.trim(),
        _telCtrl.text.trim().isNotEmpty ? _telCtrl.text.trim() : null,
      );
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final esEdicion = widget.proveedor != null;

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(esEdicion ? 'Editar Proveedor' : 'Nuevo Proveedor'),
      content: SizedBox(
        width: double.maxFinite,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Nombre
              TextFormField(
                controller: _nombreCtrl,
                decoration: const InputDecoration(
                  labelText: 'Nombre *',
                  prefixIcon: Icon(Icons.person_outline),
                ),
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                validator: (v) {
                  if (v == null || v.trim().isEmpty) {
                    return 'El nombre es obligatorio';
                  }
                  if (!RegExp(r'^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$')
                      .hasMatch(v.trim())) {
                    return 'Solo letras y espacios';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),

              // Apellido
              TextFormField(
                controller: _apellidoCtrl,
                decoration: const InputDecoration(
                  labelText: 'Apellido *',
                  prefixIcon: Icon(Icons.person_outline),
                ),
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                validator: (v) {
                  if (v == null || v.trim().isEmpty) {
                    return 'El apellido es obligatorio';
                  }
                  if (!RegExp(r'^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$')
                      .hasMatch(v.trim())) {
                    return 'Solo letras y espacios';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),

              // Teléfono
              TextFormField(
                controller: _telCtrl,
                decoration: const InputDecoration(
                  labelText: 'Teléfono (opcional)',
                  prefixIcon: Icon(Icons.phone_outlined),
                  hintText: 'Ej: 3001234567',
                ),
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => _guardar(),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return null;
                  if (!RegExp(r'^[\d\s\+\-\(\)]+$').hasMatch(v.trim())) {
                    return 'Teléfono inválido';
                  }
                  return null;
                },
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _guardando ? null : () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: _guardando ? null : _guardar,
          child: _guardando
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                )
              : Text(esEdicion ? 'Actualizar' : 'Crear'),
        ),
      ],
    );
  }
}
