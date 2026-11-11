import 'dart:math' as math;
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:google_mlkit_pose_detection/google_mlkit_pose_detection.dart';
import '../../core/theme/app_theme.dart';
import '../../models/product_model.dart';
import '../../core/network/api_client.dart';
import '../../core/constants/api_constants.dart';
import '../../core/utils/product_media_helper.dart';
import '../../core/utils/garment_processor.dart';

enum ModoAjusteRa { automatico, manual }
enum EstiloAjusteRa { slim, regular, oversize, maxiBaggy }

class VirtualFittingScreen extends StatefulWidget {
  final ProductModel product;
  const VirtualFittingScreen({super.key, required this.product});

  @override
  State<VirtualFittingScreen> createState() => _VirtualFittingScreenState();
}

class _VirtualFittingScreenState extends State<VirtualFittingScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late AnimationController _animController;

  // Controlador de Cámara de Hardware
  List<CameraDescription> _cameras = [];
  CameraController? _cameraController;
  bool _isCameraInitialized = false;
  int _selectedCameraIndex = 0;
  bool _cameraPermissionDenied = false;

  // Detector de Pose de Inteligencia Artificial (MediaPipe / ML Kit)
  late final PoseDetector _poseDetector;
  bool _isDetecting = false;
  DateTime _lastPoseCheck = DateTime.now();
  bool _poseDetected = false;

  // Coordenadas detectadas en tiempo real y suavizado
  double _targetPoseX = 0.0;
  double _targetPoseY = -120.0;
  double _targetPoseAngle = 0.0;
  double _targetPoseShoulderWidthPx = 200.0;

  double _currPoseX = 0.0;
  double _currPoseY = -120.0;
  double _currPoseAngle = 0.0;
  double _currPoseShoulderWidthPx = 200.0;

  // Prenda Procesada Inteligente (Fondo blanco eliminado como en la web)
  ProcessedGarment? _processedGarment;
  bool _loadingGarment = true;

  // Modos de ajuste
  EstiloAjusteRa _estiloAjuste = EstiloAjusteRa.regular;
  String _currentSize = 'L';
  String _currentColor = 'Negro';
  bool _mostrarEsqueleto = true;

  // Ajustes de Calce y Gestos Táctiles Fluídos
  double _panX = 0.0;
  double _panY = 0.0;
  double _scaleFactorGesture = 1.0;
  double _baseScaleGesture = 1.0;

  final double _opacidad = 0.98;

  // Datos biométricos calculados (calibrados con la web)
  int _hombrosCm = 42;
  int _torsoCm = 76;

  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    _poseDetector = PoseDetector(
      options: PoseDetectorOptions(
        mode: PoseDetectionMode.stream,
        model: PoseDetectionModel.base,
      ),
    );

    if (widget.product.tallas.isNotEmpty) {
      if (widget.product.tallas.contains('L')) {
        _currentSize = 'L';
      } else {
        _currentSize = widget.product.tallas.first;
      }
    }

    if (widget.product.colores.isNotEmpty) {
      _currentColor = widget.product.colores.first;
    }

    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);

    // Inicializar Cámara Real y Cargar Prenda Recortada
    _initCamera();
    _loadAndProcessGarment();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final cameraController = _cameraController;
    if (cameraController == null) return;

    if (state == AppLifecycleState.inactive || state == AppLifecycleState.paused) {
      if (mounted) {
        setState(() {
          _isCameraInitialized = false;
        });
      }
      cameraController.stopImageStream().catchError((_) {});
      cameraController.dispose().then((_) {
        if (mounted) {
          setState(() {
            _cameraController = null;
          });
        }
      }).catchError((_) {});
    } else if (state == AppLifecycleState.resumed) {
      if (_cameras.isNotEmpty) {
        _startCameraController(_cameras[_selectedCameraIndex]);
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _animController.dispose();
    _cameraController?.stopImageStream().catchError((_) {});
    _cameraController?.dispose();
    _poseDetector.close();
    super.dispose();
  }

  // Inicialización de la Cámara Frontal / Trasera
  Future<void> _initCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) {
        if (mounted) setState(() => _cameraPermissionDenied = true);
        return;
      }

      // Iniciar preferentemente con cámara frontal para efecto selfie
      final frontIdx = _cameras.indexWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
      );
      _selectedCameraIndex = frontIdx != -1 ? frontIdx : 0;

      await _startCameraController(_cameras[_selectedCameraIndex]);
    } catch (e) {
      debugPrint('Error al inicializar cámara: $e');
      if (mounted) setState(() => _cameraPermissionDenied = true);
    }
  }

  Future<void> _startCameraController(CameraDescription cameraDescription) async {
    final prev = _cameraController;
    final controller = CameraController(
      cameraDescription,
      ResolutionPreset.medium,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.nv21,
    );

    if (prev != null) {
      await prev.stopImageStream().catchError((_) {});
      await prev.dispose().catchError((_) {});
    }

    try {
      await controller.initialize();
      if (mounted) {
        setState(() {
          _cameraController = controller;
          _isCameraInitialized = true;
          _cameraPermissionDenied = false;
        });

        // Iniciar flujo de imágenes para detección de postura por IA
        controller.startImageStream(_onCameraImage);
      }
    } catch (e) {
      debugPrint('Error al configurar CameraController: $e');
    }
  }

  void _onCameraImage(CameraImage image) async {
    if (_isDetecting || _cameraController == null || !_isCameraInitialized) return;
    final now = DateTime.now();
    if (now.difference(_lastPoseCheck).inMilliseconds < 65) return; // ~15 FPS
    _lastPoseCheck = now;
    _isDetecting = true;

    try {
      final inputImage = _inputImageFromCameraImage(image);
      if (inputImage == null) {
        _isDetecting = false;
        return;
      }

      final poses = await _poseDetector.processImage(inputImage);
      if (!mounted) return;

      if (poses.isNotEmpty) {
        final pose = poses.first;
        final leftShoulder = pose.landmarks[PoseLandmarkType.leftShoulder];
        final rightShoulder = pose.landmarks[PoseLandmarkType.rightShoulder];

        if (leftShoulder != null &&
            rightShoulder != null &&
            leftShoulder.likelihood > 0.35 &&
            rightShoulder.likelihood > 0.35) {
          final isFront =
              _cameras[_selectedCameraIndex].lensDirection == CameraLensDirection.front;

          final orientation = _cameras[_selectedCameraIndex].sensorOrientation;
          final bool isRotated = (orientation == 90 || orientation == 270);
          final imgW = isRotated ? image.height.toDouble() : image.width.toDouble();
          final imgH = isRotated ? image.width.toDouble() : image.height.toDouble();

          final lsX = leftShoulder.x;
          final lsY = leftShoulder.y;
          final rsX = rightShoulder.x;
          final rsY = rightShoulder.y;

          final midX = (lsX + rsX) / 2.0;
          final midY = (lsY + rsY) / 2.0;

          // Vector horizontal entre hombros para calcular la inclinación natural:
          final dx = lsX - rsX;
          final dy = lsY - rsY;

          // Inclinación respecto a la horizontal (0 = recto)
          double angle = math.atan2(dy, dx);
          if (isFront) {
            angle = -angle;
          }
          // Limitar a rango natural anatómico [-25°, +25°]
          angle = angle.clamp(-0.45, 0.45);

          // Ancho de hombros detectado en píxeles de cámara
          final distPx = math.sqrt(dx * dx + dy * dy);

          final screenSize = MediaQuery.of(context).size;
          // Mapeo normalizado a la pantalla móvil
          final normX = isFront ? (1.0 - (midX / imgW)) : (midX / imgW);
          final normY = (midY / imgH);

          // Coordenadas en píxeles de pantalla centradas en el cuello/clavícula
          final targetX = (normX - 0.5) * screenSize.width;
          final targetY = (normY - 0.5) * screenSize.height;

          // Distancia de hombros proporcional proyectada en pantalla
          final shoulderPxOnScreen = (distPx / imgW) * screenSize.width;

          final hombrosCm = ((distPx / imgW) * 92.0).clamp(34.0, 56.0).round();
          final torsoCm = (hombrosCm * 1.88).round();

          String recommended = 'L';
          if (hombrosCm < 39) {
            recommended = 'S';
          } else if (hombrosCm < 43) {
            recommended = 'M';
          } else if (hombrosCm < 48) {
            recommended = 'L';
          } else if (hombrosCm < 53) {
            recommended = 'XL';
          } else {
            recommended = 'XXL';
          }

          if (mounted) {
            setState(() {
              _poseDetected = true;
              _targetPoseX = targetX;
              _targetPoseY = targetY;
              _targetPoseAngle = angle;
              _targetPoseShoulderWidthPx = shoulderPxOnScreen;
              _hombrosCm = hombrosCm;
              _torsoCm = torsoCm;
              _recommendedSize = recommended;
            });
          }
        }
      }
    } catch (_) {
    } finally {
      _isDetecting = false;
    }
  }

  String _recommendedSize = 'L';
  String get recommendedSize => _recommendedSize;

  InputImage? _inputImageFromCameraImage(CameraImage image) {
    final camera = _cameras[_selectedCameraIndex];
    final sensorOrientation = camera.sensorOrientation;

    final rotation = InputImageRotationValue.fromRawValue(sensorOrientation) ??
        InputImageRotation.rotation0deg;

    final format = InputImageFormatValue.fromRawValue(image.format.raw) ??
        InputImageFormat.nv21;

    final allBytes = Uint8List(
      image.planes.fold(0, (count, plane) => count + plane.bytes.length),
    );
    int offset = 0;
    for (final plane in image.planes) {
      allBytes.setRange(offset, offset + plane.bytes.length, plane.bytes);
      offset += plane.bytes.length;
    }

    return InputImage.fromBytes(
      bytes: allBytes,
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format: format,
        bytesPerRow: image.planes.first.bytesPerRow,
      ),
    );
  }

  Future<void> _loadAndProcessGarment() async {
    setState(() => _loadingGarment = true);
    final ruta = ProductMediaHelper.resolverRuta(
      codigo: widget.product.codigo,
      nombre: widget.product.nombre,
      imagenPrincipal: widget.product.imagenPrincipal,
      color: _currentColor,
    );
    if (ruta != null) {
      final processed = await GarmentProcessor.processGarment(ruta);
      if (mounted) {
        setState(() {
          _processedGarment = processed;
          _loadingGarment = false;
        });
      }
    } else {
      if (mounted) setState(() => _loadingGarment = false);
    }
  }

  Future<void> _toggleCamera() async {
    if (_cameras.length < 2) return;
    _selectedCameraIndex = (_selectedCameraIndex + 1) % _cameras.length;
    await _startCameraController(_cameras[_selectedCameraIndex]);
  }

  // Factor de escala según estilo de calce (calibrado con la anatomía y hombros reales)
  double get _factorEstilo {
    switch (_estiloAjuste) {
      case EstiloAjusteRa.slim:
        return 1.15;
      case EstiloAjusteRa.regular:
        return 1.30;
      case EstiloAjusteRa.oversize:
        return 1.48;
      case EstiloAjusteRa.maxiBaggy:
        return 1.68;
    }
  }

  // Factor según la talla seleccionada
  double get _factorTalla {
    switch (_currentSize.toUpperCase()) {
      case 'XS':
        return 0.88;
      case 'S':
        return 0.94;
      case 'M':
        return 1.00;
      case 'L':
        return 1.08;
      case 'XL':
        return 1.18;
      case 'XXL':
      case '2XL':
        return 1.28;
      default:
        return 1.00;
    }
  }

  Future<void> _recordResult(String resultado) async {
    setState(() {
      _isProcessing = true;
    });

    try {
      await ApiClient().post(
        ApiConstants.sesionesRa,
        body: {
          'id_ptc': widget.product.id,
          'medidas_avatar':
              'Hombros:$_hombrosCm cm;Torso:$_torsoCm cm;Talla:$_currentSize;Calce:${_estiloAjuste.name}',
          'resultado': resultado,
        },
      );
    } catch (_) {}

    if (mounted) {
      setState(() => _isProcessing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Icon(
                resultado == 'Gusta'
                    ? Icons.check_circle
                    : Icons.thumb_down_alt_rounded,
                color: Colors.white,
                size: 20,
              ),
              const SizedBox(width: 8),
              Text('Prueba guardada: "$resultado"'),
            ],
          ),
          backgroundColor:
              resultado == 'Gusta' ? AppTheme.success : AppTheme.primary,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }

  @override
  void didUpdateWidget(covariant VirtualFittingScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.product.id != widget.product.id ||
        oldWidget.product.imagenPrincipal != widget.product.imagenPrincipal) {
      _loadAndProcessGarment();
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;

    return Scaffold(
      backgroundColor: const Color(0xFF0B0F19),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Visor de Cámara Real y Prenda Ceñida Transparente
          _buildRaViewport(p),

          // 2. Header Superior
          _buildHeader(context, p),

          // 3. Panel Inferior de Ajustes y Biometría
          _buildBottomPanel(p),
        ],
      ),
    );
  }

  // --- VIEWPORT RA LIMPIO, TRANSPARENTE Y CON AJUSTE AUTOMÁTICO IA ---
  Widget _buildRaViewport(ProductModel p) {
    final screenSize = MediaQuery.of(context).size;
    final baseCollarY = -screenSize.height * 0.14;

    return AnimatedBuilder(
      animation: _animController,
      builder: (context, child) {
        final breathing = math.sin(_animController.value * math.pi) * 0.008;

        // Suavizado temporal exponencial (Lerp) idéntico a la web para seguimiento fluido
        if (_poseDetected) {
          _currPoseX += (_targetPoseX - _currPoseX) * 0.38;
          _currPoseY += (_targetPoseY - _currPoseY) * 0.38;
          _currPoseAngle += (_targetPoseAngle - _currPoseAngle) * 0.38;
          _currPoseShoulderWidthPx +=
              (_targetPoseShoulderWidthPx - _currPoseShoulderWidthPx) * 0.38;
        } else {
          _currPoseX += (0.0 - _currPoseX) * 0.15;
          _currPoseY += (baseCollarY - _currPoseY) * 0.15;
          _currPoseAngle += (0.0 - _currPoseAngle) * 0.15;
          _currPoseShoulderWidthPx +=
              ((screenSize.width * 0.52) - _currPoseShoulderWidthPx) * 0.15;
        }

        final dynamicTilt = _currPoseAngle + math.sin(_animController.value * math.pi * 2) * 0.004;

        // Ancho de la prenda: cubre ambos hombros y se extiende a los brazos (igual que en web)
        final hombrosPx = _currPoseShoulderWidthPx;
        final garmentWidth =
            (hombrosPx * _factorEstilo * _factorTalla * _scaleFactorGesture) + (breathing * 20);
        final garmentHeight = garmentWidth / (_processedGarment?.aspectRatio ?? 0.82);
        final cuelloOffset = garmentHeight * 0.08;

        final finalAngle = dynamicTilt;
        final finalX = _currPoseX + _panX;
        final finalY = _currPoseY + _panY;

        return GestureDetector(
          behavior: HitTestBehavior.translucent,
          onDoubleTap: () {
            // Doble toque: Re-centrar IA automático
            setState(() {
              _panX = 0;
              _panY = 0;
              _scaleFactorGesture = 1.0;
            });
          },
          onScaleStart: (details) {
            _baseScaleGesture = _scaleFactorGesture;
          },
          onScaleUpdate: (details) {
            setState(() {
              _panX += details.focalPointDelta.dx;
              _panY += details.focalPointDelta.dy;
              if (details.scale != 1.0) {
                _scaleFactorGesture = (_baseScaleGesture * details.scale).clamp(0.6, 2.5);
              }
            });
          },
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Vista en Vivo del Sensor de la Cámara Real
              if (_isCameraInitialized && _cameraController != null && _cameraController!.value.isInitialized)
                Positioned.fill(
                  child: FittedBox(
                    fit: BoxFit.cover,
                    child: SizedBox(
                      width: _cameraController!.value.previewSize?.height ?? 1,
                      height: _cameraController!.value.previewSize?.width ?? 1,
                      child: CameraPreview(_cameraController!),
                    ),
                  ),
                )
              else
                // Fondo de carga / permiso
                Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Color(0xFF0F172A),
                        Color(0xFF1E293B),
                        Color(0xFF090D16),
                      ],
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                    ),
                  ),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (_cameraPermissionDenied) ...[
                          const Icon(Icons.camera_alt_outlined, color: Colors.amber, size: 40),
                          const SizedBox(height: 10),
                          const Text(
                            'Acceso a cámara requerido',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 10),
                          ElevatedButton(
                            onPressed: _initCamera,
                            child: const Text('Conceder Permiso'),
                          ),
                        ] else ...[
                          const CircularProgressIndicator(color: Color(0xFF10B981)),
                          const SizedBox(height: 12),
                          const Text(
                            'Iniciando sensor de cámara…',
                            style: TextStyle(color: Colors.white70, fontSize: 12),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),

              // Esqueleto Biométrico (Si está activo)
              if (_mostrarEsqueleto)
                Positioned.fill(
                  child: CustomPaint(
                    painter: _SkeletonPainter(
                      tiltAngle: dynamicTilt,
                      shouldersWidthPx: hombrosPx,
                      centerXOffset: finalX,
                      centerYOffset: finalY,
                    ),
                  ),
                ),

              // Prenda Superpuesta Ceñida Transparente Sin Fondo (Estilo Web)
              Transform.translate(
                offset: Offset(finalX, finalY + (garmentHeight / 2) - cuelloOffset),
                child: Transform.rotate(
                  angle: finalAngle,
                  child: Opacity(
                    opacity: _opacidad.clamp(0.2, 1.0),
                    child: _buildGarmentDisplay(garmentWidth, garmentHeight),
                  ),
                ),
              ),

              // Tarjeta Superior Flotante de Recomendación Inteligente (Estilo Web)
              Positioned(
                top: 85,
                left: 14,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A).withValues(alpha: 0.88),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.5)),
                    boxShadow: const [
                      BoxShadow(color: Colors.black45, blurRadius: 10, offset: Offset(0, 3)),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.auto_awesome, color: Color(0xFF10B981), size: 13),
                          const SizedBox(width: 5),
                          Text(
                            'Talla Recomendada: $_recommendedSize',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'Hombros: ~$_hombrosCm cm  •  Torso: ~$_torsoCm cm',
                        style: const TextStyle(
                          color: Color(0xFF34D399),
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              Positioned(
                top: 85,
                right: 14,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: _poseDetected
                        ? const Color(0xFF10B981).withValues(alpha: 0.25)
                        : Colors.black54,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: _poseDetected
                          ? const Color(0xFF10B981)
                          : Colors.white24,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: _poseDetected ? const Color(0xFF10B981) : Colors.amber,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        _poseDetected ? 'Cuerpo Detectado' : 'Buscando Cuerpo…',
                        style: TextStyle(
                          color: _poseDetected ? const Color(0xFF10B981) : Colors.amber,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // Renderizado de la Prenda Recortada (Transparente sin caja blanca)
  Widget _buildGarmentDisplay(double width, double height) {
    if (_processedGarment != null) {
      return RawImage(
        image: _processedGarment!.image,
        width: width,
        height: height,
        fit: BoxFit.fill,
        filterQuality: FilterQuality.high,
      );
    }

    return SizedBox(
      width: width,
      height: height,
      child: const Center(
        child: CircularProgressIndicator(
          color: Color(0xFF10B981),
          strokeWidth: 2,
        ),
      ),
    );
  }

  // --- HEADER ---
  Widget _buildHeader(BuildContext context, ProductModel p) {
    return SafeArea(
      child: Align(
        alignment: Alignment.topCenter,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              CircleAvatar(
                backgroundColor: Colors.black54,
                radius: 18,
                child: IconButton(
                  icon: const Icon(Icons.arrow_back, color: Colors.white, size: 18),
                  onPressed: () => Navigator.pop(context),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.black87,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white24),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.view_in_ar, color: Color(0xFF10B981), size: 15),
                    SizedBox(width: 6),
                    Text(
                      'VESTIDOR VIRTUAL RA',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
              Row(
                children: [
                  CircleAvatar(
                    backgroundColor: Colors.black54,
                    radius: 16,
                    child: IconButton(
                      icon: const Icon(Icons.flip_camera_ios, color: Colors.white, size: 16),
                      padding: EdgeInsets.zero,
                      onPressed: _toggleCamera,
                      tooltip: 'Cambiar cámara',
                    ),
                  ),
                  const SizedBox(width: 6),
                  GestureDetector(
                    onTap: () => setState(() => _mostrarEsqueleto = !_mostrarEsqueleto),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
                      decoration: BoxDecoration(
                        color: _mostrarEsqueleto
                            ? const Color(0xFF10B981).withOpacity(0.2)
                            : Colors.black54,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: _mostrarEsqueleto
                              ? const Color(0xFF10B981)
                              : Colors.white24,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.timeline,
                            color: _mostrarEsqueleto
                                ? const Color(0xFF10B981)
                                : Colors.white60,
                            size: 13,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _mostrarEsqueleto ? 'ON' : 'OFF',
                            style: TextStyle(
                              color: _mostrarEsqueleto
                                  ? const Color(0xFF10B981)
                                  : Colors.white60,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // --- PANEL INFERIOR MINIMALISTA ESTILO WEB ---
  Widget _buildBottomPanel(ProductModel p) {
    return Align(
      alignment: Alignment.bottomCenter,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A).withOpacity(0.92),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          border: Border(top: BorderSide(color: Colors.white.withOpacity(0.12))),
          boxShadow: const [
            BoxShadow(color: Colors.black54, blurRadius: 15, offset: Offset(0, -3)),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Fila 1: Estilos de Calce
            Row(
              children: [
                _buildFitChip('Slim', EstiloAjusteRa.slim),
                const SizedBox(width: 6),
                _buildFitChip('Regular', EstiloAjusteRa.regular),
                const SizedBox(width: 6),
                _buildFitChip('Oversize', EstiloAjusteRa.oversize),
                const SizedBox(width: 6),
                _buildFitChip('Baggy', EstiloAjusteRa.maxiBaggy),
              ],
            ),
            const SizedBox(height: 10),

            // Fila 2: Tallas
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Talla:',
                  style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold),
                ),
                Row(
                  children: ['S', 'M', 'L', 'XL', 'XXL'].map((t) {
                    final isSel = t == _currentSize;
                    return GestureDetector(
                      onTap: () => setState(() => _currentSize = t),
                      child: Container(
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: isSel ? const Color(0xFF10B981) : Colors.white.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          t,
                          style: TextStyle(
                            color: isSel ? Colors.black : Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
            if (widget.product.colores.isNotEmpty) ...[
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Color:',
                    style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                  Row(
                    children: widget.product.colores.map((c) {
                      final isSel = c.toLowerCase() == _currentColor.toLowerCase();
                      return GestureDetector(
                        onTap: () {
                          setState(() => _currentColor = c);
                          _loadAndProcessGarment();
                        },
                        child: Container(
                          margin: const EdgeInsets.symmetric(horizontal: 3),
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: isSel ? const Color(0xFF10B981) : Colors.white.withOpacity(0.08),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            c,
                            style: TextStyle(
                              color: isSel ? Colors.black : Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 12),

            // Fila 3: Acciones de Feedback
            Row(
              children: [
                Expanded(
                  flex: 1,
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white70,
                      side: BorderSide(color: Colors.white.withOpacity(0.2)),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () => _recordResult('No gusta'),
                    child: const Text('👎 No gusta', style: TextStyle(fontSize: 12)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    icon: _isProcessing
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2),
                          )
                        : const Icon(Icons.thumb_up, size: 15, color: Colors.black),
                    label: const Text('¡Me gusta! (Probar)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900)),
                    onPressed: _isProcessing ? null : () => _recordResult('Gusta'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFitChip(String label, EstiloAjusteRa estilo) {
    final isSel = _estiloAjuste == estilo;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _estiloAjuste = estilo),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 6),
          decoration: BoxDecoration(
            color: isSel ? const Color(0xFF2563EB) : const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isSel ? const Color(0xFF3B82F6) : Colors.white12,
            ),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isSel ? Colors.white : Colors.white70,
              fontSize: 11,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }
}

// Painter para el Esqueleto Biométrico RA en Flutter
class _SkeletonPainter extends CustomPainter {
  final double tiltAngle;
  final double shouldersWidthPx;
  final double centerXOffset;
  final double centerYOffset;

  _SkeletonPainter({
    required this.tiltAngle,
    required this.shouldersWidthPx,
    required this.centerXOffset,
    required this.centerYOffset,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2 + centerXOffset;
    final cy = size.height / 2 + centerYOffset;

    final halfW = shouldersWidthPx / 2;
    final cosA = math.cos(tiltAngle);
    final sinA = math.sin(tiltAngle);

    // Hombro Izquierdo y Derecho
    final leftX = cx - halfW * cosA;
    final leftY = cy - halfW * sinA;
    final rightX = cx + halfW * cosA;
    final rightY = cy + halfW * sinA;

    // Cuello y Cintura anatómicos proporcionales
    final neckX = cx + (shouldersWidthPx * 0.16) * sinA;
    final neckY = cy - (shouldersWidthPx * 0.20) * cosA;
    final waistX = cx - (shouldersWidthPx * 0.35) * sinA;
    final waistY = cy + (shouldersWidthPx * 1.30) * cosA;

    final linePaint = Paint()
      ..color = const Color(0xFF10B981)
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke;

    final glowPaint = Paint()
      ..color = const Color(0xFF10B981).withValues(alpha: 0.35)
      ..strokeWidth = 6.0
      ..style = PaintingStyle.stroke;

    // Línea de hombros
    canvas.drawLine(Offset(leftX, leftY), Offset(rightX, rightY), glowPaint);
    canvas.drawLine(Offset(leftX, leftY), Offset(rightX, rightY), linePaint);

    // Columna / Torso
    final spinePaint = Paint()
      ..color = const Color(0xFF34D399).withValues(alpha: 0.65)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    canvas.drawLine(Offset(neckX, neckY), Offset(cx, cy), spinePaint);
    canvas.drawLine(Offset(cx, cy), Offset(waistX, waistY), spinePaint);

    // Nodos articulares con brillo
    void drawNode(double x, double y, Color col) {
      canvas.drawCircle(
          Offset(x, y), 7.0, Paint()..color = col.withValues(alpha: 0.4));
      canvas.drawCircle(Offset(x, y), 4.5, Paint()..color = col);
      canvas.drawCircle(
          Offset(x, y),
          4.5,
          Paint()
            ..color = Colors.white
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.2);
    }

    drawNode(leftX, leftY, const Color(0xFF10B981));
    drawNode(rightX, rightY, const Color(0xFF10B981));
    drawNode(neckX, neckY, const Color(0xFF34D399));
    drawNode(cx, cy, const Color(0xFF6EE7B7));
    drawNode(waistX, waistY, const Color(0xFF059669));
  }

  @override
  bool shouldRepaint(covariant _SkeletonPainter oldDelegate) {
    return oldDelegate.tiltAngle != tiltAngle ||
        oldDelegate.shouldersWidthPx != shouldersWidthPx ||
        oldDelegate.centerXOffset != centerXOffset ||
        oldDelegate.centerYOffset != centerYOffset;
  }
}
