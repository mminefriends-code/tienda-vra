import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController(text: 'admin@tiendavra.bo');
  final _passwordController = TextEditingController(text: 'admin123');
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _quickFill(String email, String pass) {
    _emailController.text = email;
    _passwordController.text = pass;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 30),
              Center(
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppTheme.primary,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.primary.withOpacity(0.2),
                        blurRadius: 15,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.checkroom_rounded,
                    color: Colors.white,
                    size: 38,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Tienda VRA',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.displayMedium,
              ),
              const SizedBox(height: 6),
              Text(
                'Plataforma E-Commerce Móvil & RA',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 36),
              if (auth.error != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.danger.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.danger.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: AppTheme.danger, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          auth.error!,
                          style: const TextStyle(color: AppTheme.danger, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],
              Text('Correo electrónico', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 14)),
              const SizedBox(height: 8),
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  hintText: 'ej. usuario@tiendavra.bo',
                  prefixIcon: Icon(Icons.email_outlined),
                ),
              ),
              const SizedBox(height: 18),
              Text('Contraseña', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 14)),
              const SizedBox(height: 8),
              TextField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                decoration: InputDecoration(
                  hintText: 'Ingresa tu contraseña',
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility),
                    onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: auth.isLoading
                    ? null
                    : () async {
                        final ok = await auth.login(_emailController.text.trim(), _passwordController.text.trim());
                        if (ok && mounted) {
                          Navigator.pop(context);
                        }
                      },
                child: auth.isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Text('Iniciar Sesión'),
              ),
              const SizedBox(height: 28),
              const Divider(),
              const SizedBox(height: 12),
              const Text(
                'Accesos Rápidos de Demostración:',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  ActionChip(
                    avatar: const Icon(Icons.admin_panel_settings, size: 16),
                    label: const Text('Admin', style: TextStyle(fontSize: 12)),
                    onPressed: () => _quickFill('admin@tiendavra.bo', 'admin123'),
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.storefront, size: 16),
                    label: const Text('Cajero / Vendedor', style: TextStyle(fontSize: 12)),
                    onPressed: () => _quickFill('caja.lapaz@tiendavra.bo', 'admin123'),
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.person, size: 16),
                    label: const Text('Cliente Demo', style: TextStyle(fontSize: 12)),
                    onPressed: () => _quickFill('maria.gonzales@correo.com', 'admin123'),
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.person_pin, size: 16),
                    label: const Text('Cliente Personal', style: TextStyle(fontSize: 12)),
                    onPressed: () => _quickFill('rojas@gmail.com', 'admin123'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
