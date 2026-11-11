import 'package:flutter/material.dart';
import '../../models/product_model.dart';

class ProductMediaHelper {
  static const String _assetPrefix = 'assets/images/productos/';

  // Tabla de fotos locales idéntica a la web (fotos.ts)
  static final List<Map<String, String>> _fotosLocales = [
    {'prenda': 'remera', 'color': 'negro', 'fichero': 'polera-negra.png'},
    {'prenda': 'remera', 'color': 'negra', 'fichero': 'polera-negra.png'},
    {'prenda': 'remera', 'color': 'blanco', 'fichero': 'polera-blanca.png'},
    {'prenda': 'remera', 'color': 'blanca', 'fichero': 'polera-blanca.png'},
    {'prenda': 'remera', 'color': 'gris', 'fichero': 'polera-gris.png'},
    {'prenda': 'remera', 'color': 'azul', 'fichero': 'polera-azul.png'},
    {'prenda': 'remera', 'color': 'azul marino', 'fichero': 'polera-azul.png'},

    {'prenda': 'polo', 'color': 'negro', 'fichero': 'polera-negra.png'},
    {'prenda': 'polo', 'color': 'negra', 'fichero': 'polera-negra.png'},
    {'prenda': 'polo', 'color': 'blanco', 'fichero': 'polera-blanca.png'},
    {'prenda': 'polo', 'color': 'blanca', 'fichero': 'polera-blanca.png'},
    {'prenda': 'polo', 'color': 'gris', 'fichero': 'polera-gris.png'},
    {'prenda': 'polo', 'color': 'azul', 'fichero': 'polera-azul.png'},
    {'prenda': 'polo', 'color': 'azul marino', 'fichero': 'polera-azul.png'},
    {'prenda': 'polo', 'color': 'rojo', 'fichero': 'polo-rojo.png'},
    {'prenda': 'polo', 'color': 'roja', 'fichero': 'polo-rojo.png'},

    {'prenda': 'canguro', 'color': 'negro', 'fichero': 'polera-negra.png'},
    {'prenda': 'canguro', 'color': 'negra', 'fichero': 'polera-negra.png'},
    {'prenda': 'canguro', 'color': 'blanco', 'fichero': 'polera-blanca.png'},
    {'prenda': 'canguro', 'color': 'blanca', 'fichero': 'polera-blanca.png'},
    {'prenda': 'canguro', 'color': 'gris', 'fichero': 'polera-gris.png'},
    {'prenda': 'canguro', 'color': 'azul', 'fichero': 'polera-azul.png'},
    {'prenda': 'canguro', 'color': 'azul marino', 'fichero': 'polera-azul.png'},

    {'prenda': 'campera', 'color': 'negro', 'fichero': 'campera-negro.png'},
    {'prenda': 'campera', 'color': 'negra', 'fichero': 'campera-negro.png'},
    {'prenda': 'campera', 'color': 'azul', 'fichero': 'polera-azul.png'},
    {'prenda': 'campera', 'color': 'azul marino', 'fichero': 'polera-azul.png'},
    {'prenda': 'campera', 'color': 'gris', 'fichero': 'polera-gris.png'},
    {'prenda': 'campera', 'color': 'blanco', 'fichero': 'polera-blanca.png'},
  ];

  static String _normalizar(String text) {
    return text.trim().toLowerCase();
  }

  /// Deduce el tipo de prenda a partir del código y nombre del producto
  static String? tipoDePrenda(String codigo, String nombre) {
    final t = '${codigo.toLowerCase()} ${nombre.toLowerCase()}';
    if (RegExp(r'canguro|hoodie|sudadera|poleron').hasMatch(t)) return 'canguro';
    if (RegExp(r'campera|abrigo|chaqueta|coat|chamarra|casaca').hasMatch(t)) return 'campera';
    if (RegExp(r'polo').hasMatch(t)) return 'polo';
    if (RegExp(r'polera|remera|camiseta|camisa|blusa|t-shirt|top').hasMatch(t)) return 'remera';
    return 'remera';
  }

  /// Retorna la ruta del asset local (ej: 'assets/images/productos/polera-negra.png')
  static String? obtenerAssetLocal(String? codigo, String? nombre, [String? color]) {
    final cod = codigo ?? '';
    final nom = nombre ?? '';
    final tipo = tipoDePrenda(cod, nom);

    if (tipo == null) {
      // Intento directo por si el nombre o código contiene la prenda exacta
      for (final item in _fotosLocales) {
        if (nom.toLowerCase().contains(item['prenda']!) || cod.toLowerCase().contains(item['prenda']!)) {
          return '$_assetPrefix${item['fichero']}';
        }
      }
      return null;
    }

    final c = color != null ? _normalizar(color) : null;

    if (c != null && c.isNotEmpty) {
      final exacta = _fotosLocales.firstWhere(
        (f) => f['prenda'] == tipo && f['color'] == c,
        orElse: () => const {},
      );
      if (exacta.isNotEmpty) return '$_assetPrefix${exacta['fichero']}';
    }

    // Sin color o color no encontrado: primera foto de ese tipo
    final deLaPrenda = _fotosLocales.firstWhere(
      (f) => f['prenda'] == tipo,
      orElse: () => const {},
    );
    if (deLaPrenda.isNotEmpty) return '$_assetPrefix${deLaPrenda['fichero']}';

    return null;
  }

  /// Resuelve la URL o Asset para un producto
  static String? resolverRuta({
    String? codigo,
    String? nombre,
    String? imagenPrincipal,
    String? color,
  }) {
    // 1. Si coincide con una foto local (exactamente igual que en web)
    final local = obtenerAssetLocal(codigo, nombre, color);
    if (local != null) return local;

    // 2. Si la URL remota existe y no es solo el nombre de un archivo local
    if (imagenPrincipal != null && imagenPrincipal.isNotEmpty) {
      if (imagenPrincipal.startsWith('assets/')) return imagenPrincipal;
      if (imagenPrincipal.startsWith('http://') || imagenPrincipal.startsWith('https://')) {
        return imagenPrincipal;
      }
      // Si es una ruta relativa local tipo "/productos/polera-negra.png"
      final fileName = imagenPrincipal.split('/').last;
      return '$_assetPrefix$fileName';
    }

    return null;
  }

  /// Widget unificado para renderizar cualquier imagen de producto
  static Widget buildProductImage({
    required String? codigo,
    required String? nombre,
    String? imagenPrincipal,
    String? color,
    double? width,
    double? height,
    BoxFit fit = BoxFit.contain,
    Widget? fallbackWidget,
  }) {
    final assetPath = obtenerAssetLocal(codigo, nombre, color);

    // 1. Prioridad: Asset Local de alta calidad (instantáneo y sin fallos de red)
    if (assetPath != null) {
      return Image.asset(
        assetPath,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (_, __, ___) => _buildFallback(fallbackWidget, width, height),
      );
    }

    // 2. Si imagenPrincipal es una URL HTTP
    if (imagenPrincipal != null &&
        (imagenPrincipal.startsWith('http://') || imagenPrincipal.startsWith('https://'))) {
      return Image.network(
        imagenPrincipal,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (_, __, ___) => _buildFallback(fallbackWidget, width, height),
      );
    }

    // 3. Si imagenPrincipal es un nombre de archivo local conocido
    if (imagenPrincipal != null && imagenPrincipal.isNotEmpty) {
      final fileName = imagenPrincipal.split('/').last;
      return Image.asset(
        '$_assetPrefix$fileName',
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (_, __, ___) => _buildFallback(fallbackWidget, width, height),
      );
    }

    // 4. Fallback por defecto
    return _buildFallback(fallbackWidget, width, height);
  }

  /// Construye imagen para un objeto ProductModel
  static Widget fromProduct(
    ProductModel product, {
    String? color,
    double? width,
    double? height,
    BoxFit fit = BoxFit.contain,
    Widget? fallbackWidget,
  }) {
    return buildProductImage(
      codigo: product.codigo,
      nombre: product.nombre,
      imagenPrincipal: product.imagenPrincipal,
      color: color,
      width: width,
      height: height,
      fit: fit,
      fallbackWidget: fallbackWidget,
    );
  }

  static Widget _buildFallback(Widget? customFallback, double? w, double? h) {
    if (customFallback != null) return customFallback;
    return Container(
      width: w,
      height: h,
      alignment: Alignment.center,
      color: const Color(0xFF1E293B),
      child: const Icon(Icons.checkroom, color: Colors.white38, size: 40),
    );
  }
}
