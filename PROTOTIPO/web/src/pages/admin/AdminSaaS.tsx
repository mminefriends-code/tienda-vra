import { useState, useEffect } from 'react';
import {
  Building2,
  CalendarCheck,
  CalendarClock,
  Clock,
  PlusCircle,
  ShieldAlert,
  Sparkles,
  Store,
  Check,
  CheckCircle2,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { api } from '@/lib/api.js';
import { Button } from '@/components/ui/Button.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card.js';
import { Badge } from '@/components/ui/Badge.js';

interface TiendaItem {
  id_tienda: number;
  nombre: string;
  slug: string;
  logo_url: string | null;
  telefono: string | null;
  nit: string | null;
  estado: string;
  plan_actual: string;
  suscripcion_estado: string;
  dias_restantes: number;
  fecha_fin_suscripcion: string | null;
  total_sucursales: number;
  total_productos: number;
}

interface PlanItem {
  id_plan: number;
  nombre: string;
  descripcion: string;
  precio_mensual: number;
  max_sucursales: number;
  max_productos: number;
  max_usuarios: number;
  vestidor_ra_habilitado: boolean;
  reportes_ia_habilitado: boolean;
  estado: string;
}

export function AdminSaaS() {
  const [tab, setTab] = useState<'tiendas' | 'planes' | 'nueva'>('tiendas');
  const [tiendas, setTiendas] = useState<TiendaItem[]>([]);
  const [planes, setPlanes] = useState<PlanItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Modal para extender suscripción
  const [modalExtender, setModalExtender] = useState<TiendaItem | null>(null);
  const [diasExtension, setDiasExtension] = useState<number>(30);
  const [montoExtension, setMontoExtension] = useState<number>(150);
  const [metodoPago, setMetodoPago] = useState<string>('QR_Bancario');
  const [procesandoExtension, setProcesandoExtension] = useState(false);

  // Formulario nueva tienda
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoSlug, setNuevoSlug] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevoNit, setNuevoNit] = useState('');
  const [nuevoPlanId, setNuevoPlanId] = useState<number>(2);
  const [nuevoDias, setNuevoDias] = useState<number>(30);
  const [nuevoAdminEmail, setNuevoAdminEmail] = useState('');
  const [nuevoAdminPass, setNuevoAdminPass] = useState('Admin123!');
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const [listaTiendas, listaPlanes] = await Promise.all([
        api.listarTiendasSaaS(),
        api.listarPlanesSaaS(),
      ]);
      setTiendas(listaTiendas);
      setPlanes(listaPlanes);
    } catch (err: any) {
      setError(err?.message || 'Error al conectar con el módulo SaaS.');
    } finally {
      setCargando(false);
    }
  };

  const ejecutarExtension = async () => {
    if (!modalExtender) return;
    setProcesandoExtension(true);
    try {
      await api.extenderSuscripcionSaaS(modalExtender.id_tienda, {
        dias: diasExtension,
        monto_pagado: montoExtension,
        metodo_pago: metodoPago,
      });
      setExito(`Suscripción de "${modalExtender.nombre}" extendida con éxito por +${diasExtension} días.`);
      setModalExtender(null);
      await cargarDatos();
      setTimeout(() => setExito(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Error al extender suscripción.');
    } finally {
      setProcesandoExtension(false);
    }
  };

  const handleCrearTienda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim() || !nuevoAdminEmail.trim()) {
      setError('Por favor indica al menos el nombre de la tienda y el email del administrador.');
      return;
    }
    setCreando(true);
    setError(null);
    try {
      await api.crearTiendaSaaS({
        nombre: nuevoNombre.trim(),
        slug: nuevoSlug.trim() || undefined,
        telefono: nuevoTelefono.trim() || undefined,
        nit: nuevoNit.trim() || undefined,
        id_plan: nuevoPlanId,
        dias_iniciales: nuevoDias,
        admin_email: nuevoAdminEmail.trim(),
        admin_password: nuevoAdminPass,
        admin_nombre: `Admin ${nuevoNombre.trim()}`,
      });
      setExito(`¡Tienda "${nuevoNombre}" creada y habilitada exitosamente por ${nuevoDias} días!`);
      setNuevoNombre('');
      setNuevoSlug('');
      setNuevoTelefono('');
      setNuevoNit('');
      setNuevoAdminEmail('');
      setTab('tiendas');
      await cargarDatos();
      setTimeout(() => setExito(null), 5000);
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear la tienda.');
    } finally {
      setCreando(false);
    }
  };

  // Métricas rápidas
  const activas = tiendas.filter((t) => t.dias_restantes > 0).length;
  const porVencer = tiendas.filter((t) => t.dias_restantes > 0 && t.dias_restantes <= 7).length;
  const vencidas = tiendas.filter((t) => t.dias_restantes <= 0).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Encabezado */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F1C30] text-white shadow-sm ring-2 ring-[#C0D0EF]/50">
              <Building2 size={20} className="text-[#C0D0EF]" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-[#0F1C30]">Gestión SaaS & Suscripciones Multi-Tienda</h1>
              <p className="text-sm font-medium text-[#546882]">
                Control de inquilinos (Tenants), vigencia temporal, renovación de planes y habilitación de acceso.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant={tab === 'nueva' ? 'primary' : 'secondary'}
            onClick={() => setTab(tab === 'nueva' ? 'tiendas' : 'nueva')}
            className="gap-2"
          >
            <PlusCircle size={18} />
            {tab === 'nueva' ? 'Ver Tiendas' : 'Registrar Nueva Tienda'}
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {exito && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-xs">
          <CheckCircle2 size={18} className="text-emerald-600" />
          <span>{exito}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 shadow-xs">
          <AlertTriangle size={18} className="text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Métricas del Sistema SaaS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-[#D6E0ED] bg-white">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#7E91A8]">Total Tiendas Registradas</p>
              <h3 className="mt-1 text-2xl font-black text-[#0F1C30]">{tiendas.length}</h3>
              <p className="mt-0.5 text-xs text-[#546882]">Inquilinos en el sistema</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-[#0F1C30]">
              <Store size={22} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#D6E0ED] bg-white">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#7E91A8]">Suscripciones Activas</p>
              <h3 className="mt-1 text-2xl font-black text-emerald-600">{activas}</h3>
              <p className="mt-0.5 text-xs text-emerald-700/80">Operando con normalidad</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <CalendarCheck size={22} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#D6E0ED] bg-white">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#7E91A8]">Próximas a Vencer</p>
              <h3 className="mt-1 text-2xl font-black text-amber-600">{porVencer}</h3>
              <p className="mt-0.5 text-xs text-amber-700/80">Menos de 7 días de vigencia</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Clock size={22} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#D6E0ED] bg-white">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#7E91A8]">Vencidas / En Gracia</p>
              <h3 className="mt-1 text-2xl font-black text-rose-600">{vencidas}</h3>
              <p className="mt-0.5 text-xs text-rose-700/80">Requieren renovación</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
              <ShieldAlert size={22} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navegación por Pestañas */}
      <div className="flex border-b border-[#D6E0ED]">
        <button
          onClick={() => setTab('tiendas')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-colors ${
            tab === 'tiendas'
              ? 'border-[#0F1C30] text-[#0F1C30]'
              : 'border-transparent text-[#546882] hover:text-[#0F1C30]'
          }`}
        >
          <Store size={17} />
          Tiendas Registradas ({tiendas.length})
        </button>

        <button
          onClick={() => setTab('planes')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-colors ${
            tab === 'planes'
              ? 'border-[#0F1C30] text-[#0F1C30]'
              : 'border-transparent text-[#546882] hover:text-[#0F1C30]'
          }`}
        >
          <Layers size={17} />
          Planes de Suscripción ({planes.length})
        </button>

        <button
          onClick={() => setTab('nueva')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-colors ${
            tab === 'nueva'
              ? 'border-[#0F1C30] text-[#0F1C30]'
              : 'border-transparent text-[#546882] hover:text-[#0F1C30]'
          }`}
        >
          <PlusCircle size={17} />
          Alta de Nueva Tienda
        </button>
      </div>

      {/* TAB 1: LISTADO DE TIENDAS */}
      {tab === 'tiendas' && (
        <div className="flex flex-col gap-4">
          {cargando ? (
            <div className="rounded-2xl border border-[#D6E0ED] bg-white p-12 text-center text-sm font-semibold text-[#546882]">
              Cargando inquilinos y suscripciones del sistema SaaS...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {tiendas.map((t) => {
              const estaVigente = t.dias_restantes > 0;
              const enAlerta = t.dias_restantes > 0 && t.dias_restantes <= 7;

              return (
                <Card
                  key={t.id_tienda}
                  className="overflow-hidden border-[#D6E0ED] bg-white shadow-card transition-all hover:shadow-card-hover"
                >
                  <div className="flex items-center justify-between border-b border-[#EAF0F8] bg-[#F5F8FC] p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F1C30] font-black text-white shadow-xs">
                        {t.nombre.charAt(0)}
                      </span>
                      <div>
                        <h3 className="font-extrabold text-[#0F1C30] leading-snug">{t.nombre}</h3>
                        <p className="font-mono text-[11px] text-[#7E91A8]">slug: /{t.slug}</p>
                      </div>
                    </div>

                    <Badge
                      variant={estaVigente ? (enAlerta ? 'warning' : 'success') : 'danger'}
                      className="px-2.5 py-1 text-[11px]"
                    >
                      {estaVigente
                        ? `${t.dias_restantes} días vigentes`
                        : 'Suscripción Vencida'}
                    </Badge>
                  </div>

                  <CardContent className="flex flex-col gap-4 p-5">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-[#F5F8FC] p-2.5 border border-[#EAF0F8]">
                        <span className="block font-medium text-[#7E91A8]">Plan Contratado</span>
                        <span className="font-bold text-[#0F1C30]">{t.plan_actual}</span>
                      </div>
                      <div className="rounded-xl bg-[#F5F8FC] p-2.5 border border-[#EAF0F8]">
                        <span className="block font-medium text-[#7E91A8]">Sucursales / Ropa</span>
                        <span className="font-bold text-[#0F1C30]">
                          {t.total_sucursales} suc. · {t.total_productos} prod.
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-[#546882]">
                      <span className="font-semibold text-[#0F1C30]">Fecha de vencimiento:</span>{' '}
                      {t.fecha_fin_suscripcion
                        ? new Date(t.fecha_fin_suscripcion).toLocaleDateString('es-BO', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'No registrada'}
                    </div>

                    <div className="mt-2 flex items-center gap-2 pt-2 border-t border-[#EAF0F8]">
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5 bg-[#0F1C30] text-white hover:bg-[#304A6E]"
                        onClick={() => {
                          setModalExtender(t);
                          setDiasExtension(30);
                          setMontoExtension(150);
                        }}
                      >
                        <CalendarClock size={15} />
                        Extender / Habilitar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* TAB 2: PLANES DE SUSCRIPCIÓN */}
      {tab === 'planes' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {planes.map((p) => (
            <Card
              key={p.id_plan}
              className={`flex flex-col justify-between border-2 bg-white p-6 shadow-card ${
                p.nombre.toLowerCase().includes('profesional')
                  ? 'border-[#304A6E] ring-2 ring-[#C0D0EF]/60'
                  : 'border-[#D6E0ED]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <Badge variant="brand" className="text-xs">
                    Plan {p.nombre}
                  </Badge>
                  {p.nombre.toLowerCase().includes('profesional') && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-[#304A6E]">
                      <Sparkles size={14} /> Recomendado
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-[#0F1C30]">Bs. {p.precio_mensual}</span>
                  <span className="text-xs font-semibold text-[#7E91A8]">/ mes</span>
                </div>

                <p className="mt-2 text-xs text-[#546882]">{p.descripcion}</p>

                <ul className="mt-6 flex flex-col gap-2.5 text-xs text-[#384B63]">
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600" />
                    <span>Hasta <strong>{p.max_sucursales}</strong> sucursales físicas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600" />
                    <span>Hasta <strong>{p.max_productos}</strong> prendas en catálogo</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600" />
                    <span>Hasta <strong>{p.max_usuarios}</strong> usuarios / empleados</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {p.vestidor_ra_habilitado ? (
                      <Check size={16} className="text-emerald-600" />
                    ) : (
                      <span className="h-4 w-4 rounded-full bg-slate-200 text-center font-mono text-[10px] text-slate-500">✕</span>
                    )}
                    <span>Vestidor Virtual con Realidad Aumentada</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {p.reportes_ia_habilitado ? (
                      <Check size={16} className="text-emerald-600" />
                    ) : (
                      <span className="h-4 w-4 rounded-full bg-slate-200 text-center font-mono text-[10px] text-slate-500">✕</span>
                    )}
                    <span>Reportes Generativos de Voz e IA</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 border-t border-[#EAF0F8] pt-4">
                <Button variant="secondary" fullWidth size="sm">
                  Configurar Plan
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* TAB 3: ALTA DE NUEVA TIENDA SAAS */}
      {tab === 'nueva' && (
        <Card className="max-w-2xl border-[#D6E0ED] bg-white shadow-card">
          <CardHeader>
            <CardTitle className="text-xl font-black text-[#0F1C30]">
              Registrar Nueva Tienda en la Plataforma
            </CardTitle>
            <CardDescription className="text-sm text-[#546882]">
              Crea el inquilino (tenant) para tu cliente con su propia base de stock, sucursal inicial y acceso de administrador.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleCrearTienda} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#0F1C30]">
                    Nombre de la Tienda / Negocio *
                  </label>
                  <input
                    type="text"
                    required
                    value={nuevoNombre}
                    onChange={(e) => {
                      setNuevoNombre(e.target.value);
                      if (!nuevoSlug) {
                        setNuevoSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/(^-|-$)/g, ''),
                        );
                      }
                    }}
                    placeholder="Ej. Boutique Paris, Urbana Wear"
                    className="h-10 w-full rounded-xl border border-[#D6E0ED] bg-[#F5F8FC] px-3 text-sm text-[#0F1C30] outline-none focus:border-[#304A6E] focus:ring-2 focus:ring-[#C0D0EF]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#0F1C30]">
                    Slug / Subdominio URL
                  </label>
                  <input
                    type="text"
                    value={nuevoSlug}
                    onChange={(e) => setNuevoSlug(e.target.value)}
                    placeholder="boutique-paris"
                    className="h-10 w-full rounded-xl border border-[#D6E0ED] bg-[#F5F8FC] px-3 font-mono text-sm text-[#0F1C30] outline-none focus:border-[#304A6E] focus:ring-2 focus:ring-[#C0D0EF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#0F1C30]">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    value={nuevoTelefono}
                    onChange={(e) => setNuevoTelefono(e.target.value)}
                    placeholder="78900000"
                    className="h-10 w-full rounded-xl border border-[#D6E0ED] bg-[#F5F8FC] px-3 text-sm text-[#0F1C30] outline-none focus:border-[#304A6E] focus:ring-2 focus:ring-[#C0D0EF]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#0F1C30]">
                    NIT / Identificación Fiscal
                  </label>
                  <input
                    type="text"
                    value={nuevoNit}
                    onChange={(e) => setNuevoNit(e.target.value)}
                    placeholder="1029384756"
                    className="h-10 w-full rounded-xl border border-[#D6E0ED] bg-[#F5F8FC] px-3 text-sm text-[#0F1C30] outline-none focus:border-[#304A6E] focus:ring-2 focus:ring-[#C0D0EF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#0F1C30]">
                    Plan de Suscripción Inicial
                  </label>
                  <select
                    value={nuevoPlanId}
                    onChange={(e) => setNuevoPlanId(Number(e.target.value))}
                    className="h-10 w-full rounded-xl border border-[#D6E0ED] bg-[#F5F8FC] px-3 text-sm text-[#0F1C30] outline-none focus:border-[#304A6E] focus:ring-2 focus:ring-[#C0D0EF]"
                  >
                    {planes.map((p) => (
                      <option key={p.id_plan} value={p.id_plan}>
                        {p.nombre} (Bs. {p.precio_mensual}/mes)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#0F1C30]">
                    Días de Habilitación Inicial
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={730}
                    value={nuevoDias}
                    onChange={(e) => setNuevoDias(Number(e.target.value))}
                    className="h-10 w-full rounded-xl border border-[#D6E0ED] bg-[#F5F8FC] px-3 text-sm text-[#0F1C30] outline-none focus:border-[#304A6E] focus:ring-2 focus:ring-[#C0D0EF]"
                  />
                </div>
              </div>

              <div className="border-t border-[#EAF0F8] pt-3">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#304A6E]">
                  Acceso del Administrador de la Tienda
                </h4>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#0F1C30]">
                      Email del Administrador *
                    </label>
                    <input
                      type="email"
                      required
                      value={nuevoAdminEmail}
                      onChange={(e) => setNuevoAdminEmail(e.target.value)}
                      placeholder="admin@boutiqueparis.com"
                      className="h-10 w-full rounded-xl border border-[#D6E0ED] bg-[#F5F8FC] px-3 text-sm text-[#0F1C30] outline-none focus:border-[#304A6E] focus:ring-2 focus:ring-[#C0D0EF]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#0F1C30]">
                      Contraseña Temporal
                    </label>
                    <input
                      type="text"
                      required
                      value={nuevoAdminPass}
                      onChange={(e) => setNuevoAdminPass(e.target.value)}
                      className="h-10 w-full rounded-xl border border-[#D6E0ED] bg-[#F5F8FC] px-3 font-mono text-sm text-[#0F1C30] outline-none focus:border-[#304A6E] focus:ring-2 focus:ring-[#C0D0EF]"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setTab('tiendas')}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  loading={creando}
                  className="bg-[#0F1C30] text-white hover:bg-[#304A6E]"
                >
                  Crear Tienda y Habilitar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* MODAL PARA EXTENDER / HABILITAR TIEMPO DE SUSCRIPCIÓN */}
      {modalExtender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#D6E0ED] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EAF0F8] pb-3">
              <div>
                <h3 className="text-lg font-black text-[#0F1C30]">Habilitar / Extender Suscripción</h3>
                <p className="text-xs text-[#546882]">Tienda: <strong>{modalExtender.nombre}</strong></p>
              </div>
              <button
                onClick={() => setModalExtender(null)}
                className="rounded-lg p-1 text-[#7E91A8] hover:bg-[#F5F8FC] hover:text-[#0F1C30]"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#0F1C30]">
                  Selecciona el periodo a habilitar:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDiasExtension(30);
                      setMontoExtension(150);
                    }}
                    className={`rounded-xl border p-2.5 text-center text-xs font-bold transition-all ${
                      diasExtension === 30
                        ? 'border-[#0F1C30] bg-[#0F1C30] text-white shadow-xs'
                        : 'border-[#D6E0ED] bg-[#F5F8FC] text-[#384B63] hover:border-[#304A6E]'
                    }`}
                  >
                    +30 Días (1 Mes)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDiasExtension(90);
                      setMontoExtension(400);
                    }}
                    className={`rounded-xl border p-2.5 text-center text-xs font-bold transition-all ${
                      diasExtension === 90
                        ? 'border-[#0F1C30] bg-[#0F1C30] text-white shadow-xs'
                        : 'border-[#D6E0ED] bg-[#F5F8FC] text-[#384B63] hover:border-[#304A6E]'
                    }`}
                  >
                    +90 Días (Trimestre)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDiasExtension(365);
                      setMontoExtension(1500);
                    }}
                    className={`rounded-xl border p-2.5 text-center text-xs font-bold transition-all ${
                      diasExtension === 365
                        ? 'border-[#0F1C30] bg-[#0F1C30] text-white shadow-xs'
                        : 'border-[#D6E0ED] bg-[#F5F8FC] text-[#384B63] hover:border-[#304A6E]'
                    }`}
                  >
                    +365 Días (1 Año)
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#0F1C30]">
                  Días específicos:
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={diasExtension}
                  onChange={(e) => setDiasExtension(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-[#D6E0ED] bg-[#F5F8FC] px-3 text-sm text-[#0F1C30] outline-none focus:border-[#304A6E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#0F1C30]">
                    Monto Cobrado (Bs.)
                  </label>
                  <input
                    type="number"
                    value={montoExtension}
                    onChange={(e) => setMontoExtension(Number(e.target.value))}
                    className="h-10 w-full rounded-xl border border-[#D6E0ED] bg-[#F5F8FC] px-3 text-sm text-[#0F1C30] outline-none focus:border-[#304A6E]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#0F1C30]">
                    Método de Pago
                  </label>
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#D6E0ED] bg-[#F5F8FC] px-3 text-sm text-[#0F1C30] outline-none focus:border-[#304A6E]"
                  >
                    <option value="QR_Bancario">QR Simple</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Tarjeta">Tarjeta de Débito/Crédito</option>
                    <option value="Efectivo">Efectivo en Caja</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t border-[#EAF0F8] pt-4">
                <Button variant="secondary" onClick={() => setModalExtender(null)}>
                  Cerrar
                </Button>
                <Button
                  loading={procesandoExtension}
                  onClick={ejecutarExtension}
                  className="bg-[#0F1C30] text-white hover:bg-[#304A6E]"
                >
                  Confirmar y Habilitar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
