import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme/app_theme.dart';
import 'core/network/api_client.dart';
import 'providers/auth_provider.dart';
import 'providers/catalog_provider.dart';
import 'providers/cart_provider.dart';
import 'providers/reservation_provider.dart';
import 'providers/dashboard_provider.dart';
import 'providers/admin_provider.dart';
import 'screens/navigation/main_nav_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiClient().init();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..loadSavedSession()),
        ChangeNotifierProvider(create: (_) => CatalogProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => ReservationProvider()),
        ChangeNotifierProvider(create: (_) => DashboardProvider()),
        ChangeNotifierProvider(create: (_) => AdminProvider()),
      ],
      child: const TiendaVraApp(),
    ),
  );
}

class TiendaVraApp extends StatelessWidget {
  const TiendaVraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Tienda VRA Móvil',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: const MainNavScreen(),
    );
  }
}
