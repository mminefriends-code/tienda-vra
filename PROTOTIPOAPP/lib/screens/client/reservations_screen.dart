import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/reservation_provider.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';

class ClientReservationsScreen extends StatefulWidget {
  const ClientReservationsScreen({super.key});

  @override
  State<ClientReservationsScreen> createState() => _ClientReservationsScreenState();
}

class _ClientReservationsScreenState extends State<ClientReservationsScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      final auth = context.read<AuthProvider>();
      if (auth.isAuthenticated) {
        context.read<ReservationProvider>().fetchMyReservations();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final resProvider = context.watch<ReservationProvider>();

    if (!auth.isAuthenticated) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Mis Reservas'),
          actions: [
            TextButton.icon(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              ),
              icon: const Icon(Icons.login, size: 18, color: AppTheme.primary),
              label: const Text(
                'Ingresar',
                style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary),
              ),
            ),
            const SizedBox(width: 8),
          ],
        ),
        body: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 70,
                      height: 70,
                      decoration: BoxDecoration(
                        color: AppTheme.primary.withOpacity(0.1),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.calendar_month_outlined, size: 36, color: AppTheme.primary),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'Mis Reservas en Tienda',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Inicia sesión con tu cuenta para ver tus prendas reservadas, probártelas en sucursal física y consultar su estado en tiempo real.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppTheme.textSecondary, height: 1.4, fontSize: 13),
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.login),
                        onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const LoginScreen()),
                        ),
                        label: const Text('Iniciar Sesión / Registrarme'),
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.person_outline),
                        onPressed: () async {
                          await auth.login('maria.gonzales@correo.com', 'admin123');
                          if (mounted && auth.isAuthenticated) {
                            context.read<ReservationProvider>().fetchMyReservations();
                          }
                        },
                        label: const Text('Acceso Rápido (Cliente Demo)'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mis Reservas en Tienda'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: AppTheme.textSecondary, size: 20),
            tooltip: 'Cerrar sesión (${auth.user?.nombre ?? ""})',
            onPressed: () async {
              await auth.logout();
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => resProvider.fetchMyReservations(),
        child: resProvider.isLoading
            ? const Center(child: CircularProgressIndicator())
            : resProvider.myReservations.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.event_busy, size: 60, color: Colors.grey.shade400),
                        const SizedBox(height: 14),
                        Text('No tienes reservas activas', style: Theme.of(context).textTheme.titleLarge),
                        const SizedBox(height: 6),
                        const Text('Puedes reservar prendas desde la ficha de producto.'),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: resProvider.myReservations.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 14),
                    itemBuilder: (context, index) {
                      final r = resProvider.myReservations[index];
                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.store, color: AppTheme.accent, size: 20),
                                      const SizedBox(width: 8),
                                      Text(
                                        r.sucursalNombre,
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                      ),
                                    ],
                                  ),
                                  _statusBadge(r.estado),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Text(
                                'Fecha de cita: ${r.fechaReserva} ${r.horaReserva}',
                                style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                              ),
                              const Divider(height: 20),
                              Text(
                                'Prendas reservadas (${r.items.length}):',
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                              ),
                              const SizedBox(height: 8),
                              ...r.items.map((it) {
                                return Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 3),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.checkroom, size: 16, color: AppTheme.textSecondary),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          '${it.productoNombre} (Talla ${it.talla}, ${it.color})',
                                          style: const TextStyle(fontSize: 13),
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              }),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
      ),
    );
  }

  Widget _statusBadge(String estado) {
    Color bg = Colors.grey.shade100;
    Color fg = Colors.grey.shade800;

    if (estado == 'Pendiente') {
      bg = AppTheme.warning.withOpacity(0.15);
      fg = AppTheme.warning;
    } else if (estado == 'Preparada' || estado == 'Completada') {
      bg = AppTheme.success.withOpacity(0.15);
      fg = AppTheme.success;
    } else if (estado == 'Cancelada') {
      bg = AppTheme.danger.withOpacity(0.15);
      fg = AppTheme.danger;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        estado,
        style: TextStyle(color: fg, fontWeight: FontWeight.bold, fontSize: 11),
      ),
    );
  }
}
