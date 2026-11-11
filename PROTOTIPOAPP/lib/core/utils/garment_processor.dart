import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

class ProcessedGarment {
  final ui.Image image;
  final double width;
  final double height;
  final double aspectRatio;

  ProcessedGarment({
    required this.image,
    required this.width,
    required this.height,
  }) : aspectRatio = (width > 0 && height > 0) ? (width / height) : 0.85;
}

class GarmentProcessor {
  static final Map<String, ProcessedGarment> _cache = {};

  /// Carga y elimina el 100% del fondo blanco/gris de estudio de la prenda,
  /// dejando únicamente la silueta de la ropa con transparencia perfecta.
  static Future<ProcessedGarment?> processGarment(String imagePathOrUrl) async {
    if (_cache.containsKey(imagePathOrUrl)) {
      return _cache[imagePathOrUrl];
    }

    try {
      Uint8List rawBytes;
      if (imagePathOrUrl.startsWith('http://') || imagePathOrUrl.startsWith('https://')) {
        final res = await http.get(Uri.parse(imagePathOrUrl)).timeout(const Duration(seconds: 10));
        if (res.statusCode != 200) return null;
        rawBytes = res.bodyBytes;
      } else {
        final data = await rootBundle.load(imagePathOrUrl);
        rawBytes = data.buffer.asUint8List();
      }

      final codec = await ui.instantiateImageCodec(rawBytes);
      final frame = await codec.getNextFrame();
      final origImg = frame.image;

      final w = origImg.width;
      final h = origImg.height;

      final byteData = await origImg.toByteData(format: ui.ImageByteFormat.rawRgba);
      if (byteData == null) return null;

      final pixels = Uint8List.fromList(
        byteData.buffer.asUint8List(byteData.offsetInBytes, byteData.lengthInBytes),
      );

      int idx(int x, int y) => (y * w + x) * 4;

      // 1. Muestreo de las 4 esquinas y bordes
      int rSum = 0, gSum = 0, bSum = 0, samples = 0;
      for (int x = 0; x < w; x += 4) {
        final iTop = idx(x, 0);
        final iBottom = idx(x, h - 1);
        rSum += pixels[iTop] + pixels[iBottom];
        gSum += pixels[iTop + 1] + pixels[iBottom + 1];
        bSum += pixels[iTop + 2] + pixels[iBottom + 2];
        samples += 2;
      }
      for (int y = 0; y < h; y += 4) {
        final iLeft = idx(0, y);
        final iRight = idx(w - 1, y);
        rSum += pixels[iLeft] + pixels[iRight];
        gSum += pixels[iLeft + 1] + pixels[iRight + 1];
        bSum += pixels[iLeft + 2] + pixels[iRight + 2];
        samples += 2;
      }

      final bgR = samples > 0 ? (rSum / samples).round() : 255;
      final bgG = samples > 0 ? (gSum / samples).round() : 255;
      final bgB = samples > 0 ? (bSum / samples).round() : 255;

      final visited = Uint8List(w * h);
      final queue = <int>[];

      void enqueue(int x, int y) {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        final p = y * w + x;
        if (visited[p] == 1) return;
        visited[p] = 1;
        queue.add(p);
      }

      // Encolar los 4 perímetros exteriores
      for (int x = 0; x < w; x++) {
        enqueue(x, 0);
        enqueue(x, h - 1);
      }
      for (int y = 0; y < h; y++) {
        enqueue(0, y);
        enqueue(w - 1, y);
      }

      // 2. Flood Fill inteligente para vaciar el fondo continuo
      int head = 0;
      while (head < queue.length) {
        final p = queue[head++];
        final x = p % w;
        final y = p ~/ w;
        final pi = p * 4;

        final r = pixels[pi];
        final g = pixels[pi + 1];
        final b = pixels[pi + 2];
        final a = pixels[pi + 3];

        if (a < 10) {
          enqueue(x + 1, y);
          enqueue(x - 1, y);
          enqueue(x, y + 1);
          enqueue(x, y - 1);
          continue;
        }

        final dr = r - bgR;
        final dg = g - bgG;
        final db = b - bgB;
        final distSq = dr * dr + dg * dg + db * db;

        // Criterio de fondo: fondo blanco / neutro / estudio
        final isWhiteOrGray = r > 165 && g > 165 && b > 165 && (r - g).abs() < 35 && (r - b).abs() < 35;
        final isBgMatch = distSq < (75 * 75) || isWhiteOrGray;

        if (isBgMatch) {
          pixels[pi + 3] = 0; // Transparente
          enqueue(x + 1, y);
          enqueue(x - 1, y);
          enqueue(x, y + 1);
          enqueue(x, y - 1);
        }
      }

      // 3. Si la imagen NO tiene transparencia nativa, aplicar barrido de seguridad
      int transparentCount = 0;
      for (int i = 3; i < pixels.length; i += 16) {
        if (pixels[i] < 10) transparentCount++;
      }
      final bool alreadyTransparent = transparentCount > 50;

      if (!alreadyTransparent) {
        for (int y = 0; y < h; y++) {
          for (int x = 0; x < w; x++) {
            final pi = idx(x, y);
            final r = pixels[pi];
            final g = pixels[pi + 1];
            final b = pixels[pi + 2];
            // Si es blanco o gris muy claro de fondo de estudio aislado
            if (r > 235 && g > 235 && b > 235 && (r - g).abs() < 15 && (r - b).abs() < 15) {
              pixels[pi + 3] = 0;
            }
          }
        }
      }

      // 4. Bounding Box ajustada a la prenda
      int minX = w, minY = h, maxX = 0, maxY = 0;
      bool hasGarment = false;

      for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) {
          final a = pixels[idx(x, y) + 3];
          if (a > 25) {
            hasGarment = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (!hasGarment || maxX <= minX || maxY <= minY) {
        minX = 0;
        minY = 0;
        maxX = w - 1;
        maxY = h - 1;
      } else {
        minX = (minX - 2).clamp(0, w - 1);
        minY = (minY - 2).clamp(0, h - 1);
        maxX = (maxX + 2).clamp(0, w - 1);
        maxY = (maxY + 2).clamp(0, h - 1);
      }

      final cropW = maxX - minX + 1;
      final cropH = maxY - minY + 1;
      final cropPixels = Uint8List(cropW * cropH * 4);

      for (int y = 0; y < cropH; y++) {
        final srcY = minY + y;
        for (int x = 0; x < cropW; x++) {
          final srcX = minX + x;
          final srcPi = idx(srcX, srcY);
          final dstPi = (y * cropW + x) * 4;

          cropPixels[dstPi] = pixels[srcPi];
          cropPixels[dstPi + 1] = pixels[srcPi + 1];
          cropPixels[dstPi + 2] = pixels[srcPi + 2];
          cropPixels[dstPi + 3] = pixels[srcPi + 3];
        }
      }

      final completer = Completer<ui.Image>();
      ui.decodeImageFromPixels(
        cropPixels,
        cropW,
        cropH,
        ui.PixelFormat.rgba8888,
        (img) => completer.complete(img),
      );

      final cleanImage = await completer.future;
      final processed = ProcessedGarment(
        image: cleanImage,
        width: cropW.toDouble(),
        height: cropH.toDouble(),
      );

      _cache[imagePathOrUrl] = processed;
      return processed;
    } catch (e) {
      debugPrint('Error en GarmentProcessor: $e');
      return null;
    }
  }
}
