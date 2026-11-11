import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class AiAssistantScreen extends StatefulWidget {
  const AiAssistantScreen({super.key});

  @override
  State<AiAssistantScreen> createState() => _AiAssistantScreenState();
}

class _ChatMessage {
  final String text;
  final bool isUser;
  final List<String>? recommendations;

  _ChatMessage({required this.text, required this.isUser, this.recommendations});
}

class _AiAssistantScreenState extends State<AiAssistantScreen> {
  final _inputController = TextEditingController();
  final List<_ChatMessage> _messages = [
    _ChatMessage(
      text: '¡Hola! Soy tu asistente de moda con Inteligencia Artificial de Tienda VRA. ¿Para qué ocasión o temporada buscas prendas hoy?',
      isUser: false,
      recommendations: [
        'Polera Básica Cuello Redondo Algodón Pima (Negro)',
        'Polerón Canguro Hoodie Urbano con Capucha (Azul marino)',
        'Sudadera Canguro Fleece Oversized (Gris)',
      ],
    ),
  ];

  void _sendQuery(String query) {
    if (query.trim().isEmpty) return;

    setState(() {
      _messages.add(_ChatMessage(text: query, isUser: true));
      _inputController.clear();
    });

    Future.delayed(const Duration(milliseconds: 800), () {
      if (!mounted) return;
      String reply = 'Excelente elección. Analizando tu estilo y existencias disponibles en sucursales...';
      List<String> recs = [];

      final qLower = query.toLowerCase();
      if (qLower.contains('invierno') || qLower.contains('frio') || qLower.contains('abrigo')) {
        reply = 'Para clima frío te sugiero combinar la Parka Invierno Impermeable con un Pantalón Sastre de Lana.';
        recs = ['Parka Invierno Impermeable (Negro)', 'Pantalón Sastre Lana (Gris)'];
      } else if (qLower.contains('fiesta') || qLower.contains('reunion') || qLower.contains('trabajo')) {
        reply = 'Para ocasiones formales o de trabajo, el look recomendado es Pantalón Sastre con Polera Pima Cuello Alto.';
        recs = ['Pantalón Sastre Lana', 'Polera Pima Cuello Alto (Blanco)'];
      } else {
        reply = 'Basado en las tendencias de la temporada actual y tu historial de navegación, te sugiero:';
        recs = ['Polera Rayada Manga Larga (Jeans)', 'Jean Slim Tacto Denim (Negro)'];
      }

      setState(() {
        _messages.add(_ChatMessage(text: reply, isUser: false, recommendations: recs));
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.auto_awesome, color: AppTheme.accentGold, size: 20),
            SizedBox(width: 8),
            Text('Asistente IA de Moda'),
          ],
        ),
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: AppTheme.primaryLight,
            child: const Row(
              children: [
                Icon(Icons.info_outline, color: Colors.white70, size: 16),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Recomendador generativo entrenado con el catálogo de Tienda VRA.',
                    style: TextStyle(color: Colors.white70, fontSize: 11),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final m = _messages[index];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Column(
                    crossAxisAlignment: m.isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: m.isUser ? AppTheme.accent : Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: m.isUser ? null : Border.all(color: AppTheme.cardBorder),
                        ),
                        child: Text(
                          m.text,
                          style: TextStyle(
                            color: m.isUser ? Colors.white : AppTheme.textPrimary,
                            fontSize: 14,
                          ),
                        ),
                      ),
                      if (m.recommendations != null && m.recommendations!.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: m.recommendations!.map((rec) {
                            return Chip(
                              backgroundColor: const Color(0xFFF1F5F9),
                              avatar: const Icon(Icons.checkroom, size: 14, color: AppTheme.accent),
                              label: Text(rec, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                            );
                          }).toList(),
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
          ),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: AppTheme.cardBorder)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _inputController,
                    decoration: const InputDecoration(
                      hintText: 'Pregúntale a la IA (ej. ¿Qué uso para una fiesta?)',
                      contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    ),
                    onSubmitted: _sendQuery,
                  ),
                ),
                const SizedBox(width: 8),
                CircleAvatar(
                  backgroundColor: AppTheme.primary,
                  child: IconButton(
                    icon: const Icon(Icons.send, color: Colors.white, size: 18),
                    onPressed: () => _sendQuery(_inputController.text),
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
