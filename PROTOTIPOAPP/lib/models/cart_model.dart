class CartItemModel {
  final int id;
  final int idPtc;
  final String nombre;
  final String talla;
  final String color;
  final double precioUnitario;
  int cantidad;
  final String? imagenUrl;

  CartItemModel({
    required this.id,
    required this.idPtc,
    required this.nombre,
    required this.talla,
    required this.color,
    required this.precioUnitario,
    required this.cantidad,
    this.imagenUrl,
  });

  double get subtotal => precioUnitario * cantidad;
  double get precio => precioUnitario;

  factory CartItemModel.fromJson(Map<String, dynamic> json) {
    return CartItemModel(
      id: json['id_carrito_item'] ?? 0,
      idPtc: json['id_ptc'] ?? 0,
      nombre: json['nombre_producto'] ?? json['nombre'] ?? 'Prenda',
      talla: json['talla'] ?? '',
      color: json['color'] ?? '',
      precioUnitario: (json['precio_unitario'] as num?)?.toDouble() ?? 0.0,
      cantidad: json['cantidad'] ?? 1,
      imagenUrl: json['imagen_url'],
    );
  }
}
