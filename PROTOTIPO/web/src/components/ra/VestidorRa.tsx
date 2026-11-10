import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  ImagePlus,
  Loader2,
  RefreshCw,
  RotateCcw,
  Ruler,
  ScanLine,
  Scissors,
  ShieldAlert,
  Sparkles,
  Sliders,
  ThumbsDown,
  ThumbsUp,
  Wand2,
  X,
} from 'lucide-react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { api, ApiError, type RespuestaSesionRa } from '@/lib/api.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { cn } from '@/lib/utils.js';
import { Button } from '@/components/ui/Button.js';
import { Badge } from '@/components/ui/Badge.js';
import { Input } from '@/components/ui/Input.js';

const VISION_WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

export interface PrendaVestidorRa {
  id_ptc: number;
  codigo: string;
  nombre: string;
  imagen: string | null;
  talla: string;
  color: string;
  modelo_3d_url: string | null;
}

interface Props {
  abierto: boolean;
  prenda: PrendaVestidorRa | null;
  onCerrar: () => void;
  onReservar: (prenda: PrendaVestidorRa) => void;
}

type EstadoCamara = 'idle' | 'solicitando' | 'activa' | 'denegada' | 'no_disponible';
type ModoAjuste = 'automatico' | 'manual';
type EstiloAjuste = 'ajustado' | 'normal' | 'holgado' | 'extra_holgado';
type TallaPrenda = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

interface Anclas {
  ancho: number;
  alto: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

interface PuntosCuerpo {
  cx: number;
  cy: number;
  anchoHombrosPx: number;
  hombroI: { x: number; y: number };
  hombroD: { x: number; y: number };
  nariz?: { x: number; y: number };
  caderaI?: { x: number; y: number };
  caderaD?: { x: number; y: number };
}

interface PrendaProcesada {
  canvas: HTMLCanvasElement;
  ancho: number;
  alto: number;
  cuelloRelativoY: number;
}

/**
 * Carga una imagen de forma segura con soporte crossOrigin y fallback inmediato.
 */
function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Para URLs externas aplicamos anonymous; para relativas directas no es necesario
    if (url.startsWith('http://') || url.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Fallback secundario si el navegador o firewall bloqueó la petición con CORS
      const fallback = new Image();
      fallback.onload = () => resolve(fallback);
      fallback.onerror = () => reject(new Error('No se pudo cargar la imagen de la prenda.'));
      fallback.src = url;
    };
    img.src = url;
  });
}

/**
 * Recorta inteligentemente el fondo de la prenda (blanco, gris claro o color de catálogo)
 * y ajusta la caja contenedora de forma ceñida (tight bounding box) con suavizado de bordes.
 */
function recortarPrendaInteligente(
  img: HTMLImageElement,
  tolerancia: number,
  activo = true,
): PrendaProcesada {
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = origW;
  tempCanvas.height = origH;
  const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });

  if (!ctx || origW === 0 || origH === 0) {
    return { canvas: tempCanvas, ancho: origW, alto: origH, cuelloRelativoY: 0.12 };
  }

  ctx.drawImage(img, 0, 0);

  if (!activo) {
    return { canvas: tempCanvas, ancho: origW, alto: origH, cuelloRelativoY: 0.12 };
  }

  const imgData = ctx.getImageData(0, 0, origW, origH);
  const px = imgData.data;
  const w = origW;
  const h = origH;

  const idx = (x: number, y: number) => (y * w + x) * 4;

  // 0. Detectar si la imagen ya tiene canal alfa con fondo transparente (ej: PNG de producto de la tienda)
  let pixelesTransparentes = 0;
  const pasoMuestreo = Math.max(4, Math.floor((w * h) / 20000));
  for (let i = 3; i < px.length; i += pasoMuestreo * 4) {
    if (px[i] < 30) pixelesTransparentes++;
  }
  const esPngTransparente = pixelesTransparentes > 10;

  if (esPngTransparente) {
    // La imagen ya tiene fondo transparente. Ajustar directamente la caja contenedora ceñida.
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    let hayPrenda = false;

    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        if (px[idx(x, y) + 3] > 25) {
          hayPrenda = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (hayPrenda && maxX > minX + 20 && maxY > minY + 20) {
      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropW;
      croppedCanvas.height = cropH;
      const cropCtx = croppedCanvas.getContext('2d');
      if (cropCtx) {
        cropCtx.drawImage(tempCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      }
      return { canvas: croppedCanvas, ancho: cropW, alto: cropH, cuelloRelativoY: 0.08 };
    }
    return { canvas: tempCanvas, ancho: origW, alto: origH, cuelloRelativoY: 0.12 };
  }

  // 1. Muestrear los bordes superiores y esquinas para identificar el color de fondo predominante
  // (evitamos el borde inferior porque las prendas de ropa suelen tocar abajo)
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let samples = 0;

  for (let x = 0; x < w; x += 2) {
    rSum += px[idx(x, 0)];
    gSum += px[idx(x, 0) + 1];
    bSum += px[idx(x, 0) + 2];
    samples++;
  }
  for (let y = 0; y < Math.floor(h * 0.4); y += 2) {
    rSum += px[idx(0, y)] + px[idx(w - 1, y)];
    gSum += px[idx(0, y) + 1] + px[idx(w - 1, y) + 1];
    bSum += px[idx(0, y) + 2] + px[idx(w - 1, y) + 2];
    samples += 2;
  }

  const bgR = samples > 0 ? rSum / samples : 255;
  const bgG = samples > 0 ? gSum / samples : 255;
  const bgB = samples > 0 ? bSum / samples : 255;

  const tolFactor = Math.max(12, tolerancia * 1.8);
  const tolSq = tolFactor * tolFactor;

  const visitado = new Uint8Array(w * h);
  const cola: Array<[number, number]> = [];

  const encolar = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const pIndex = y * w + x;
    if (visitado[pIndex]) return;
    visitado[pIndex] = 1;
    cola.push([x, y]);
  };

  for (let x = 0; x < w; x++) {
    encolar(x, 0);
  }
  for (let y = 0; y < Math.floor(h * 0.7); y++) {
    encolar(0, y);
    encolar(w - 1, y);
  }

  let puntero = 0;
  while (puntero < cola.length) {
    const [x, y] = cola[puntero++];
    const pi = idx(x, y);
    const r = px[pi];
    const g = px[pi + 1];
    const b = px[pi + 2];
    const a = px[pi + 3];

    if (a < 15) {
      encolar(x + 1, y);
      encolar(x - 1, y);
      encolar(x, y + 1);
      encolar(x, y - 1);
      continue;
    }

    const dr = r - bgR;
    const dg = g - bgG;
    const db = b - bgB;
    const distSq = dr * dr + dg * dg + db * db;

    const esBlancoEstudio = r > 215 && g > 215 && b > 215;
    const esFondo = distSq <= tolSq || esBlancoEstudio;

    if (esFondo) {
      px[pi + 3] = 0;
      encolar(x + 1, y);
      encolar(x - 1, y);
      encolar(x, y + 1);
      encolar(x, y - 1);
    }
  }

  // 2. Encontrar caja de recorte ceñida
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let hayPrenda = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = px[idx(x, y) + 3];
      if (a > 20) {
        hayPrenda = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Si el recorte eliminó demasiados píxeles o falló, restaurar la foto original para no dejar la prenda invisible
  if (!hayPrenda || maxX <= minX + 30 || maxY <= minY + 30) {
    ctx.clearRect(0, 0, origW, origH);
    ctx.drawImage(img, 0, 0);
    return { canvas: tempCanvas, ancho: origW, alto: origH, cuelloRelativoY: 0.12 };
  }

  // Suavizado anti-alias en bordes
  for (let y = Math.max(1, minY); y <= Math.min(h - 2, maxY); y++) {
    for (let x = Math.max(1, minX); x <= Math.min(w - 2, maxX); x++) {
      const pi = idx(x, y);
      if (px[pi + 3] > 0) {
        const transVecinos =
          (px[idx(x + 1, y) + 3] === 0 ? 1 : 0) +
          (px[idx(x - 1, y) + 3] === 0 ? 1 : 0) +
          (px[idx(x, y + 1) + 3] === 0 ? 1 : 0) +
          (px[idx(x, y - 1) + 3] === 0 ? 1 : 0);
        if (transVecinos >= 2) {
          px[pi + 3] = Math.round(px[pi + 3] * 0.65);
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropW;
  croppedCanvas.height = cropH;
  const cropCtx = croppedCanvas.getContext('2d');

  if (cropCtx) {
    cropCtx.drawImage(tempCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
  }

  const cuelloRelativoY = 0.08;

  return {
    canvas: croppedCanvas,
    ancho: cropW,
    alto: cropH,
    cuelloRelativoY,
  };
}

export function VestidorRa({ abierto, prenda, onCerrar, onReservar }: Props) {
  const { usuario, token } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  const anclasRef = useRef<Anclas | null>(null);
  const prendaProcesadaRef = useRef<PrendaProcesada | null>(null);
  const puntosRef = useRef<PuntosCuerpo | null>(null);
  const fondoFotoRef = useRef<HTMLImageElement | null>(null);
  const fondoCongeladoRef = useRef<HTMLImageElement | null>(null);

  // Estados
  const [estadoCamara, setEstadoCamara] = useState<EstadoCamara>('solicitando');
  const [poseCargando, setPoseCargando] = useState(false);
  const [poseDetectada, setPoseDetectada] = useState(false);
  const [congelada, setCongelada] = useState(false);
  const [modoFoto, setModoFoto] = useState(false);

  // Esqueleto y Visualización RA
  const [mostrarEsqueleto, setMostrarEsqueleto] = useState(true);
  const [tarjetaTallaAbierta, setTarjetaTallaAbierta] = useState(true);

  // Controles de ajuste
  const [modoAjuste, setModoAjuste] = useState<ModoAjuste>('automatico');
  const [estiloAjuste, setEstiloAjuste] = useState<EstiloAjuste>('normal');
  const [tallaSeleccionada, setTallaSeleccionada] = useState<TallaPrenda>('M');
  const [microAjusteEscala, setMicroAjusteEscala] = useState(0); // -0.25 a +0.40
  const [offsetVerticalAuto, setOffsetVerticalAuto] = useState(0); // -60 a +60 px
  const [autoRecorteFondo, setAutoRecorteFondo] = useState(true);

  // Controles manuales
  const [medidas, setMedidas] = useState('');
  const [alturaCm, setAlturaCm] = useState('');
  const [escala, setEscala] = useState(1.3);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [rotacion, setRotacion] = useState(0);
  const [opacidad, setOpacidad] = useState(0.95);
  const [tolerancia, setTolerancia] = useState(42);

  // Estados de sesión
  const [sesion, setSesion] = useState<RespuestaSesionRa | null>(null);
  const [enviando, setEnviando] = useState<'Gusta' | 'No gusta' | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'exito'; texto: string } | null>(null);
  const [ultimoResultado, setUltimoResultado] = useState<'Gusta' | 'No gusta' | null>(null);

  // Interpolación suave para apego e inclinación en tiempo real
  const suavizadoRef = useRef({
    cx: 270,
    cy: 360,
    ancho: 240,
    alto: 300,
    angulo: 0,
    inicializado: false,
  });

  const detenerModelo = useCallback(() => {
    try {
      landmarkerRef.current?.close?.();
    } catch {
      // Ignorar
    }
    landmarkerRef.current = null;
  }, []);

  const detenerCamara = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // 1. Inicialización de MediaPipe Pose
  useEffect(() => {
    if (!abierto) return;

    setMedidas('');
    setAlturaCm('');
    setEscala(1.3);
    setPosX(0);
    setPosY(0);
    setRotacion(0);
    setOpacidad(0.95);
    setTolerancia(42);
    setSesion(null);
    setMensaje(null);
    setUltimoResultado(null);
    setPoseDetectada(false);
    setCongelada(false);
    setModoFoto(false);
    setEstadoCamara('solicitando');
    setModoAjuste('automatico');
    setAutoRecorteFondo(true);
    setMostrarEsqueleto(true);
    setTarjetaTallaAbierta(true);
    setMicroAjusteEscala(0);
    setOffsetVerticalAuto(0);
    puntosRef.current = null;
    anclasRef.current = null;
    fondoFotoRef.current = null;
    fondoCongeladoRef.current = null;
    suavizadoRef.current.inicializado = false;

    if (prenda?.talla) {
      const t = prenda.talla.toUpperCase();
      if (['XS', 'S', 'M', 'L', 'XL', 'XXL'].includes(t)) {
        setTallaSeleccionada(t as TallaPrenda);
      }
    }

    let activo = true;

    const inicializarPoseDetector = async () => {
      setPoseCargando(true);
      try {
        const fileset = await FilesetResolver.forVisionTasks(VISION_WASM_CDN);
        if (!activo) return;

        try {
          landmarkerRef.current = await PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.35,
            minPosePresenceConfidence: 0.35,
            minTrackingConfidence: 0.35,
          });
        } catch {
          if (!activo) return;
          landmarkerRef.current = await PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.35,
            minPosePresenceConfidence: 0.35,
            minTrackingConfidence: 0.35,
          });
        }
      } catch (err) {
        console.warn('MediaPipe Pose no disponible:', err);
      } finally {
        if (activo) setPoseCargando(false);
      }
    };

    void inicializarPoseDetector();

    return () => {
      activo = false;
      detenerCamara();
      detenerModelo();
    };
  }, [abierto, prenda?.talla, detenerCamara, detenerModelo]);

  // 2. Iniciar cámara al abrir
  useEffect(() => {
    if (!abierto || modoFoto || congelada) return;

    let activo = true;
    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      })
      .then((stream) => {
        if (!activo) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setEstadoCamara('activa');
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      })
      .catch(() => {
        if (activo) setEstadoCamara('denegada');
      });

    return () => {
      activo = false;
    };
  }, [abierto, modoFoto, congelada]);

  // 3. Procesamiento y Recorte Inteligente de la Prenda
  useEffect(() => {
    if (!abierto || !prenda?.imagen) return;
    let activo = true;

    cargarImagen(prenda.imagen)
      .then((img) => {
        if (!activo) return;
        const procesada = recortarPrendaInteligente(img, tolerancia, autoRecorteFondo);
        prendaProcesadaRef.current = procesada;
      })
      .catch((err) => {
        if (activo) setMensaje({ tipo: 'error', texto: (err as Error).message });
      });

    return () => {
      activo = false;
    };
  }, [abierto, prenda?.imagen, tolerancia, autoRecorteFondo]);

  // Manejo de tecla Escape
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enviando) onCerrar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto, enviando, onCerrar]);

  // Cálculo de dimensiones del viewport / canvas
  const calcularAnclas = useCallback((): Anclas | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    let fuenteAncho: number;
    let fuenteAlto: number;

    if (fondoCongeladoRef.current) {
      fuenteAncho = fondoCongeladoRef.current.naturalWidth || canvas.width;
      fuenteAlto = fondoCongeladoRef.current.naturalHeight || canvas.height;
    } else if (fondoFotoRef.current) {
      fuenteAncho = fondoFotoRef.current.naturalWidth || canvas.width;
      fuenteAlto = fondoFotoRef.current.naturalHeight || canvas.height;
    } else if (videoRef.current && videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
      fuenteAncho = videoRef.current.videoWidth;
      fuenteAlto = videoRef.current.videoHeight;
    } else {
      return null;
    }

    const cw = canvas.width;
    const ch = canvas.height;
    const s = Math.max(cw / fuenteAncho, ch / fuenteAlto);
    const dw = fuenteAncho * s;
    const dh = fuenteAlto * s;
    return { ancho: fuenteAncho, alto: fuenteAlto, dx: (cw - dw) / 2, dy: (ch - dh) / 2, dw, dh };
  }, []);

  // Pintar el fondo de video o foto
  const pintarFondo = useCallback(
    (ctx: CanvasRenderingContext2D, anclas: Anclas) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cw = canvas.width;
      const ch = canvas.height;

      const base = fondoCongeladoRef.current || fondoFotoRef.current;
      if (base) {
        ctx.clearRect(0, 0, cw, ch);
        ctx.drawImage(base, anclas.dx, anclas.dy, anclas.dw, anclas.dh);
        return;
      }

      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      ctx.save();
      ctx.clearRect(0, 0, cw, ch);
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, anclas.dx, anclas.dy, anclas.dw, anclas.dh);
      ctx.restore();
    },
    [],
  );

  // Renderizado de la Prenda Ceñida al Cuerpo con Inclinación Dinámica y Esqueleto
  const dibujarPrenda = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const anclas = anclasRef.current;
    const prendaP = prendaProcesadaRef.current;
    if (!canvas || !ctx || !anclas || !prendaP || anclas.dw <= 0) return;

    pintarFondo(ctx, anclas);

    const cw = canvas.width;
    const ch = canvas.height;
    const espejado = !fondoCongeladoRef.current && !fondoFotoRef.current;

    const puntos = puntosRef.current;
    let targetX: number;
    let targetY: number;
    let targetWidth: number;
    let targetAngle = 0;

    // Multiplicadores de calce
    const factorBase =
      estiloAjuste === 'ajustado'
        ? 1.40
        : estiloAjuste === 'normal'
          ? 1.65
          : estiloAjuste === 'holgado'
            ? 1.95
            : 2.25;

    // Factor según talla seleccionada (S = 0.94x, M = 1.0x, L = 1.07x, XL = 1.15x, XXL = 1.24x)
    const factorTalla =
      tallaSeleccionada === 'XS'
        ? 0.88
        : tallaSeleccionada === 'S'
          ? 0.94
          : tallaSeleccionada === 'M'
            ? 1.0
            : tallaSeleccionada === 'L'
              ? 1.08
              : tallaSeleccionada === 'XL'
                ? 1.16
                : 1.25;

    const factorEstilo = factorBase * factorTalla * (1 + microAjusteEscala);

    let screenLeftX = 0;
    let screenLeftY = 0;
    let screenRightX = 0;
    let screenRightY = 0;
    let screenNeckX = 0;
    let screenNeckY = 0;
    let screenWaistX = 0;
    let screenWaistY = 0;

    if (puntos) {
      // Coordenadas en pantalla de los hombros
      const rawXI = anclas.dx + puntos.hombroI.x * anclas.dw;
      const rawYI = anclas.dy + puntos.hombroI.y * anclas.dh;
      const rawXD = anclas.dx + puntos.hombroD.x * anclas.dw;
      const rawYD = anclas.dy + puntos.hombroD.y * anclas.dh;

      const screenXI = espejado ? cw - rawXI : rawXI;
      const screenXD = espejado ? cw - rawXD : rawXD;
      const screenYI = rawYI;
      const screenYD = rawYD;

      // Hombro izquierdo y derecho en la pantalla (pantalla-izq = menor X, pantalla-der = mayor X)
      screenLeftX = Math.min(screenXI, screenXD);
      screenRightX = Math.max(screenXI, screenXD);
      screenLeftY = screenXI <= screenXD ? screenYI : screenYD;
      screenRightY = screenXI <= screenXD ? screenYD : screenYI;

      const hombrosPx = Math.hypot(screenRightX - screenLeftX, screenRightY - screenLeftY);

      // INCLINACIÓN DINÁMICA DE HOMBROS (atan2 entre hombro izquierdo y derecho)
      const angleRad = Math.atan2(screenRightY - screenLeftY, screenRightX - screenLeftX);

      targetX = (screenLeftX + screenRightX) / 2;
      targetY = (screenLeftY + screenRightY) / 2;
      targetWidth = Math.max(80, hombrosPx * (modoAjuste === 'automatico' ? factorEstilo : escala));
      targetAngle = angleRad;

      // Puntos auxiliares para esqueleto
      screenNeckX = targetX;
      screenNeckY = targetY - hombrosPx * 0.22;
      screenWaistX = targetX;
      screenWaistY = targetY + hombrosPx * 1.35;
    } else {
      // Posición centrada si no hay cuerpo aún
      targetX = cw / 2;
      targetY = ch * 0.48;
      targetWidth = cw * 0.52 * (modoAjuste === 'automatico' ? factorEstilo : escala);
      targetAngle = 0;
    }

    if (modoAjuste === 'automatico') {
      targetY += offsetVerticalAuto;
    } else if (modoAjuste === 'manual') {
      targetX += posX;
      targetY += posY;
      targetAngle += (rotacion * Math.PI) / 180;
    }

    // Suavizado temporal exponencial (Lerp) para movimiento orgánico e inclinación fluida
    const s = suavizadoRef.current;
    if (!s.inicializado) {
      s.cx = targetX;
      s.cy = targetY;
      s.ancho = targetWidth;
      s.angulo = targetAngle;
      s.inicializado = true;
    } else {
      const lerpFactor = 0.42; // Respuesta ágil a la inclinación
      s.cx += (targetX - s.cx) * lerpFactor;
      s.cy += (targetY - s.cy) * lerpFactor;
      s.ancho += (targetWidth - s.ancho) * lerpFactor;
      s.angulo += (targetAngle - s.angulo) * lerpFactor;
    }

    const altoImg = (s.ancho * prendaP.alto) / prendaP.ancho;
    const cuelloOffset = altoImg * (prendaP.cuelloRelativoY || 0.08);

    // 1. DIBUJAR PRENDA
    ctx.save();
    ctx.translate(s.cx, s.cy);
    ctx.rotate(s.angulo);
    ctx.globalAlpha = Math.max(0.2, Math.min(1, opacidad));

    // Sombra sutil de prenda para mayor realismo y profundidad
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;

    ctx.drawImage(prendaP.canvas, -s.ancho / 2, -cuelloOffset, s.ancho, altoImg);
    ctx.restore();

    // 2. DIBUJAR ESQUELETO / LÍNEAS DE INCLINACIÓN BIOMÉTRICA (Si está activado)
    if (mostrarEsqueleto && puntos && screenLeftX > 0) {
      ctx.save();

      // Línea de inclinación de hombros (verde esmeralda brillante)
      ctx.beginPath();
      ctx.moveTo(screenLeftX, screenLeftY);
      ctx.lineTo(screenRightX, screenRightY);
      ctx.strokeStyle = '#10b981'; // Emerald 500
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 8;
      ctx.stroke();

      // Línea clavícula / columna hacia el torso
      ctx.beginPath();
      ctx.moveTo(screenNeckX, screenNeckY);
      ctx.lineTo(targetX, targetY);
      ctx.lineTo(screenWaistX, screenWaistY);
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Puntos / Nodos biométricos con glow
      const dibujarNodo = (x: number, y: number, color = '#10b981') => {
        ctx.beginPath();
        ctx.arc(x, y, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      };

      dibujarNodo(screenLeftX, screenLeftY);
      dibujarNodo(screenRightX, screenRightY);
      dibujarNodo(screenNeckX, screenNeckY, '#34d399');
      dibujarNodo(targetX, targetY, '#6ee7b7');
      dibujarNodo(screenWaistX, screenWaistY, '#059669');

      ctx.restore();
    }
  }, [
    estiloAjuste,
    tallaSeleccionada,
    microAjusteEscala,
    offsetVerticalAuto,
    modoAjuste,
    escala,
    posX,
    posY,
    rotacion,
    opacidad,
    mostrarEsqueleto,
    pintarFondo,
  ]);

  // Bucle de animación continuo
  useEffect(() => {
    if (!abierto) return;
    let raf = 0;
    const bucle = () => {
      raf = requestAnimationFrame(bucle);
      anclasRef.current = calcularAnclas();
      dibujarPrenda();
    };
    raf = requestAnimationFrame(bucle);
    return () => cancelAnimationFrame(raf);
  }, [abierto, calcularAnclas, dibujarPrenda]);

  // Detección de Pose en Video
  const detectarVideo = useCallback((): boolean => {
    const landmarker = landmarkerRef.current;
    const video = videoRef.current;
    const anclas = anclasRef.current;
    if (!landmarker || !video || video.readyState < 2 || !anclas) return false;

    let resultados: any;
    try {
      resultados = landmarker.detectForVideo(video, Math.max(1, Math.round(video.currentTime * 1000) + 1));
    } catch {
      return false;
    }

    const pose = resultados?.landmarks?.[0];
    if (!pose || pose.length < 24) return false;

    const F = (i: number) => ({ x: Number(pose[i].x), y: Number(pose[i].y) });
    const hombroI = F(11);
    const hombroD = F(12);

    if (Math.abs(hombroI.x - hombroD.x) < 0.02) return false;

    puntosRef.current = {
      cx: (hombroI.x + hombroD.x) / 2,
      cy: (hombroI.y + hombroD.y) / 2,
      anchoHombrosPx: Math.abs(hombroI.x - hombroD.x) * anclas.dw,
      hombroI,
      hombroD,
      nariz: F(0),
      caderaI: F(23),
      caderaD: F(24),
    };
    return true;
  }, []);

  // Intervalo de tracking de pose
  useEffect(() => {
    if (!abierto || modoFoto || congelada) return;
    let raf = 0;
    let ultima = 0;
    const chequeo = (ts: number) => {
      raf = requestAnimationFrame(chequeo);
      if (ts - ultima < 80) return; // ~12 FPS
      ultima = ts;
      if (detectarVideo()) {
        setPoseDetectada(true);
      }
    };
    raf = requestAnimationFrame(chequeo);
    return () => cancelAnimationFrame(raf);
  }, [abierto, modoFoto, congelada, detectarVideo]);

  // Congelar frame
  const congelar = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const anclas = anclasRef.current;
    if (!video || !canvas || !anclas) return;
    const snapshot = document.createElement('canvas');
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    const ctx = snapshot.getContext('2d');
    if (!ctx) return;
    dibujarPrenda();
    ctx.drawImage(canvas, 0, 0);
    const img = new Image();
    img.src = snapshot.toDataURL('image/jpeg', 0.9);
    img.onload = () => {
      fondoCongeladoRef.current = img;
      anclasRef.current = null;
      setCongelada(true);
      detenerCamara();
    };
  };

  // Reanudar cámara
  const reanudar = () => {
    fondoCongeladoRef.current = null;
    anclasRef.current = null;
    setCongelada(false);
    setPoseDetectada(false);
    setEstadoCamara('solicitando');
    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      })
      .then((stream) => {
        streamRef.current = stream;
        setEstadoCamara('activa');
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play();
          }
        });
      })
      .catch(() => setEstadoCamara('denegada'));
  };

  // Subir foto propia
  const subirFoto = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      fondoFotoRef.current = img;
      anclasRef.current = null;
      if (streamRef.current) detenerCamara();
      setModoFoto(true);
      setPoseDetectada(false);
      setEstadoCamara('solicitando');

      if (landmarkerRef.current) {
        try {
          const res = landmarkerRef.current.detect(img);
          const pose = res?.landmarks?.[0];
          if (pose && pose.length >= 24) {
            const F = (i: number) => ({ x: Number(pose[i].x), y: Number(pose[i].y) });
            puntosRef.current = {
              cx: (F(11).x + F(12).x) / 2,
              cy: (F(11).y + F(12).y) / 2,
              anchoHombrosPx: Math.abs(F(11).x - F(12).x) * 540,
              hombroI: F(11),
              hombroD: F(12),
              nariz: F(0),
              caderaI: F(23),
              caderaD: F(24),
            };
            setPoseDetectada(true);
          }
        } catch {
          // Ignorar
        }
      }
    };
    img.src = url;
  };

  // Estimación biométrica y Recomendación de Talla Inteligente
  const biometria = useMemo(() => {
    const puntos = puntosRef.current;
    const altura = Number.parseFloat(alturaCm) || 172; // Altura de referencia estándar

    // Estimación de hombros en cm
    let hombrosCm = 42;
    if (puntos && puntos.anchoHombrosPx > 50) {
      const refPxPorCm = puntos.anchoHombrosPx / (0.245 * altura);
      if (refPxPorCm > 0) {
        hombrosCm = Math.round(Math.max(34, Math.min(56, puntos.anchoHombrosPx / refPxPorCm)));
      }
    }

    const torsoCm = Math.round(0.44 * altura);
    const pechoCm = Math.round(hombrosCm * 2.35);
    const cinturaCm = Math.round(pechoCm * 0.82);

    // Recomendación de Talla calibrada (más holgada y confortable para adultos)
    let tallaRecomendada: TallaPrenda = 'L';
    let contextura = 'Estándar';
    let rango = 'M - XL';

    if (hombrosCm < 36) {
      tallaRecomendada = 'S';
      contextura = 'Delgada / Juvenil';
      rango = 'XS - M';
    } else if (hombrosCm < 40) {
      tallaRecomendada = 'M';
      contextura = 'Regular / Intermedia';
      rango = 'S - L';
    } else if (hombrosCm <= 45) {
      // 40cm a 45cm (incluye 42cm) -> Recomienda Talla L
      tallaRecomendada = 'L';
      contextura = 'Estándar / Confort';
      rango = 'M - XL';
    } else if (hombrosCm <= 50) {
      tallaRecomendada = 'XL';
      contextura = 'Atlética / Robusta';
      rango = 'L - XXL';
    } else {
      tallaRecomendada = 'XXL';
      contextura = 'Extra Holgada / Confort';
      rango = 'XL - XXL';
    }

    return {
      hombrosCm,
      torsoCm,
      pechoCm,
      cinturaCm,
      tallaRecomendada,
      contextura,
      rango,
    };
  }, [alturaCm, poseDetectada]);

  const calculaMedidasTexto = useCallback((): string => {
    return `Ancho hombros ≈ ${biometria.hombrosCm} cm · Largo torso ≈ ${biometria.torsoCm} cm · Talla recomendada: ${biometria.tallaRecomendada}`;
  }, [biometria]);

  const medidaFinal = (): string => {
    const base = medidas.trim();
    const auto = calculaMedidasTexto();
    if (auto && base) return `${base} · ${auto}`;
    return auto || base;
  };

  const generarSnapshot = (): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    dibujarPrenda();
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const calificar = async (resultado: 'Gusta' | 'No gusta') => {
    if (!token) {
      setMensaje({ tipo: 'error', texto: 'Inicia sesión para guardar tu prueba en el vestidor virtual.' });
      return;
    }
    if (!prenda) return;
    setEnviando(resultado);
    setMensaje(null);
    try {
      let idSesion = sesion?.id_sesion_ra ?? null;
      if (idSesion == null) {
        const snapshot = generarSnapshot();
        sessionStorage.setItem('tm_ultima_foto_ra', snapshot);
        const creada = await api.crearSesionRa({
          id_ptc: prenda.id_ptc,
          medidas_avatar: medidaFinal() || undefined,
          foto_resultado: snapshot || undefined,
        });
        idSesion = creada.id_sesion_ra;
        setSesion(creada);
      }
      const res = await api.registrarResultadoRa(idSesion, resultado);
      setUltimoResultado(res.resultado);
      setMensaje({
        tipo: 'exito',
        texto: res.actualizado
          ? `Prueba actualizada: ${res.resultado}.`
          : `Prenda marcada como "${res.resultado}".`,
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No pudimos guardar tu prueba en el vestidor virtual.';
      setMensaje({ tipo: 'error', texto: msg });
    } finally {
      setEnviando(null);
    }
  };

  const resetearAjustesManuales = () => {
    setEscala(1.3);
    setPosX(0);
    setPosY(0);
    setRotacion(0);
    setOpacidad(0.95);
    setTolerancia(42);
    suavizadoRef.current.inicializado = false;
  };

  if (!abierto || !prenda) return null;

  const enVivo = estadoCamara === 'activa' && !congelada && !modoFoto;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-ink-100">
        {/* Header Superior */}
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 bg-gradient-to-r from-brand-50/70 via-white to-accent-50/70 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md shadow-brand-500/20">
              <ScanLine size={18} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-ink-900 tracking-tight">
                  Vestidor Virtual RA
                </h2>
                <Badge variant="brand" className="text-[10px] px-2 py-0.5">
                  IA Biometría
                </Badge>
                {enVivo && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Proyección en Vivo
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-ink-500">
                {prenda.nombre} · Talla <span className="font-bold text-ink-700">{tallaSeleccionada || prenda.talla}</span> · Color{' '}
                <span className="font-bold text-ink-700">{prenda.color}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle de Esqueleto en Header */}
            <button
              type="button"
              onClick={() => setMostrarEsqueleto((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer',
                mostrarEsqueleto
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs'
                  : 'bg-white border-ink-200 text-ink-600 hover:bg-ink-50',
              )}
            >
              <Activity size={14} className={mostrarEsqueleto ? 'text-emerald-600' : 'text-ink-400'} />
              <span>Esqueleto: {mostrarEsqueleto ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={onCerrar}
              className="rounded-full p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-800 transition cursor-pointer"
              aria-label="Cerrar vestidor"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="grid flex-1 gap-0 overflow-y-auto md:grid-cols-12">
          {/* Canvas Viewport (Espejo RA) */}
          <div className="relative min-h-[380px] sm:min-h-[480px] overflow-hidden bg-gradient-to-b from-ink-900 via-slate-900 to-ink-950 md:col-span-7 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={540}
              height={720}
              className="h-full min-h-[380px] sm:min-h-[480px] w-full object-contain select-none"
            />
            <video ref={videoRef} playsInline muted className="hidden" />

            {/* Badges de Estado Superpuestos */}
            <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1.5 z-20">
              {enVivo && (
                <span className="flex items-center gap-1.5 rounded-full bg-ink-950/80 px-3 py-1 text-xs font-bold text-emerald-400 backdrop-blur border border-emerald-500/20 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Cámara activa
                </span>
              )}
              {poseDetectada ? (
                <Badge variant="success" className="shadow-sm backdrop-blur">
                  <CheckCircle2 size={12} className="mr-1" /> Hombros alineados ({Math.round((suavizadoRef.current.angulo * 180) / Math.PI)}°)
                </Badge>
              ) : (
                <Badge variant="neutral" className="shadow-sm backdrop-blur bg-ink-900/80 text-ink-200 border-white/10">
                  {modoAjuste === 'automatico' ? 'Buscando torso…' : 'Modo manual'}
                </Badge>
              )}
              {poseCargando && (
                <Badge variant="accent" className="shadow-sm">
                  <Loader2 size={12} className="animate-spin mr-1" /> Iniciando IA…
                </Badge>
              )}
            </div>

            {/* TARJETA FLOTANTE DE TALLA RECOMENDADA (Estilo Biometría RA) */}
            {poseDetectada && tarjetaTallaAbierta && (
              <div className="absolute top-3 right-3 z-30 max-w-[210px] rounded-2xl bg-ink-950/85 p-3 text-white backdrop-blur-md border border-white/15 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <Sparkles size={13} /> Talla Recomendada
                  </div>
                  <button
                    type="button"
                    onClick={() => setTarjetaTallaAbierta(false)}
                    className="text-white/50 hover:text-white"
                  >
                    <X size={13} />
                  </button>
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <span className="text-2xl font-extrabold text-emerald-400 leading-none">
                      {biometria.tallaRecomendada}
                    </span>
                    <span className="text-[10px] text-white/60 ml-1.5">Rango {biometria.rango}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTallaSeleccionada(biometria.tallaRecomendada)}
                    className={cn(
                      'flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition cursor-pointer',
                      tallaSeleccionada === biometria.tallaRecomendada
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white/10 text-white hover:bg-white/20',
                    )}
                  >
                    {tallaSeleccionada === biometria.tallaRecomendada ? <Check size={12} /> : null}
                    {tallaSeleccionada === biometria.tallaRecomendada ? 'Elegida' : `Elegir ${biometria.tallaRecomendada}`}
                  </button>
                </div>

                <div className="flex flex-col gap-0.5 text-[10px] text-white/75 bg-white/5 p-1.5 rounded-lg mb-1.5">
                  <p className="flex justify-between">
                    <span>Hombros:</span> <strong className="text-white">~{biometria.hombrosCm} cm</strong>
                  </p>
                  <p className="flex justify-between">
                    <span>Largo Torso:</span> <strong className="text-white">~{biometria.torsoCm} cm</strong>
                  </p>
                  <p className="flex justify-between">
                    <span>Contextura:</span> <strong className="text-emerald-300">{biometria.contextura}</strong>
                  </p>
                </div>
                <p className="text-[9px] text-white/50 text-center">
                  Ajuste biométrico adaptado a tu complexión
                </p>
              </div>
            )}

            {/* Selector de Tallas Rápido Flotante Inferior en Canvas */}
            <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between gap-2 rounded-2xl bg-ink-950/80 px-3 py-2 backdrop-blur-md border border-white/15">
              <div className="flex items-center gap-1 text-[11px] font-bold text-white/90 shrink-0">
                <span>Talla:</span>
              </div>
              <div className="flex items-center gap-1">
                {(['S', 'M', 'L', 'XL', 'XXL'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTallaSeleccionada(t)}
                    className={cn(
                      'h-7 min-w-[28px] px-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer',
                      tallaSeleccionada === t
                        ? 'bg-emerald-500 text-ink-950 shadow-sm'
                        : 'bg-white/10 text-white hover:bg-white/20',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold truncate hidden sm:block">
                Inclinación: {Math.round((suavizadoRef.current.angulo * 180) / Math.PI)}°
              </div>
            </div>

            {/* Modal inicial si la cámara está denegada o inactiva */}
            {estadoCamara === 'denegada' && !modoFoto && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-ink-950/90 p-6 text-center text-white">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-amber-400">
                  <CameraOff size={28} />
                </span>
                <p className="text-base font-bold">Permiso de cámara requerido</p>
                <p className="max-w-xs text-xs text-white/70">
                  Habilita el acceso a la cámara en tu navegador o sube una foto tuya para probarte la prenda.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  <Button onClick={reanudar} size="sm" className="bg-brand-600 hover:bg-brand-700 text-white">
                    <RefreshCw size={14} /> Reintentar cámara
                  </Button>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/10 border border-white/20 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 transition">
                    <ImagePlus size={14} /> Subir foto
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => subirFoto(e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Panel Lateral de Controles */}
          <div className="flex flex-col gap-3.5 p-4 sm:p-5 md:col-span-5 border-t md:border-t-0 md:border-l border-ink-100 bg-white">
            {usuario ? (
              <>
                {/* 1. Fuente de Imagen (Cámara o Foto) */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-ink-500">
                      1. Origen de tu imagen
                    </label>
                    <button
                      type="button"
                      onClick={() => setMostrarEsqueleto((v) => !v)}
                      className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 hover:underline"
                    >
                      <Activity size={12} /> {mostrarEsqueleto ? 'Ocultar esqueleto' : 'Mostrar esqueleto'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50/70 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100 transition shadow-xs">
                      <ImagePlus size={14} /> Subir mi foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => subirFoto(e.target.files?.[0])}
                      />
                    </label>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full text-xs font-semibold"
                      onClick={() => {
                        if (modoFoto || congelada) {
                          reanudar();
                        } else {
                          reanudar();
                        }
                      }}
                    >
                      {modoFoto || congelada ? <RefreshCw size={13} /> : <Camera size={13} />}
                      {modoFoto || congelada ? 'Reanudar cámara' : 'Usar cámara'}
                    </Button>
                  </div>
                  {enVivo && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={congelar}
                      className="text-xs text-ink-600 hover:bg-ink-100 self-start mt-0.5 cursor-pointer"
                    >
                      <CameraOff size={13} className="mr-1" /> Congelar imagen actual
                    </Button>
                  )}
                </div>

                {/* 2. Sección: Ajustar Prenda (Automático vs Manual) */}
                <div className="flex flex-col rounded-2xl border border-ink-200/80 bg-gradient-to-b from-ink-50/60 to-white overflow-hidden shadow-xs">
                  {/* Selector Segmentado: Automático (IA) / Manual */}
                  <div className="p-3 border-b border-ink-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-ink-700 flex items-center gap-1.5">
                        <Wand2 size={14} className="text-brand-600" /> Ajustar prenda al cuerpo
                      </span>
                      {modoAjuste === 'automatico' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <Sparkles size={10} /> Auto-Fit
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 rounded-xl bg-ink-200/60 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setModoAjuste('automatico');
                          setAutoRecorteFondo(true);
                        }}
                        className={cn(
                          'flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer',
                          modoAjuste === 'automatico'
                            ? 'bg-white text-brand-700 shadow-sm'
                            : 'text-ink-600 hover:text-ink-900',
                        )}
                      >
                        <Sparkles size={13} /> Automático (IA)
                      </button>
                      <button
                        type="button"
                        onClick={() => setModoAjuste('manual')}
                        className={cn(
                          'flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer',
                          modoAjuste === 'manual'
                            ? 'bg-white text-brand-700 shadow-sm'
                            : 'text-ink-600 hover:text-ink-900',
                        )}
                      >
                        <Sliders size={13} /> Manual
                      </button>
                    </div>
                  </div>

                  {/* Panel MODO AUTOMÁTICO */}
                  {modoAjuste === 'automatico' && (
                    <div className="p-3 flex flex-col gap-2.5 animate-in fade-in duration-150">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-ink-700">
                            Estilo de calce y caída
                          </label>
                          <span className="text-[10px] text-ink-400">Sigue la inclinación de tus hombros</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {(
                            [
                              { id: 'ajustado', label: 'Slim Fit', sub: 'Ceñido' },
                              { id: 'normal', label: 'Regular', sub: 'Estándar' },
                              { id: 'holgado', label: 'Oversize', sub: 'Holgado' },
                              { id: 'extra_holgado', label: 'Maxi Baggy', sub: 'Extra' },
                            ] as const
                          ).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setEstiloAjuste(item.id)}
                              className={cn(
                                'flex flex-col items-center justify-center rounded-xl border p-1.5 text-center transition cursor-pointer',
                                estiloAjuste === item.id
                                  ? 'border-brand-600 bg-brand-50/80 text-brand-800 ring-1 ring-brand-500 shadow-xs'
                                  : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
                              )}
                            >
                              <span className="text-xs font-bold leading-tight">{item.label}</span>
                              <span className="text-[10px] text-ink-400">{item.sub}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Ajuste Fino de Calibre y Altura */}
                      <div className="rounded-xl bg-ink-50/70 p-2 border border-ink-100 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-ink-700">Ajuste fino de tamaño</span>
                          <span className="font-mono text-ink-500 text-[10px] bg-white px-1.5 py-0.5 rounded border border-ink-200">
                            {microAjusteEscala === 0
                              ? 'Normal (100%)'
                              : `${microAjusteEscala > 0 ? '+' : ''}${Math.round(microAjusteEscala * 100)}%`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setMicroAjusteEscala((v) => Math.max(-0.25, Number((v - 0.05).toFixed(2))))
                            }
                            className="flex-1 rounded-lg border border-ink-200 bg-white py-1 text-xs font-bold text-ink-700 hover:bg-ink-100 transition cursor-pointer"
                          >
                            - Más chico
                          </button>
                          {microAjusteEscala !== 0 && (
                            <button
                              type="button"
                              onClick={() => setMicroAjusteEscala(0)}
                              className="px-2 py-1 rounded-lg text-[10px] font-semibold text-brand-600 hover:underline cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setMicroAjusteEscala((v) => Math.min(0.4, Number((v + 0.05).toFixed(2))))
                            }
                            className="flex-1 rounded-lg border border-ink-200 bg-white py-1 text-xs font-bold text-ink-700 hover:bg-ink-100 transition cursor-pointer"
                          >
                            + Más ancho
                          </button>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-ink-100 text-[11px]">
                          <span className="text-ink-600 font-medium">Altura / Cuello:</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setOffsetVerticalAuto((v) => v - 10)}
                              className="rounded border border-ink-200 bg-white px-2 py-0.5 text-[11px] font-bold text-ink-700 hover:bg-ink-100 cursor-pointer"
                              title="Subir prenda"
                            >
                              ⬆️ Subir
                            </button>
                            {offsetVerticalAuto !== 0 && (
                              <button
                                type="button"
                                onClick={() => setOffsetVerticalAuto(0)}
                                className="text-[10px] text-brand-600 px-1 hover:underline cursor-pointer"
                              >
                                0
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setOffsetVerticalAuto((v) => v + 10)}
                              className="rounded border border-ink-200 bg-white px-2 py-0.5 text-[11px] font-bold text-ink-700 hover:bg-ink-100 cursor-pointer"
                              title="Bajar prenda"
                            >
                              ⬇️ Bajar
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Recorte Inteligente de Fondo Switch */}
                      <div className="flex items-center justify-between rounded-xl bg-ink-50/80 p-2 border border-ink-100">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                            <Scissors size={13} />
                          </span>
                          <div>
                            <p className="text-xs font-bold text-ink-800">Recorte inteligente de fondo</p>
                            <p className="text-[10px] text-ink-500">Elimina el fondo blanco de catálogo</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={autoRecorteFondo}
                          onChange={(e) => setAutoRecorteFondo(e.target.checked)}
                          className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          suavizadoRef.current.inicializado = false;
                          setPoseDetectada(false);
                          setTarjetaTallaAbierta(true);
                        }}
                        className="text-xs w-full justify-center"
                      >
                        <RefreshCw size={13} className="mr-1" /> Reajustar e inclinar al cuerpo
                      </Button>
                    </div>
                  )}

                  {/* Panel MODO MANUAL */}
                  {modoAjuste === 'manual' && (
                    <div className="p-3 flex flex-col gap-2.5 animate-in fade-in duration-150">
                      <SliderValor
                        labelEsq="Tamaño / Escala"
                        valor={escala}
                        min={0.6}
                        max={2.4}
                        paso={0.05}
                        onChange={setEscala}
                        formatear={(v) => `${Math.round(v * 100)}%`}
                      />
                      <SliderValor
                        labelEsq="Posición Vertical"
                        valor={posY}
                        min={-180}
                        max={180}
                        paso={1}
                        onChange={setPosY}
                        formatear={(v) => `${v > 0 ? '+' : ''}${v}px`}
                      />
                      <SliderValor
                        labelEsq="Posición Horizontal"
                        valor={posX}
                        min={-180}
                        max={180}
                        paso={1}
                        onChange={setPosX}
                        formatear={(v) => `${v > 0 ? '+' : ''}${v}px`}
                      />
                      <SliderValor
                        labelEsq="Rotación"
                        valor={rotacion}
                        min={-35}
                        max={35}
                        paso={0.5}
                        onChange={setRotacion}
                        formatear={(v) => `${v > 0 ? '+' : ''}${v}°`}
                      />
                      <SliderValor
                        labelEsq="Borrado de fondo (Tolerancia)"
                        valor={tolerancia}
                        min={5}
                        max={95}
                        paso={1}
                        onChange={setTolerancia}
                        formatear={(v) => `${v}%`}
                      />

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={resetearAjustesManuales}
                        className="text-xs text-ink-500 hover:text-ink-800 self-end mt-0.5 cursor-pointer"
                      >
                        <RotateCcw size={12} className="mr-1" /> Restablecer
                      </Button>
                    </div>
                  )}
                </div>

                {/* 3. Estimación de Altura y Medidas */}
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-ink-800">
                    <Ruler size={13} className="text-brand-600" /> Tu altura (cm) para afinar medidas
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={120}
                      max={220}
                      value={alturaCm}
                      onChange={(e) => setAlturaCm(e.target.value.slice(0, 3))}
                      placeholder="Ej. 170"
                      className="h-8 text-xs"
                    />
                    <span className="text-[10px] text-ink-400 shrink-0">calibra torso y hombros</span>
                  </div>
                </div>

                {/* 4. Notas opcionales */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-ink-700">Nota de medidas (opcional)</label>
                  <Input
                    value={medidas}
                    onChange={(e) => setMedidas(e.target.value.slice(0, 255))}
                    placeholder="Ej. Espalda 42 · Pecho 98 · Cintura 80"
                    className="h-8 text-xs"
                  />
                </div>

                {/* Mensajes de feedback */}
                {mensaje && (
                  <div
                    className={cn(
                      'flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-medium',
                      mensaje.tipo === 'exito'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-danger-50 text-danger-700 border border-danger-200',
                    )}
                  >
                    {mensaje.tipo === 'exito' ? (
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                    ) : (
                      <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                    )}
                    <span>{mensaje.texto}</span>
                  </div>
                )}

                {/* Botones de Calificación y Reserva */}
                <div className="mt-auto flex flex-col gap-2 pt-1">
                  {ultimoResultado ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800">
                        <CheckCircle2 size={15} /> Prueba guardada: {ultimoResultado}
                      </div>
                      {ultimoResultado === 'Gusta' && (
                        <Button
                          size="lg"
                          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold"
                          onClick={() => onReservar(prenda)}
                        >
                          Reservar para probar en sucursal
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={onCerrar} className="text-xs cursor-pointer">
                        Terminar
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="lg"
                          variant="secondary"
                          loading={enviando === 'No gusta'}
                          disabled={Boolean(enviando)}
                          onClick={() => void calificar('No gusta')}
                          className="font-bold text-ink-700"
                        >
                          <ThumbsDown size={16} /> No gusta
                        </Button>
                        <Button
                          size="lg"
                          loading={enviando === 'Gusta'}
                          disabled={Boolean(enviando)}
                          onClick={() => void calificar('Gusta')}
                          className="bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold shadow-sm"
                        >
                          <ThumbsUp size={16} /> Me gusta
                        </Button>
                      </div>
                      <p className="text-center text-[10px] text-ink-400">
                        Al calificar guardamos tu snapshot en tus pruebas virtuales.
                      </p>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center p-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <ScanLine size={26} />
                </span>
                <p className="text-sm font-bold text-ink-800">Inicia sesión para usar el vestidor virtual</p>
                <p className="max-w-xs text-xs text-ink-500">
                  Guarda tus pruebas, marca tus prendas favoritas y reserva las que más te gusten.
                </p>
                <Button onClick={onCerrar} variant="secondary">
                  Cerrar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SliderValorProps {
  labelEsq: React.ReactNode;
  valor: number;
  min: number;
  max: number;
  paso: number;
  onChange: (v: number) => void;
  formatear: (v: number) => string;
}

function SliderValor({ labelEsq, valor, min, max, paso, onChange, formatear }: SliderValorProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between text-[11px] font-semibold text-ink-700">
        <span>{labelEsq}</span>
        <span className="rounded-md bg-ink-100 px-1.5 py-0.2 font-mono text-[10px] text-ink-600">
          {formatear(valor)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={paso}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-brand-600"
      />
    </label>
  );
}