import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';

class AdminVoiceReportsScreen extends StatefulWidget {
  const AdminVoiceReportsScreen({super.key});

  @override
  State<AdminVoiceReportsScreen> createState() => _AdminVoiceReportsScreenState();
}

class _AdminVoiceReportsScreenState extends State<AdminVoiceReportsScreen> {
  final TextEditingController _promptController = TextEditingController();
  bool _isListening = false;
  bool _isGenerating = false;
  Map<String, dynamic>? _lastReport;
  String? _errorMessage;
  final List<Map<String, dynamic>> _history = [];

  final List<String> _quickPrompts = [
    'Reporte de ventas de hoy en PDF',
    'Inventario actual de tiendas VRA en Excel',
    'Disponibilidad de stock en La Paz y Santa Cruz',
    'Prendas con quiebre de existencias críticas',
    'Reporte de reservas y entregas pendientes',
  ];

  Future<void> _generarReporte(String comando) async {
    final text = comando.trim();
    if (text.isEmpty) return;

    setState(() {
      _isGenerating = true;
      _errorMessage = null;
    });

    try {
      final res = await ApiClient().post(
        ApiConstants.reportesVoz,
        body: {'texto': text},
        requireAuth: true,
      );

      if (res != null && res is Map<String, dynamic>) {
        setState(() {
          _lastReport = res;
          _history.insert(0, {
            'comando': text,
            'resumen': res['resumen'] ?? 'Reporte generado con éxito',
            'url_archivo': res['url_archivo'],
            'fecha': DateTime.now(),
          });
        });
      } else {
        throw Exception('Respuesta inválida del servidor');
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'No se pudo generar el reporte: $e';
      });
    } finally {
      setState(() {
        _isGenerating = false;
        _isListening = false;
      });
    }
  }

  void _toggleMic() {
    if (_isListening) {
      setState(() => _isListening = false);
      if (_promptController.text.isNotEmpty) {
        _generarReporte(_promptController.text);
      }
    } else {
      setState(() {
        _isListening = true;
        _errorMessage = null;
      });
      // Simula captura de audio móvil para demostración instantánea
      Future.delayed(const Duration(milliseconds: 1400), () {
        if (mounted && _isListening) {
          _promptController.text = 'Reporte de ventas en PDF';
          setState(() => _isListening = false);
          _generarReporte(_promptController.text);
        }
      });
    }
  }

  void _mostrarInfoArchivo(String? urlRelativa) {
    if (urlRelativa == null || urlRelativa.isEmpty) return;
    final serverBase = ApiConstants.baseUrl.replaceAll('/api/v1', '');
    final urlCompleta = '$serverBase$urlRelativa';

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(Icons.picture_as_pdf, color: Colors.redAccent, size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    urlRelativa.endsWith('.pdf') ? 'Documento PDF Generado' : 'Hoja de Cálculo Excel Generada',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              'El archivo se encuentra alojado y disponible en el servidor central:',
              style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: SelectableText(
                urlCompleta,
                style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              icon: const Icon(Icons.copy),
              label: const Text('Copiar Enlace de Descarga'),
              onPressed: () {
                Clipboard.setData(ClipboardData(text: urlCompleta));
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('¡Enlace copiado al portapapeles!')),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _promptController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reportes con IA & Voz'),
        actions: [
          IconButton(
            icon: const Icon(Icons.info_outline),
            tooltip: 'Ayuda',
            onPressed: () {
              showDialog(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Comandos de Voz Inteligentes'),
                  content: const Text(
                    'Puedes pedir reportes en lenguaje natural indicando el tipo (ventas, inventario, disponibilidad) y el formato deseado (PDF, Excel, CSV).\n\nEjemplos:\n• "Generar reporte de ventas de hoy en PDF"\n• "Existencias de sucursales en Excel"\n• "Stock de poleras en La Paz"',
                  ),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Entendido')),
                  ],
                ),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Banner de IA
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppTheme.primary,
                    AppTheme.primary.withValues(alpha: 0.85),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.primary.withValues(alpha: 0.2),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.auto_awesome, color: Colors.amberAccent, size: 28),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Asistente Ejecutivo de Reportes',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Pide reportes ejecutivos por voz o texto. La IA los sintetiza y genera archivos PDF/Excel al instante.',
                          style: TextStyle(color: Colors.white70, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Entrada de voz / texto
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      controller: _promptController,
                      decoration: InputDecoration(
                        hintText: 'Ej. Reporte de ventas en PDF...',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        prefixIcon: const Icon(Icons.mic_none),
                        suffixIcon: _promptController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear),
                                onPressed: () {
                                  _promptController.clear();
                                  setState(() {});
                                },
                              )
                            : null,
                      ),
                      onChanged: (_) => setState(() {}),
                      onSubmitted: _generarReporte,
                    ),
                    const SizedBox(height: 14),

                    // Botón de Micrófono & Generar
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _isListening ? Colors.redAccent : AppTheme.primary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            icon: Icon(_isListening ? Icons.hearing : Icons.mic),
                            label: Text(_isListening ? 'Escuchando voz...' : 'Dictar por Voz'),
                            onPressed: _toggleMic,
                          ),
                        ),
                        const SizedBox(width: 10),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.success,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: _isGenerating
                              ? null
                              : () => _generarReporte(_promptController.text.isNotEmpty
                                  ? _promptController.text
                                  : 'Reporte de ventas en PDF'),
                          child: _isGenerating
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Icon(Icons.send_rounded),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Sugerencias Rápidas
            const Text(
              'Consultas Rápidas:',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _quickPrompts.map((p) {
                return ActionChip(
                  avatar: const Icon(Icons.bolt, size: 15, color: Colors.amber),
                  label: Text(p, style: const TextStyle(fontSize: 12)),
                  onPressed: () {
                    _promptController.text = p;
                    _generarReporte(p);
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 20),

            // Mensaje de Error
            if (_errorMessage != null)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: Colors.red),
                    const SizedBox(width: 10),
                    Expanded(child: Text(_errorMessage!, style: const TextStyle(color: Colors.red))),
                  ],
                ),
              ),

            // Resultado del Reporte
            if (_lastReport != null) ...[
              const Text(
                'Último Reporte Generado por IA:',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 10),
              Card(
                elevation: 3,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(color: Colors.green.shade200, width: 1.5),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: Colors.green.shade50,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.check_circle, color: AppTheme.success, size: 24),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Síntesis Inteligente',
                                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                ),
                                Text(
                                  'ID Reporte #${_lastReport!['id_reporte'] ?? 0}',
                                  style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const Divider(height: 24),
                      Text(
                        _lastReport!['resumen'] ?? 'Sin resumen disponible.',
                        style: const TextStyle(fontSize: 14, height: 1.4),
                      ),
                      const SizedBox(height: 16),
                      if (_lastReport!['url_archivo'] != null)
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            icon: const Icon(Icons.download_rounded),
                            label: const Text('Ver / Descargar Documento'),
                            onPressed: () => _mostrarInfoArchivo(_lastReport!['url_archivo'] as String?),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],

            // Historial de la sesión
            if (_history.isNotEmpty) ...[
              const Text(
                'Historial de Consultas Recientes:',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
              ),
              const SizedBox(height: 8),
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _history.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final item = _history[index];
                  return ListTile(
                    tileColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: Colors.grey.shade200),
                    ),
                    leading: const CircleAvatar(
                      backgroundColor: Colors.blueGrey,
                      child: Icon(Icons.description_outlined, color: Colors.white, size: 18),
                    ),
                    title: Text(item['comando'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    subtitle: Text(item['resumen'] as String, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12)),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                    onTap: () {
                      if (item['url_archivo'] != null) {
                        _mostrarInfoArchivo(item['url_archivo'] as String?);
                      }
                    },
                  );
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}
