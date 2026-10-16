import 'package:flutter/material.dart';
import '../core/constants/api_constants.dart';
import '../core/network/api_client.dart';
import '../models/product_model.dart';

class CatalogProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<ProductModel> _products = [];
  List<ProductModel> _featuredProducts = [];
  bool _isLoading = false;
  String? _error;
  String _searchQuery = '';
  String? _selectedCategory;

  List<ProductModel> get products => _products;
  List<ProductModel> get featuredProducts => _featuredProducts;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String get searchQuery => _searchQuery;
  String? get selectedCategory => _selectedCategory;

  Future<void> fetchCatalog({String? busqueda, String? categoria, bool soloDestacados = false}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      String queryParams = '?limite=50';
      if (busqueda != null && busqueda.isNotEmpty) queryParams += '&busqueda=${Uri.encodeComponent(busqueda)}';
      if (categoria != null && categoria.isNotEmpty) queryParams += '&categoria=${Uri.encodeComponent(categoria)}';
      if (soloDestacados) queryParams += '&solo_destacados=true';

      final res = await _api.get('${ApiConstants.catalogoPublico}$queryParams', requireAuth: false);
      final rawItems = res['items'] as List<dynamic>? ?? [];
      final loaded = rawItems.map((e) => ProductModel.fromJson(e)).toList();

      if (soloDestacados) {
        _featuredProducts = loaded;
      } else {
        _products = loaded;
      }
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<List<BranchAvailability>> fetchAvailability(String codigo) async {
    try {
      final res = await _api.get(ApiConstants.productoDisponibilidad(codigo), requireAuth: false);
      final rawSucursales = res['sucursales'] as List<dynamic>? ?? [];
      return rawSucursales.map((e) => BranchAvailability.fromJson(e)).toList();
    } catch (e) {
      return [];
    }
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    fetchCatalog(busqueda: query);
  }

  void setCategoryFilter(String? cat) {
    _selectedCategory = cat;
    fetchCatalog(categoria: cat);
  }
}
