import 'package:flutter/material.dart';
import '../../domain/entities/product_entity.dart';
import '../controllers/product_controller.dart';
import '../widgets/product_form_modal.dart';

class ListaProductosPage extends StatefulWidget {
  final ProductController controller;
  final String token;
  const ListaProductosPage({super.key, required this.controller, required this.token});

  @override
  State<ListaProductosPage> createState() => _ListaProductosPageState();
}

class _ListaProductosPageState extends State<ListaProductosPage> {
  late final String _token;
  String _searchTerm = "";
  String _statusFilter = "todos";

  @override
  void initState() {
    super.initState();
    _token = widget.token;
    widget.controller.loadProducts(_token);
    widget.controller.addListener(_onControllerUpdate);
  }

  void _onControllerUpdate() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onControllerUpdate);
    super.dispose();
  }

  List<ProductEntity> get _filteredProducts {
    return widget.controller.products.where((p) {
      final matchesSearch =
          _searchTerm.isEmpty ||
          p.nombre.toLowerCase().contains(_searchTerm.toLowerCase()) ||
          p.id.toString().contains(_searchTerm);
      final matchesStatus =
          _statusFilter == "todos" ||
          p.estado.toLowerCase() == _statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    }).toList();
  }

  void _openForm({ProductEntity? producto}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => ProductFormModal(
        producto: producto,
        onSave: (fields, file) async {
          try {
            await widget.controller.saveProduct(
              token: _token,
              id: producto?.id,
              fields: fields,
              imageFile: file,
            );
            if (mounted) Navigator.pop(context);
          } catch (e) {
            if (mounted) {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Error al guardar producto: $e')),
              );
            }
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.controller;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Inventario Mercapleno'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              state.loadProducts(_token);
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    decoration: const InputDecoration(
                      hintText: 'Buscar por nombre o ID...',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onChanged: (v) => setState(() => _searchTerm = v),
                  ),
                ),
                DropdownButton<String>(
                  value: _statusFilter,
                  items: const [
                    DropdownMenuItem(value: "todos", child: Text("Todos")),
                    DropdownMenuItem(
                      value: "Disponible",
                      child: Text("Disponibles"),
                    ),
                    DropdownMenuItem(value: "Agotado", child: Text("Agotados")),
                  ],
                  onChanged: (v) => setState(() => _statusFilter = v!),
                ),
              ],
            ),
          ),
          Expanded(
            child: state.isLoading
                ? const Center(child: CircularProgressIndicator())
                : state.errorMessage.isNotEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.error_outline, size: 48, color: Colors.red),
                            const SizedBox(height: 16),
                            Text(
                              'Error al cargar productos',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 8),
                            Text(state.errorMessage, textAlign: TextAlign.center),
                            const SizedBox(height: 16),
                            ElevatedButton(
                              onPressed: () => state.loadProducts(_token),
                              child: const Text('Reintentar'),
                            ),
                          ],
                        ),
                      )
                    : _filteredProducts.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.shopping_basket_outlined, size: 48, color: Colors.grey),
                                const SizedBox(height: 16),
                                Text(
                                  'No hay productos',
                                  style: Theme.of(context).textTheme.titleMedium,
                                ),
                                const SizedBox(height: 8),
                                const Text('Crea tu primer producto para comenzar'),
                              ],
                            ),
                          )
                        : ListView.builder(
                            itemCount: _filteredProducts.length,
                            itemBuilder: (context, idx) {
                              final p = _filteredProducts[idx];
                              return ListTile(
                                leading: p.imagen.isNotEmpty
                                    ? Image.network(
                                        p.imagen,
                                        width: 50,
                                        errorBuilder: (context, error, stackTrace) =>
                                            const Icon(Icons.broken_image),
                                      )
                                    : const Icon(Icons.shopping_basket),
                                title: Text(p.nombre),
                                subtitle: Text('\$${p.precio} - ${p.estado}'),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.edit, color: Colors.blue),
                                      onPressed: () => _openForm(producto: p),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete, color: Colors.red),
                                      onPressed: () async {
                                        final confirm = await showDialog<bool>(
                                          context: context,
                                          builder: (context) => AlertDialog(
                                            title: const Text('Eliminar Producto'),
                                            content: Text('¿Estás seguro de que deseas eliminar "${p.nombre}"? Esta acción no se puede deshacer.'),
                                            actions: [
                                              TextButton(
                                                onPressed: () => Navigator.pop(context, false),
                                                child: const Text('Cancelar'),
                                              ),
                                              TextButton(
                                                onPressed: () => Navigator.pop(context, true),
                                                style: TextButton.styleFrom(foregroundColor: Colors.red),
                                                child: const Text('Eliminar'),
                                              ),
                                            ],
                                          ),
                                        );

                                        if (confirm == true) {
                                          try {
                                            await state.deleteProduct(p.id, _token);
                                            if (mounted) {
                                              ScaffoldMessenger.of(context).showSnackBar(
                                                SnackBar(
                                                  content: Text('Producto "${p.nombre}" eliminado correctamente.'),
                                                  backgroundColor: Colors.green,
                                                ),
                                              );
                                            }
                                          } catch (e) {
                                            if (mounted) {
                                              String errorMsg = e.toString();
                                              if (errorMsg.startsWith('Exception: ')) {
                                                errorMsg = errorMsg.substring(11);
                                              }

                                              final isForeignKeyError = errorMsg.contains('asociado a ventas') || 
                                                  errorMsg.contains('clave foránea') || 
                                                  errorMsg.contains('Foreign key');

                                              if (isForeignKeyError) {
                                                final deactivate = await showDialog<bool>(
                                                  context: context,
                                                  builder: (context) => AlertDialog(
                                                    title: const Text('Inhabilitar Producto'),
                                                    content: const Text(
                                                      'Este producto tiene ventas asociadas y no se puede borrar de forma permanente.\n\n'
                                                      '¿Deseas inhabilitarlo cambiando su estado a "Agotado"?'
                                                    ),
                                                    actions: [
                                                      TextButton(
                                                        onPressed: () => Navigator.pop(context, false),
                                                        child: const Text('Cancelar'),
                                                      ),
                                                      TextButton(
                                                        onPressed: () => Navigator.pop(context, true),
                                                        style: TextButton.styleFrom(foregroundColor: Colors.orange),
                                                        child: const Text('Inhabilitar'),
                                                      ),
                                                    ],
                                                  ),
                                                );

                                                if (deactivate == true) {
                                                  try {
                                                    await state.saveProduct(
                                                      token: _token,
                                                      id: p.id,
                                                      fields: {
                                                        'nombre': p.nombre,
                                                        'precio': p.precio.toString(),
                                                        'estado': 'Agotado',
                                                        'descripcion': p.descripcion ?? '',
                                                        'id_categoria': p.idCategoria.toString(),
                                                        'id_proveedor': p.idProveedor.toString(),
                                                      },
                                                    );
                                                    if (mounted) {
                                                      ScaffoldMessenger.of(context).showSnackBar(
                                                        const SnackBar(
                                                          content: Text('Producto inhabilitado correctamente.'),
                                                          backgroundColor: Colors.orange,
                                                        ),
                                                      );
                                                    }
                                                  } catch (saveError) {
                                                    if (mounted) {
                                                      String saveErrMsg = saveError.toString();
                                                      if (saveErrMsg.startsWith('Exception: ')) {
                                                        saveErrMsg = saveErrMsg.substring(11);
                                                      }
                                                      ScaffoldMessenger.of(context).showSnackBar(
                                                        SnackBar(
                                                          content: Text('Error al inhabilitar producto: $saveErrMsg'),
                                                          backgroundColor: Colors.red,
                                                        ),
                                                      );
                                                    }
                                                  }
                                                }
                                              } else {
                                                ScaffoldMessenger.of(context).showSnackBar(
                                                  SnackBar(
                                                    content: Text(errorMsg),
                                                    backgroundColor: Colors.red,
                                                    duration: const Duration(seconds: 6),
                                                  ),
                                                );
                                              }
                                            }
                                          }
                                        }
                                      },
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openForm(),
        child: const Icon(Icons.add),
      ),
    );
  }
}
