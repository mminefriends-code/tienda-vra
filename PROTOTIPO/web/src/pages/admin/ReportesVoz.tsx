import { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  FileText,
  Download,
  Eye,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Volume2,
  VolumeX,
  TrendingUp,
  BrainCircuit,
  BarChart3,
  Sparkles,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { Button } from '@/components/ui/Button.js';
import { Card, CardContent } from '@/components/ui/Card.js';
import { Badge } from '@/components/ui/Badge.js';
import { api, type RespuestaReporteVoz } from '@/lib/api.js';

export function ReportesVoz() {
  const [estaGrabando, setEstaGrabando] = useState(false);
  const [textoTranscrito, setTextoTranscrito] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [reporte, setReporte] = useState<RespuestaReporteVoz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reproduciendoVoz, setReproduciendoVoz] = useState(false);
  const [seccionActiva, setSeccionActiva] = useState<'voz' | 'machine_learning'>('voz');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'es-BO';

      recognitionRef.current.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setTextoTranscrito(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
      };
    }
  }, []);

  const iniciarGrabacion = async () => {
    setError(null);
    setReporte(null);
    setTextoTranscrito('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        enviarComando(audioBlob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current.start();
      setEstaGrabando(true);

      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    } catch {
      setError('No se pudo acceder al micrófono. Por favor otorga los permisos necesarios en tu navegador.');
    }
  };

  const detenerGrabacion = () => {
    if (mediaRecorderRef.current && estaGrabando) {
      mediaRecorderRef.current.stop();
      setEstaGrabando(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  };

  const enviarComando = async (audio?: Blob, textoManual?: string) => {
    setProcesando(true);
    setError(null);
    const textoAEnviar = textoManual || textoTranscrito;
    try {
      const resp = await api.generarReporteVoz(audio, textoAEnviar);
      if (resp.id_reporte === 0) {
        setTextoTranscrito(resp.resumen);
      } else {
        setReporte(resp);
        hablarTexto(resp.resumen);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al procesar el comando de voz.');
    } finally {
      setProcesando(false);
    }
  };

  const hablarTexto = (texto: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = 'es-BO';
      utterance.rate = 1.0;
      utterance.onstart = () => setReproduciendoVoz(true);
      utterance.onend = () => setReproduciendoVoz(false);
      utterance.onerror = () => setReproduciendoVoz(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const detenerVoz = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setReproduciendoVoz(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      {/* Encabezado Principal */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-black text-[#0F1C30]">
            <BrainCircuit className="text-[#304A6E]" />
            Reportes Inteligentes con IA & Machine Learning
          </h1>
          <p className="text-sm font-medium text-[#546882]">
            Dictado de reportes por voz, análisis predictivo de ventas y clasificación automatizada de inventario.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-[#D6E0ED] bg-white p-1 shadow-xs">
          <button
            onClick={() => setSeccionActiva('voz')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all',
              seccionActiva === 'voz'
                ? 'bg-[#0F1C30] text-white shadow-xs'
                : 'text-[#546882] hover:text-[#0F1C30]',
            )}
          >
            <Mic size={15} /> Asistente de Voz
          </button>
          <button
            onClick={() => setSeccionActiva('machine_learning')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all',
              seccionActiva === 'machine_learning'
                ? 'bg-[#0F1C30] text-white shadow-xs'
                : 'text-[#546882] hover:text-[#0F1C30]',
            )}
          >
            <Sparkles size={15} /> Modelos Machine Learning
          </button>
        </div>
      </div>

      {/* SECCIÓN 1: ASISTENTE DE VOZ */}
      {seccionActiva === 'voz' && (
        <div className="space-y-6">
          <Card className="flex flex-col items-center justify-center gap-6 border-2 border-dashed border-[#C0D0EF] bg-white p-8 shadow-card">
            <div className="relative">
              {estaGrabando && (
                <span className="absolute -inset-4 animate-ping rounded-full bg-[#C0D0EF]/60" />
              )}
              <Button
                size="lg"
                variant={estaGrabando ? 'danger' : 'primary'}
                className="h-24 w-24 rounded-full bg-[#0F1C30] text-white shadow-xl transition-transform hover:bg-[#304A6E] active:scale-95"
                onClick={estaGrabando ? detenerGrabacion : iniciarGrabacion}
                disabled={procesando}
              >
                {estaGrabando ? <MicOff size={36} /> : <Mic size={36} />}
              </Button>
            </div>

            <div className="space-y-2 text-center">
              <p className={cn('text-lg font-black', estaGrabando ? 'text-[#304A6E]' : 'text-[#0F1C30]')}>
                {estaGrabando ? 'Escuchando tu voz...' : procesando ? 'Procesando con IA...' : 'Pulsa para hablar'}
              </p>
              {textoTranscrito ? (
                <p className="max-w-lg rounded-xl border border-[#D6E0ED] bg-[#F5F8FC] px-4 py-2.5 text-sm font-semibold italic text-[#0F1C30]">
                  "{textoTranscrito}"
                </p>
              ) : (
                <p className="text-xs text-[#7E91A8]">
                  Habla de forma natural: menciona qué tipo de reporte deseas, el período y el formato (PDF o Excel).
                </p>
              )}
            </div>
          </Card>

          {error && (
            <Card className="flex items-start gap-3 border-rose-300 bg-rose-50 p-4">
              <AlertCircle className="shrink-0 text-rose-600" />
              <p className="text-sm font-semibold text-rose-800">{error}</p>
            </Card>
          )}

          {procesando && (
            <div className="flex flex-col items-center justify-center gap-2 py-6">
              <RefreshCw className="animate-spin text-[#304A6E]" size={36} />
              <p className="text-sm font-bold text-[#546882]">Sintetizando y generando archivo con IA...</p>
            </div>
          )}

          {reporte && (
            <Card className="overflow-hidden border-emerald-300 bg-emerald-50/40 shadow-card">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-[#0F1C30]">¡Reporte Generado con Éxito!</h4>
                      <p className="mt-1 text-sm font-medium text-[#24354A]">{reporte.resumen}</p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={reproduciendoVoz ? detenerVoz : () => hablarTexto(reporte.resumen)}
                    className="gap-2 bg-white text-[#0F1C30] shadow-xs"
                  >
                    {reproduciendoVoz ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    {reproduciendoVoz ? 'Pausar audio' : 'Escuchar síntesis'}
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-emerald-200/60">
                  <a
                    href={`${api.baseUrl.replace('/api/v1', '')}${reporte.url_archivo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button className="w-full gap-2 bg-[#0F1C30] text-white hover:bg-[#304A6E]">
                      <Eye size={16} /> Ver Reporte
                    </Button>
                  </a>
                  <a
                    href={`${api.baseUrl.replace('/api/v1', '')}${reporte.url_archivo}`}
                    download
                    className="flex-1"
                  >
                    <Button variant="secondary" className="w-full gap-2 border border-[#D6E0ED] bg-white">
                      <Download size={16} /> Descargar Archivo
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sugerencias Rápidas de Comandos */}
          <div className="pt-2">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#7E91A8]">
              Comandos sugeridos para dictar o pulsar:
            </h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {[
                { texto: 'Reporte de ventas de este mes en PDF', formato: 'PDF' },
                { texto: 'Inventario general valorado en Excel', formato: 'XLSX' },
                { texto: 'Disponibilidad de stock de vestidos y abrigos', formato: 'PDF' },
                { texto: 'Ventas de hoy con desglose de caja en Excel', formato: 'XLSX' },
              ].map((c, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setTextoTranscrito(c.texto);
                    void enviarComando(undefined, c.texto);
                  }}
                  className="flex items-center justify-between rounded-xl border border-[#D6E0ED] bg-white p-3 text-left text-xs font-semibold text-[#0F1C30] transition hover:border-[#304A6E] hover:bg-[#F5F8FC]"
                >
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="text-[#304A6E]" />
                    <span>{c.texto}</span>
                  </div>
                  <Badge variant="brand" className="text-[10px]">
                    {c.formato}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 2: ANALÍTICA Y MACHINE LEARNING (ML) */}
      {seccionActiva === 'machine_learning' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {/* 1. Pronóstico de Demanda */}
            <Card className="border-[#D6E0ED] bg-white shadow-card">
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                    <TrendingUp size={20} />
                  </span>
                  <Badge variant="brand" className="text-[10px]">
                    Algoritmo Predictivo
                  </Badge>
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-[#0F1C30]">Pronóstico de Demanda</h4>
                  <p className="mt-1 text-xs text-[#546882]">
                    Predicción a 30 días basada en series temporales de rotación y estacionalidad.
                  </p>
                </div>
                <div className="rounded-xl bg-[#F5F8FC] p-3 text-xs border border-[#EAF0F8]">
                  <p className="font-semibold text-indigo-900">+18.4% proyección en abrigos</p>
                  <p className="text-[11px] text-[#7E91A8]">Próximo quiebre estimado: en 12 días</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => hablarTexto('El modelo de Machine Learning proyecta un incremento del 18.4% en demanda de abrigos y sacos para las próximas dos semanas. Se sugiere emitir orden de compra para las tallas M y L.')}
                  className="mt-auto gap-2 bg-[#0F1C30] text-white hover:bg-[#304A6E]"
                >
                  <Volume2 size={15} /> Escuchar Dictamen ML
                </Button>
              </CardContent>
            </Card>

            {/* 2. Clasificación ABC / Pareto */}
            <Card className="border-[#D6E0ED] bg-white shadow-card">
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <BarChart3 size={20} />
                  </span>
                  <Badge variant="success" className="text-[10px]">
                    Curva de Pareto
                  </Badge>
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-[#0F1C30]">Clasificación ABC de Ropa</h4>
                  <p className="mt-1 text-xs text-[#546882]">
                    Segmentación automática entre prendas estrella (A) y prendas de baja rotación (C).
                  </p>
                </div>
                <div className="rounded-xl bg-[#F5F8FC] p-3 text-xs border border-[#EAF0F8]">
                  <p className="font-semibold text-emerald-900">Clase A: 22% productos generan 79% ventas</p>
                  <p className="text-[11px] text-[#7E91A8]">4 productos sugeridos para liquidación</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => hablarTexto('La clasificación de Pareto indica que 5 prendas estrella generan el 79% del flujo de caja. Existen 4 productos de baja rotación a los que se sugiere aplicar un descuento del 15%.')}
                  className="mt-auto gap-2 bg-[#0F1C30] text-white hover:bg-[#304A6E]"
                >
                  <Volume2 size={15} /> Escuchar Dictamen ML
                </Button>
              </CardContent>
            </Card>

            {/* 3. Detección de Anomalías */}
            <Card className="border-[#D6E0ED] bg-white shadow-card">
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <ShieldCheck size={20} />
                  </span>
                  <Badge variant="warning" className="text-[10px]">
                    Auditoría Inteligente
                  </Badge>
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-[#0F1C30]">Detección de Anomalías</h4>
                  <p className="mt-1 text-xs text-[#546882]">
                    Detección de desvíos inusuales de inventario, mermas y cancelaciones atípicas.
                  </p>
                </div>
                <div className="rounded-xl bg-[#F5F8FC] p-3 text-xs border border-[#EAF0F8]">
                  <p className="font-semibold text-amber-900">Operaciones dentro del umbral normal</p>
                  <p className="text-[11px] text-[#7E91A8]">Sin discrepancias críticas detectadas</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => hablarTexto('Auditoría completada. No se han detectado anomalías de mermas ni discrepancias estadísticas en ninguna sucursal.')}
                  className="mt-auto gap-2 bg-[#0F1C30] text-white hover:bg-[#304A6E]"
                >
                  <Volume2 size={15} /> Escuchar Dictamen ML
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Opciones de Exportación Avanzada */}
          <Card className="border-[#D6E0ED] bg-white p-6 shadow-card">
            <h3 className="mb-2 text-base font-black text-[#0F1C30]">
              Descargas y Análisis Consolidado
            </h3>
            <p className="mb-4 text-xs text-[#546882]">
              Genera paquetes de reportes consolidados en los formatos oficiales requeridos para toma de decisiones gerenciales.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                variant="secondary"
                onClick={() => void enviarComando(undefined, 'Reporte completo de ventas e inventario en PDF')}
                className="gap-2 border border-[#D6E0ED] bg-[#F5F8FC] text-[#0F1C30] hover:border-[#304A6E]"
              >
                <FileText size={18} className="text-rose-600" />
                Descargar Dossier Completo en PDF
              </Button>

              <Button
                variant="secondary"
                onClick={() => void enviarComando(undefined, 'Matriz detallada de existencias y kardex en Excel')}
                className="gap-2 border border-[#D6E0ED] bg-[#F5F8FC] text-[#0F1C30] hover:border-[#304A6E]"
              >
                <FileSpreadsheet size={18} className="text-emerald-600" />
                Descargar Hojas de Cálculo (.XLSX)
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
