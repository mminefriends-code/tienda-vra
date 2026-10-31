import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/cart_provider.dart';
import '../../providers/auth_provider.dart';
import '../../core/utils/product_media_helper.dart';
import '../../core/network/api_client.dart';
import '../auth/login_screen.dart';

class ClientCartScreen extends StatefulWidget {
  const ClientCartScreen({super.key});

  @override
  State<ClientCartScreen> createState() => _ClientCartScreenState();
}

class _ClientCartScreenState extends State<ClientCartScreen> {
  int _offlineOrdersCount = 0;
  bool _isSyncing = false;

  @override
  void initState() {
    super.initState();
    _checkOfflineOrders();
  }

  Future<void> _checkOfflineOrders() async {
    final prefs = await SharedPreferences.getInstance();
    final rawList = prefs.getStringList('offline_pending_orders') ?? [];
    setState(() {
      _offlineOrdersCount = rawList.length;
    });
  }

  Future<void> _saveOrderOffline(CartProvider cart) async {
    final prefs = await SharedPreferences.getInstance();
    final rawList = prefs.getStringList('offline_pending_orders') ?? [];

    final newOrder = {
      'id_offline_temporal': 'MOB-OFF-${DateTime.now().millisecondsSinceEpoch}',
      'items': cart.items.map((i) => {'id_ptc': i.id, 'cantidad': i.cantidad}).toList(),
      'metodo_pago': 'QR',
      'fecha_offline': DateTime.now().toIso8601String(),
      'total': cart.totalAmount,
    };

    rawList.add(jsonEncode(newOrder));
    await prefs.setStringList('offline_pending_orders', rawList);

    cart.clearCart();
    await _checkOfflineOrders();

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('📱 Pedido guardado en almacenamiento local (Modo Offline). Se enviará al reconectar o presionar "Cargar datos".'),
          backgroundColor: Color(0xFFD97706),
          duration: Duration(seconds: 4),
        ),
      );
    }
  }

  Future<void> _syncOfflineOrders() async {
    setState(() => _isSyncing = true);
    final prefs = await SharedPreferences.getInstance();
    final rawList = prefs.getStringList('offline_pending_orders') ?? [];

    if (rawList.isEmpty) {
      setState(() => _isSyncing = false);
      return;
    }

    try {
      final orders = rawList.map((item) => jsonDecode(item)).toList();
      final res = await ApiClient().post('/ventas/sincronizar-offline', body: {'ventas': orders});

      await prefs.remove('offline_pending_orders');
      await _checkOfflineOrders();

      if (mounted) {
        final sincronizadas = res['sincronizadas'] ?? orders.length;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('🎉 ¡$sincronizadas pedido(s) sincronizado(s) exitosamente con el servidor!'),
            backgroundColor: AppTheme.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Sin conexión al servidor. Los datos siguen guardados localmente: $e'),
            backgroundColor: AppTheme.danger,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSyncing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bolsa de Compras'),
        actions: [
          if (cart.items.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_outline),
              tooltip: 'Vaciar Bolsa',
              onPressed: () => cart.clearCart(),
            ),
        ],
      ),
      body: Column(
        children: [
          // Banner de Tolerancia a Fallos y Sincronización Offline
          if (_offlineOrdersCount > 0)
            Container(
              margin: const EdgeInsets.all(12),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFF59E0B)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.cloud_off_rounded, color: Color(0xFFB45309), size: 22),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '$_offlineOrdersCount pedido(s) en cola offline',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF78350F)),
                        ),
                        const Text(
                          'Guardados sin internet. Pulsa para enviarlos.',
                          style: TextStyle(fontSize: 11, color: Color(0xFF92400E)),
                        ),
                      ],
                    ),
                  ),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.oxfordBlue,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: _isSyncing ? null : _syncOfflineOrders,
                    child: _isSyncing
                        ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Cargar datos', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),

          Expanded(
            child: cart.items.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.shopping_bag_outlined, size: 70, color: Colors.grey.shade400),
                        const SizedBox(height: 16),
                        Text(
                          'Tu bolsa de compras está vacía',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 6),
                        const Text('Explora el catálogo para añadir prendas.'),
                      ],
                    ),
                  )
                : Column(
                    children: [
                      Expanded(
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: cart.items.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            final item = cart.items[index];
                            return Card(
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 64,
                                      height: 64,
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF1F5F9),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: ProductMediaHelper.buildProductImage(
                                        codigo: '',
                                        nombre: item.nombre,
                                        imagenPrincipal: item.imagenUrl,
                                        color: item.color,
                                        fit: BoxFit.contain,
                                        fallbackWidget: const Icon(Icons.checkroom, color: Colors.black26),
                                      ),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            item.nombre,
                                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            'Talla: ${item.talla} | Color: ${item.color}',
                                            style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                                          ),
                                          const SizedBox(height: 6),
                                          Text(
                                            '${item.precio.toStringAsFixed(2)} Bs.',
                                            style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary),
                                          ),
                                        ],
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.remove_circle_outline, color: Colors.redAccent),
                                      onPressed: () => cart.removeItem(item.id),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          border: Border(top: BorderSide(color: AppTheme.cardBorder)),
                        ),
                        child: Column(
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text('Total a pagar:', style: TextStyle(fontSize: 15, color: AppTheme.textSecondary)),
                                Text(
                                  '${cart.totalAmount.toStringAsFixed(2)} Bs.',
                                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.primary),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton.icon(
                                icon: const Icon(Icons.payment_rounded),
                                label: const Text('Proceder al Pago / Guardar Pedido'),
                                onPressed: () {
                                  if (!auth.isAuthenticated) {
                                    Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
                                    return;
                                  }
                                  showDialog(
                                    context: context,
                                    builder: (_) => AlertDialog(
                                      title: const Text('Confirmar Pedido o Venta'),
                                      content: Text(
                                        'Total: ${cart.totalAmount.toStringAsFixed(2)} Bs.\n\nSi no tienes conexión a internet en este momento, el sistema guardará el pedido localmente como EN PROCESO y podrás enviarlo cuando tengas red.',
                                      ),
                                      actions: [
                                        TextButton(
                                          onPressed: () {
                                            Navigator.pop(context);
                                            _saveOrderOffline(cart);
                                          },
                                          child: const Text('Guardar Offline'),
                                        ),
                                        ElevatedButton(
                                          onPressed: () {
                                            cart.clearCart();
                                            Navigator.pop(context);
                                            ScaffoldMessenger.of(context).showSnackBar(
                                              const SnackBar(
                                                content: Text('¡Venta realizada con éxito!'),
                                                backgroundColor: AppTheme.success,
                                              ),
                                            );
                                          },
                                          child: const Text('Pagar en Línea'),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}
