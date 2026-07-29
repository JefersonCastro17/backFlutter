import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../domain/entities/product_entity.dart';
import '../../domain/entities/proveedor_entity.dart';

/// Modal de formulario para crear o editar un producto.
/// Recibe [suppliers] y [categories] dinámicamente desde el backend
/// en lugar de usar catálogos estáticos.
class ProductFormModal extends StatefulWidget {
  final ProductEntity? producto;
  final List<ProveedorEntity> suppliers;
  final Map<int, String> categories;
  final Function(Map<String, String> fields, File? imageFile) onSave;

  const ProductFormModal({
    super.key,
    this.producto,
    required this.suppliers,
    required this.categories,
    required this.onSave,
  });

  @override
  State<ProductFormModal> createState() => _ProductFormModalState();
}

class _ProductFormModalState extends State<ProductFormModal> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nombreCtrl;
  late TextEditingController _precioCtrl;
  late TextEditingController _descCtrl;
  String _estado = 'Disponible';
  int? _idCategoria;
  int? _idProveedor;
  File? _selectedImage;
  String? _imageError;

  @override
  void initState() {
    super.initState();
    _nombreCtrl = TextEditingController(text: widget.producto?.nombre ?? '');
    _precioCtrl = TextEditingController(
      text: widget.producto?.precio.toString() ?? '',
    );
    _descCtrl = TextEditingController(text: widget.producto?.descripcion ?? '');
    _estado = widget.producto?.estado ?? 'Disponible';

    // Inicializar con el ID del producto si existe y está en el catálogo
    final catId = widget.producto?.idCategoria;
    _idCategoria = (catId != null && widget.categories.containsKey(catId))
        ? catId
        : (widget.categories.isNotEmpty ? widget.categories.keys.first : null);

    final supId = widget.producto?.idProveedor;
    _idProveedor = (supId != null && widget.suppliers.any((s) => s.id == supId))
        ? supId
        : (widget.suppliers.isNotEmpty ? widget.suppliers.first.id : null);
  }

  @override
  void dispose() {
    _nombreCtrl.dispose();
    _precioCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final pickedFile = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
    );
    if (pickedFile != null) {
      setState(() {
        _selectedImage = File(pickedFile.path);
        _imageError = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final imageUrl =
        widget.producto?.imagen.isNotEmpty == true ? widget.producto!.imagen : null;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 16,
        right: 16,
        top: 16,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Header ─────────────────────────────────────────────────────
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    widget.producto == null ? 'Nuevo Producto' : 'Editar Producto',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // ── Nombre ─────────────────────────────────────────────────────
              TextFormField(
                controller: _nombreCtrl,
                decoration: const InputDecoration(
                  labelText: 'Nombre',
                  hintText: 'Ingrese el nombre del producto',
                ),
                validator: (v) => v!.trim().isEmpty ? 'Obligatorio' : null,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),

              // ── Precio ─────────────────────────────────────────────────────
              TextFormField(
                controller: _precioCtrl,
                decoration: const InputDecoration(
                  labelText: 'Precio',
                  hintText: 'Ingrese el precio del producto',
                ),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                textInputAction: TextInputAction.next,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Obligatorio';
                  }
                  if (double.tryParse(value.replaceAll(',', '.')) == null) {
                    return 'Precio inválido';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),

              // ── Categoría (dinámica) ────────────────────────────────────────
              if (widget.categories.isEmpty)
                const _EmptyDropdownHint(label: 'Categoría', icon: Icons.category_outlined)
              else
                DropdownButtonFormField<int>(
                  value: _idCategoria,
                  decoration: const InputDecoration(labelText: 'Categoría'),
                  isExpanded: true,
                  items: widget.categories.entries
                      .map((e) => DropdownMenuItem<int>(
                            value: e.key,
                            child: Text(e.value),
                          ))
                      .toList(),
                  validator: (v) =>
                      v == null ? 'Seleccione una categoría' : null,
                  onChanged: (v) => setState(() => _idCategoria = v),
                ),
              const SizedBox(height: 12),

              // ── Proveedor (dinámico desde backend) ─────────────────────────
              if (widget.suppliers.isEmpty)
                const _EmptyDropdownHint(label: 'Proveedor', icon: Icons.people_outline)
              else
                DropdownButtonFormField<int>(
                  value: _idProveedor,
                  decoration: const InputDecoration(labelText: 'Proveedor'),
                  isExpanded: true,
                  items: widget.suppliers
                      .map((p) => DropdownMenuItem<int>(
                            value: p.id,
                            child: Text(p.nombreCompleto),
                          ))
                      .toList(),
                  validator: (v) =>
                      v == null ? 'Seleccione un proveedor' : null,
                  onChanged: (v) => setState(() => _idProveedor = v),
                ),
              const SizedBox(height: 12),

              // ── Estado ─────────────────────────────────────────────────────
              DropdownButtonFormField<String>(
                value: _estado,
                decoration: const InputDecoration(labelText: 'Estado'),
                items: const [
                  DropdownMenuItem(
                    value: 'Disponible',
                    child: Text('Disponible'),
                  ),
                  DropdownMenuItem(value: 'Agotado', child: Text('Agotado')),
                  DropdownMenuItem(
                      value: 'Deshabilitado', child: Text('Deshabilitado')),
                ],
                onChanged: (v) => setState(() => _estado = v!),
              ),
              const SizedBox(height: 12),

              // ── Descripción ────────────────────────────────────────────────
              TextFormField(
                controller: _descCtrl,
                decoration: const InputDecoration(
                  labelText: 'Descripción',
                  hintText: 'Ingrese la descripción (opcional)',
                ),
                maxLines: 3,
                minLines: 1,
                keyboardType: TextInputType.multiline,
                textInputAction: TextInputAction.newline,
              ),
              const SizedBox(height: 16),

              // ── Imagen ─────────────────────────────────────────────────────
              Text(
                'Imagen del producto',
                style: TextStyle(
                  color: Colors.grey.shade800,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  ElevatedButton.icon(
                    icon: const Icon(Icons.image),
                    label: const Text('Seleccionar imagen'),
                    onPressed: _pickImage,
                  ),
                  const SizedBox(width: 12),
                  if (_selectedImage != null || imageUrl != null)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        width: 60,
                        height: 60,
                        color: Colors.grey.shade100,
                        child: _selectedImage != null
                            ? Image.file(_selectedImage!, fit: BoxFit.cover)
                            : Image.network(
                                imageUrl!,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => const Icon(
                                    Icons.broken_image,
                                    color: Colors.grey),
                              ),
                      ),
                    ),
                ],
              ),
              if (_selectedImage == null && imageUrl != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'Usando imagen existente. Si no seleccionas otra, se conservará la actual.',
                    style:
                        TextStyle(color: Colors.grey.shade600, fontSize: 12),
                  ),
                ),
              if (_imageError != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    _imageError!,
                    style:
                        const TextStyle(color: Colors.red, fontSize: 12),
                  ),
                ),
              const SizedBox(height: 20),

              // ── Botones ────────────────────────────────────────────────────
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancelar'),
                  ),
                  const SizedBox(width: 10),
                  ElevatedButton(
                    onPressed: () {
                      final isNewProduct = widget.producto == null;
                      if (isNewProduct && _selectedImage == null) {
                        setState(() => _imageError = 'La imagen es obligatoria');
                        return;
                      }
                      if (_formKey.currentState!.validate()) {
                        setState(() => _imageError = null);
                        widget.onSave(
                          {
                            'nombre': _nombreCtrl.text.trim(),
                            'precio': _precioCtrl.text.trim(),
                            'estado': _estado,
                            'descripcion': _descCtrl.text.trim(),
                            'id_categoria': (_idCategoria ?? 1).toString(),
                            'id_proveedor': (_idProveedor ?? 1).toString(),
                          },
                          _selectedImage,
                        );
                      }
                    },
                    child: const Text('Guardar'),
                  ),
                ],
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

/// Widget informativo cuando la lista dinámica está vacía.
class _EmptyDropdownHint extends StatelessWidget {
  final String label;
  final IconData icon;

  const _EmptyDropdownHint({required this.label, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade400),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(icon, color: Colors.grey.shade500, size: 20),
          const SizedBox(width: 8),
          Text(
            'No hay $label disponibles',
            style: TextStyle(color: Colors.grey.shade600),
          ),
        ],
      ),
    );
  }
}
