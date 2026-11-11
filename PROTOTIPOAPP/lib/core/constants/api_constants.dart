class ApiConstants {
  // URL de Producción en Render o Desarrollo Local.
  // Al desplegar en Render, reemplaza con tu URL de Render (ej: 'https://tienda-vra-api.onrender.com/api/v1')
  // O compila pasando: --dart-define=API_URL=https://tu-api.onrender.com/api/v1
  static String baseUrl = const String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://192.168.0.11:3000/api/v1',
  );

  static void setBaseUrl(String newUrl) {
    baseUrl = newUrl;
  }

  // Autenticación
  static const String login = '/auth/login';
  static const String registro = '/auth/registro';
  static const String refresh = '/auth/refresh';
  static const String perfil = '/auth/perfil';

  // Catálogo Público
  static const String catalogoPublico = '/catalogo/publico';
  static const String catalogoOpciones = '/catalogo/publico/opciones';
  static String productoDetalle(String codigo) => '/catalogo/publico/$codigo';
  static String productoDisponibilidad(String codigo) => '/catalogo/publico/$codigo/disponibilidad';

  // Reservas
  static const String reservas = '/reservas';
  static const String misReservas = '/reservas/mias';
  static const String reservasSucursal = '/reservas/sucursal';
  static String prepararReserva(int id) => '/reservas/$id/preparar';
  static String confirmarRecepcionReserva(int id) => '/reservas/$id/confirmar-recepcion';
  static String cancelarReserva(int id) => '/reservas/$id/cancelar';

  // Carrito y Ventas
  static const String carrito = '/carrito';
  static const String carritoItems = '/carrito/items';
  static const String carritoVaciar = '/carrito/vaciar';
  static const String checkout = '/ventas/checkout';

  // Vestidor RA y Recomendaciones IA
  static const String sesionesRa = '/sesiones-ra';
  static String resultadoRa(int id) => '/sesiones-ra/$id/resultado';
  static const String recomendacionesIa = '/recomendaciones';

  // Admin / Sucursal / Seguridad
  static const String dashboardKpis = '/dashboard/kpis';
  static const String alertasCriticas = '/admin/alertas/criticas';
  static const String adminEmployees = '/admin/empleados';
  static const String adminRoles = '/admin/roles';
  static const String adminBranches = '/admin/sucursales';
  static const String adminCities = '/admin/ciudades';
  static const String adminAudit = '/admin/auditoria';
  static const String adminInventoryStock = '/admin/inventario/existencias';
  static const String adminProducts = '/admin/catalogo/productos';
  static const String reportesVoz = '/reportes/voz';
  static const String adminClientes = '/admin/clientes';
}
