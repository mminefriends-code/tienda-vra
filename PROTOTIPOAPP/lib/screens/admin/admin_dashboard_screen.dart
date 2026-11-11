import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/dashboard_provider.dart';
import '../../providers/auth_provider.dart';
import 'admin_reservations_screen.dart';
import 'admin_alerts_screen.dart';
import 'admin_users_screen.dart';
import 'admin_roles_screen.dart';
import 'admin_branches_screen.dart';
import 'admin_inventory_screen.dart';
import 'admin_audit_screen.dart';
import 'admin_voice_reports_screen.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      context.read<DashboardProvider>().fetchKpis();
      context.read<DashboardProvider>().fetchCriticalAlerts();
    });
  }

  @override
  Widget build(BuildContext context) {
    final dash = context.watch<DashboardProvider>();
    final auth = context.watch<AuthProvider>();

    final userRole = auth.user?.rol ?? 'Administrador';
    final bool isSuperAdmin = userRole == 'Administrador' || userRole == 'Gerente';

    return Scaffold(
      appBar: AppBar(
        title: Text(isSuperAdmin ? 'Panel de Administración' : 'Terminal de Sucursal'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Actualizar Datos',
            onPressed: () {
              dash.fetchKpis();
              dash.fetchCriticalAlerts();
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Cerrar Sesión',
            onPressed: () => auth.logout(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await dash.fetchKpis();
          await dash.fetchCriticalAlerts();
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // User Profile Banner
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.primary,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.primary.withOpacity(0.2),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: Colors.white24,
                      radius: 24,
                      child: Text(
                        auth.user?.nombre?.substring(0, 1).toUpperCase() ?? 'A',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            auth.user?.nombre ?? 'Administrador',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Rol: $userRole • Sucursal Central',
                            style: const TextStyle(color: Colors.white70, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.success.withOpacity(0.25),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text('Online', style: TextStyle(color: AppTheme.success, fontSize: 11, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // KPI Metrics
              Text('Métricas en Tiempo Real', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),

              if (dash.isLoading && dash.kpis == null)
                const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator()))
              else
                Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _kpiCard(
                            title: 'Ventas Totales',
                            value: '${dash.kpis?.ventasTotales.toStringAsFixed(2) ?? "0.00"} Bs.',
                            icon: Icons.payments_outlined,
                            color: AppTheme.success,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _kpiCard(
                            title: 'Nro. Ventas',
                            value: '${dash.kpis?.nroVentas ?? 0}',
                            icon: Icons.shopping_bag_outlined,
                            color: AppTheme.accent,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _kpiCard(
                            title: 'Reservas Pendientes',
                            value: '${dash.kpis?.reservasPendientes ?? 0}',
                            icon: Icons.schedule_outlined,
                            color: AppTheme.warning,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _kpiCard(
                            title: 'Stock Disponible',
                            value: '${dash.kpis?.existenciasDisponibles ?? 0}',
                            icon: Icons.inventory_2_outlined,
                            color: AppTheme.primaryLight,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),

              const SizedBox(height: 24),
              // Operaciones & Despacho
              Text('Operaciones & Atención en Tienda', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),

              _actionTile(
                title: 'Atención de Reservas de Sucursal',
                subtitle: 'Confirmar retiro de prendas y entrega al cliente',
                icon: Icons.assignment_turned_in_outlined,
                color: AppTheme.accent,
                badge: '${dash.kpis?.reservasPendientes ?? 0}',
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const AdminReservationsScreen()),
                  );
                },
              ),
              const SizedBox(height: 10),

              _actionTile(
                title: 'Alertas Críticas de Stock',
                subtitle: 'Quiebres de inventario y existencias mínimas',
                icon: Icons.warning_amber_rounded,
                color: AppTheme.danger,
                badge: '${dash.criticalAlerts.length}',
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const AdminAlertsScreen()),
                  );
                },
              ),
              const SizedBox(height: 10),

              _actionTile(
                title: 'Reportes por Voz con IA',
                subtitle: 'Dictado de reportes ejecutivos en PDF y Excel',
                icon: Icons.mic_rounded,
                color: Colors.deepPurple,
                badge: 'IA',
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const AdminVoiceReportsScreen()),
                  );
                },
              ),
              const SizedBox(height: 10),

              _actionTile(
                title: 'Registro de Clientes & Personal',
                subtitle: 'Dar de alta clientes o nuevo personal en sucursal',
                icon: Icons.person_add_alt_1_outlined,
                color: Colors.blueAccent,
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const AdminUsersScreen()),
                  );
                },
              ),

              const SizedBox(height: 24),
              // Seguridad & Usuarios
              if (isSuperAdmin) ...[
                Text('Seguridad, Accesos & Auditoría', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),

                _actionTile(
                  title: 'Gestión de Usuarios & Personal',
                  subtitle: 'Crear empleados, asignar sucursales y roles',
                  icon: Icons.people_outline,
                  color: AppTheme.primary,
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const AdminUsersScreen()),
                    );
                  },
                ),
                const SizedBox(height: 10),

                _actionTile(
                  title: 'Roles & Matriz de Permisos',
                  subtitle: 'Consultar niveles de acceso y permisos RBAC',
                  icon: Icons.shield_outlined,
                  color: Colors.indigo,
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const AdminRolesScreen()),
                    );
                  },
                ),
                const SizedBox(height: 10),

                _actionTile(
                  title: 'Bitácora de Auditoría del Sistema',
                  subtitle: 'Historial de modificaciones, IPs y eventos',
                  icon: Icons.history_edu_outlined,
                  color: Colors.blueGrey,
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const AdminAuditScreen()),
                    );
                  },
                ),

                const SizedBox(height: 24),
                // Infraestructura & Inventario
                Text('Infraestructura & Inventario', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),

                _actionTile(
                  title: 'Sucursales & Almacenes',
                  subtitle: 'Sedes en La Paz, Santa Cruz, Cochabamba',
                  icon: Icons.storefront_outlined,
                  color: Colors.teal,
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const AdminBranchesScreen()),
                    );
                  },
                ),
                const SizedBox(height: 10),

                _actionTile(
                  title: 'Control de Stock Inter-Sucursal',
                  subtitle: 'Consulta de existencias por prenda y sucursal',
                  icon: Icons.inventory_outlined,
                  color: AppTheme.primaryLight,
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const AdminInventoryScreen()),
                    );
                  },
                ),
              ],
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _kpiCard({required String title, required String value, required IconData icon, required Color color}) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              backgroundColor: color.withOpacity(0.12),
              radius: 18,
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 12),
            Text(
              value,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
            ),
            const SizedBox(height: 2),
            Text(title, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
          ],
        ),
      ),
    );
  }

  Widget _actionTile({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    String? badge,
    required VoidCallback onTap,
  }) {
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: color.withOpacity(0.12),
          child: Icon(icon, color: color),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
        subtitle: Text(subtitle, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (badge != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                margin: const EdgeInsets.only(right: 8),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(badge, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 12)),
              ),
            const Icon(Icons.arrow_forward_ios, size: 14, color: AppTheme.textSecondary),
          ],
        ),
        onTap: onTap,
      ),
    );
  }
}
