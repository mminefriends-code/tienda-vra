import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/catalog_provider.dart';
import '../../core/utils/product_media_helper.dart';
import 'product_detail_screen.dart';

class ClientCatalogScreen extends StatefulWidget {
  const ClientCatalogScreen({super.key});

  @override
  State<ClientCatalogScreen> createState() => _ClientCatalogScreenState();
}

class _ClientCatalogScreenState extends State<ClientCatalogScreen> {
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    Future.microtask(() => context.read<CatalogProvider>().fetchCatalog());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final catProvider = context.watch<CatalogProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Catálogo de Prendas'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Buscar poleras, canguros, hoodies, camisas...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          catProvider.setSearchQuery('');
                        },
                      )
                    : null,
              ),
              onSubmitted: (val) => catProvider.setSearchQuery(val.trim()),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => catProvider.fetchCatalog(busqueda: _searchController.text.trim()),
              child: catProvider.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : catProvider.error != null
                      ? Center(child: Text(catProvider.error!))
                      : catProvider.products.isEmpty
                          ? const Center(child: Text('No se encontraron prendas con esos filtros.'))
                          : GridView.builder(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                childAspectRatio: 0.68,
                                crossAxisSpacing: 14,
                                mainAxisSpacing: 14,
                              ),
                              itemCount: catProvider.products.length,
                              itemBuilder: (context, index) {
                                final product = catProvider.products[index];
                                return GestureDetector(
                                  onTap: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(builder: (_) => ProductDetailScreen(product: product)),
                                    );
                                  },
                                  child: Card(
                                    clipBehavior: Clip.antiAlias,
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.stretch,
                                      children: [
                                        Expanded(
                                          child: Container(
                                            color: const Color(0xFFF1F5F9),
                                            padding: const EdgeInsets.all(8),
                                            child: Center(
                                              child: ProductMediaHelper.fromProduct(
                                                product,
                                                fit: BoxFit.contain,
                                                fallbackWidget: const Center(
                                                  child: Icon(Icons.checkroom, size: 40, color: Colors.black26),
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                        Padding(
                                          padding: const EdgeInsets.all(10),
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                product.categoria ?? 'Ropa',
                                                style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                                              ),
                                              const SizedBox(height: 2),
                                              Text(
                                                product.nombre,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                              ),
                                              const SizedBox(height: 6),
                                              Row(
                                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                children: [
                                                  Text(
                                                    '${product.precioFinal.toStringAsFixed(2)} Bs.',
                                                    style: const TextStyle(
                                                      fontWeight: FontWeight.bold,
                                                      fontSize: 14,
                                                      color: AppTheme.accent,
                                                    ),
                                                  ),
                                                  Row(
                                                    children: [
                                                      const Icon(Icons.palette_outlined, size: 12, color: Colors.grey),
                                                      const SizedBox(width: 2),
                                                      Text(
                                                        '${product.colores.length}',
                                                        style: const TextStyle(fontSize: 11, color: Colors.grey),
                                                      ),
                                                    ],
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
            ),
          ),
        ],
      ),
    );
  }
}
