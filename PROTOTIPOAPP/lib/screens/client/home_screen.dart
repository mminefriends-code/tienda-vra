import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/catalog_provider.dart';
import '../../providers/auth_provider.dart';
import '../../models/product_model.dart';
import '../../core/utils/product_media_helper.dart';
import '../auth/login_screen.dart';
import 'product_detail_screen.dart';
import 'virtual_fitting_screen.dart';
import 'ai_assistant_screen.dart';

class ClientHomeScreen extends StatefulWidget {
  final VoidCallback onGoToCatalog;
  const ClientHomeScreen({super.key, required this.onGoToCatalog});

  @override
  State<ClientHomeScreen> createState() => _ClientHomeScreenState();
}

class _ClientHomeScreenState extends State<ClientHomeScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      final cat = context.read<CatalogProvider>();
      cat.fetchCatalog(soloDestacados: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final catProvider = context.watch<CatalogProvider>();
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 12,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(5),
              decoration: BoxDecoration(
                color: AppTheme.primary,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.checkroom, color: Colors.white, size: 18),
            ),
            const SizedBox(width: 8),
            const Flexible(
              child: Text(
                'Tienda VRA',
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.auto_awesome, color: AppTheme.accentGold),
            tooltip: 'Asistente IA de Moda',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const AiAssistantScreen()),
              );
            },
          ),
          if (!auth.isAuthenticated)
            TextButton.icon(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              ),
              icon: const Icon(Icons.login, size: 16, color: AppTheme.primary),
              label: const Text('Ingresar', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            )
          else
            IconButton(
              icon: CircleAvatar(
                radius: 14,
                backgroundColor: AppTheme.primary.withOpacity(0.15),
                child: Text(
                  ((auth.user?.nombre?.isNotEmpty == true) ? auth.user!.nombre![0] : 'U').toUpperCase(),
                  style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 12),
                ),
              ),
              tooltip: 'Usuario: ${auth.user?.nombre}',
              onPressed: () => _showUserMenu(context, auth),
            ),
          const SizedBox(width: 6),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => catProvider.fetchCatalog(soloDestacados: true),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Hero Banner - Vestidor Virtual
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppTheme.oxfordBlue, AppTheme.storm],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.oxfordBlue.withOpacity(0.3),
                      blurRadius: 15,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.steel,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.view_in_ar, color: Colors.white, size: 14),
                          SizedBox(width: 4),
                          Text(
                            'NUEVA EXPERIENCIA RA',
                            style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Vestidor Virtual con\nRealidad Aumentada',
                      style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold, height: 1.2),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Pruébate las prendas desde tu cámara móvil antes de reservar en tienda.',
                      style: TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: AppTheme.primary,
                      ),
                      icon: const Icon(Icons.camera_alt_rounded, size: 18),
                      label: const Text('Abrir Vestidor RA'),
                      onPressed: () {
                        if (catProvider.featuredProducts.isNotEmpty) {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => VirtualFittingScreen(product: catProvider.featuredProducts.first),
                            ),
                          );
                        } else {
                          widget.onGoToCatalog();
                        }
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Sección Categorías Rápidas
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Categorías', style: Theme.of(context).textTheme.titleLarge),
                  TextButton(
                    onPressed: widget.onGoToCatalog,
                    child: const Text('Ver todas'),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _categoryChip(context, 'Poleras', Icons.dry_cleaning),
                    _categoryChip(context, 'Pantalones', Icons.accessibility_new),
                    _categoryChip(context, 'Abrigos', Icons.ac_unit),
                    _categoryChip(context, 'Faldas', Icons.woman),
                    _categoryChip(context, 'Vestidos', Icons.checkroom),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // Destacados de la Temporada
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text('Destacados de Temporada', style: Theme.of(context).textTheme.titleLarge),
                  ),
                  TextButton(
                    onPressed: widget.onGoToCatalog,
                    child: const Text('Ver Catálogo'),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              if (catProvider.isLoading)
                const Center(child: Padding(padding: EdgeInsets.all(30), child: CircularProgressIndicator()))
              else if (catProvider.featuredProducts.isEmpty)
                const Center(child: Text('No hay productos destacados por el momento.'))
              else
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 0.68,
                    crossAxisSpacing: 14,
                    mainAxisSpacing: 14,
                  ),
                  itemCount: catProvider.featuredProducts.length,
                  itemBuilder: (context, index) {
                    final product = catProvider.featuredProducts[index];
                    return _ProductCard(product: product);
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _categoryChip(BuildContext context, String title, IconData icon) {
    return Container(
      margin: const EdgeInsets.only(right: 10),
      child: ActionChip(
        avatar: Icon(icon, size: 16, color: AppTheme.accent),
        label: Text(title),
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: const BorderSide(color: AppTheme.cardBorder),
        ),
        onPressed: () {
          context.read<CatalogProvider>().setCategoryFilter(title);
          widget.onGoToCatalog();
        },
      ),
    );
  }

  void _showUserMenu(BuildContext context, AuthProvider auth) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: AppTheme.primary.withOpacity(0.12),
                  child: Text(
                    ((auth.user?.nombre?.isNotEmpty == true) ? auth.user!.nombre![0] : 'U').toUpperCase(),
                    style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 18),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(auth.user?.nombre ?? 'Usuario', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      Text(auth.user?.email ?? '', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(height: 30),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.danger),
              icon: const Icon(Icons.logout),
              label: const Text('Cerrar Sesión'),
              onPressed: () async {
                Navigator.pop(ctx);
                await auth.logout();
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final ProductModel product;
  const _ProductCard({required this.product});

  @override
  Widget build(BuildContext context) {
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
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Container(
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
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.6),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.view_in_ar, color: Colors.white, size: 12),
                          SizedBox(width: 3),
                          Text('RA', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                ],
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
                  Text(
                    '${product.precioFinal.toStringAsFixed(2)} Bs.',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      color: AppTheme.accent,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
