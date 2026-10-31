# PLATAFORMA SISTEMAS 2 - Registro de Avances

## Contenido
1. [Contexto del Proyecto](#contexto-del-proyecto)
2. [Enunciado de la Ingeniera](#enunciado-de-la-ingeniera)
3. [Estructura de la Documentación Exigida](#estructura-de-la-documentacion-exigida)
4. [Fuente de Adaptación (Sistemas 1)](#fuente-de-adaptacion-sistemas-1)
5. [Plan de Trabajo](#plan-de-trabajo)
6. [Avances Realizados](#avances-realizados)
7. [Pendientes](#pendientes)
8. [Historial de Cambios](#historial-de-cambios)

---

## Contexto del Proyecto

- **Materia:** Sistemas 2
- **Evaluación:** Primer Parcial — Examen 1 – S2-2026
- **Materia / Docente:** Sistemas II — MSc. Ing. Angélica Garzón Cuéllar
- **Nombre del sistema:** **Tiendas Montaño** — Plataforma Inteligente de Comercio Electrónico para Tienda de Ropa con Vestidores Virtuales vía Realidad Aumentada
- **Paradigma de desarrollo:** PUDS (Proceso Unificado de Desarrollo de Software)
- **Modelado:** UML 2.5+
- **Duración:** máx. 4 semanas — se debe priorizar un **MVP** (Producto Mínimo Viable) completamente funcional.
- **Despliegue:** en la nube (no localhost)
- **Prohibiciones:** no usar frameworks e-commerce (PrestaShop, Shopify, Magento, WooCommerce y similares).

### Stack Tecnológico
| Capa | Tecnología |
|------|------------|
| Backend | Python + FastAPI |
| Frontend web | Angular |
| Aplicación móvil | Flutter + Dart |
| Base de datos | PostgreSQL (relacional) |
| Inteligencia artificial | Modelo/servicio de IA integrado mediante API |
| Realidad aumentada | Tecnología compatible con dispositivos móviles |
| Pagos | Integración con pasarela de pago |

### Descripción resumida del sistema
Cadena de tiendas de ropa con varias sucursales en distintas ciudades. Debe ofrecer:
- Catálogo de prendas consultable por **web y móvil** con tallas, colores y disponibilidad por sucursal.
- **Reservas de varias prendas** para probarlas luego en una sucursal física.
- **Vestidores virtuales con realidad aumentada** (móvil): visualizar cómo luce una prenda con la cámara.
- Compra de dos formas: **presencial** (punto de caja de la sucursal) y **digital** (pasarela de pago web/móvil).
- **Inventario automático** por producto, talla, color, sucursal y temporada (actualizado tras reservas, ventas, devoluciones y recepción de productos).
- Gestión de **proveedores, productos, temporadas, colecciones y movimientos de inventario**.
- Información consolidada de existencias (disponibles, reservadas, vendidas, agotadas, próximas a ingresar).
- **IA**: asistente virtual / recomendador de prendas (preferencias, historial, temporada, categoría, talla, disponibilidad); reportes generativos por voz opcionales.

### Actores del sistema
1. **Cliente** — registro/login, catálogo, búsqueda y filtros, tallas/colores, disponibilidad por sucursal, vestidor virtual (RA), reservar y cancelar reservas, comprar web/móvil, pagos electrónicos, historial de compras, recomendaciones IA.
2. **Administrador** — usuarios y roles, sucursales, productos, categorías/tallas/colores, temporadas y colecciones, proveedores, inventario global, promociones, ventas y reservas, indicadores empresariales.
3. **Encargado de sucursal** — consultar reservas, preparar prendas reservadas, confirmar recepción del cliente, gestionar disponibilidad, registrar movimientos de inventario, consultar ventas de sucursal.
4. **Cajero** — consultar productos, registrar ventas presenciales, procesar pagos en caja, emitir comprobantes, actualizar inventario tras venta.
5. **Proveedor** — registrar/enviar información de productos, informar disponibilidad, asociar productos a temporadas y colecciones.
6. **Sistema de pagos** — procesar pagos electrónicos, confirmar/rechazar transacciones, informar estado del pago.
7. **Servicio de inteligencia artificial** — analizar preferencias, recomendar productos, asistir (chatbot/inteligente), reportes generativos por voz.

### Requisitos funcionales (RF01–RF25)
1. RF01: registrar clientes. | RF02: gestionar usuarios y roles. | RF03: administrar ciudades y sucursales. | RF04: gestionar productos de ropa. | RF05: gestionar tallas, colores, categorías y temporadas. | RF06: gestionar proveedores. | RF07: consultar catálogo (web y móvil). | RF08: consultar disponibilidad por sucursal. | RF09: seleccionar múltiples prendas en una reserva. | RF10: registrar y gestionar reservas. | RF11: notificar reservas a la sucursal. | RF12: consultar estado de una reserva. | RF13: vestidor virtual (RA) en móvil. | RF14: agregar productos al carrito. | RF15: comprar por web. | RF16: comprar por móvil. | RF17: registrar ventas presenciales (cajero). | RF18: pagos en punto de caja. | RF19: pasarela de pago para compras digitales. | RF20: actualizar inventario tras venta. | RF21: controlar existencias por sucursal. | RF22: registrar movimientos de inventario. | RF23: gestionar temporadas y colecciones. | RF24: reportes de ventas e inventario. | RF25: al menos una funcionalidad basada en IA.

### Requisitos no funcionales (RNF01–RNF09)
1. RNF01 Seguridad de contraseñas y datos sensibles. | RNF02 Rendimiento en consultas de catálogo. | RNF03 Disponibilidad web y móvil. | RNF04 Escalabilidad (nuevas sucursales y ciudades). | RNF05 Usabilidad (intuitiva y adaptable a dispositivos). | RNF06 Mantenibilidad (módulos y buenas prácticas). | RNF07 Integración: FastAPI con API REST. | RNF08 Compatibilidad móvil: Flutter/Dart. | RNF09 Seguridad transaccional (pagos con mecanismos seguros, entornos de prueba).

---

## Estructura de la Documentación Exigida

### 1) Perfil
- 1.1 Introducción
- 1.2 Objetivo General
- 1.3 Objetivos Específicos
- 1.4 Descripción del problema
- 1.5 Alcance

### Parte I – Fundamentación Teórica
a) **E-commerce** (conceptos generales y características)
- Como usuario: cómo funciona **Amazon**, **Alibaba**, **Shopify**
- Como desarrollador: utilidad/beneficios de **Magento**, **PrestaShop**, **WooCommerce** para tiendas online

b) **Pasarelas de pago**
- Formas de pago online: tarjetas de débito, crédito, QR, transferencias
- **LIBÉLULA** (pasarela usada en Bolivia/nuestro medio)
- **PayPal** y **Stripe** (pasarelas internacionales)

c) **Deliverys**
- Cómo funcionan (ej. **Yaigo–Yummy**)
- Cálculo de pagos para una entrega: distancia, peso, frecuencia, tamaño, etc.

d) **PUDS** (Proceso Unificado de Desarrollo de Software)

e) **UML**

### Parte II – Proceso de desarrollo
a) Pasos del PUDS: **captura de requisitos, análisis, diseño, implementación y pruebas**
b) Modelos UML pertinentes en cada flujo de trabajo

---

## Fuente de Adaptacion (Sistemas 1)

> Aquí registramos la documentación PUDS hecha en Sistemas 1 que servirá como base para adaptarla a la nueva plataforma.

- **Sistema de referencia:** _(pendiente: se agregará cuando el estudiante pase la documentación de Sistemas 1)_
- **Documentación entregada:** _(pendiente)_
- **Puntos que serán adaptados:** _(pendiente)_

---

## Plan de Trabajo

_Etapas del PUDS aplicadas al proyecto. Se irán marcando según se avance._

### Documentación
- [ ] 1. Perfil (Introducción, Objetivo General y Específicos, Descripción del problema, Alcance)
  - [x] 1.1 Introducción
  - [x] 1.2 Objetivo General
  - [x] 1.3 Objetivos Específicos
  - [x] 1.4 Descripción del problema
  - [x] 1.5 Alcance
- [ ] 2. Fundamentación Teórica (E-commerce, Pasarelas de pago, Deliverys, PUDS, UML)
  - [x] a) E-commerce (conceptos + Amazon/Alibaba/Shopify + Magento/PrestaShop/WooCommerce)
  - [ ] b) Pasarelas de pago
  - [ ] c) Deliverys
  - [ ] d) PUDS
  - [ ] e) UML
- [ ] 3. Modelado de Negocio
  - [ ] 3.1 Términos del Negocio
  - [ ] 3.2 Reglas del Negocio
  - [ ] 3.3 Diagramas de Modelado de Negocio
- [ ] 4. Requerimientos
  - [x] 4.1 Especificación de Requerimientos Funcionales (RF)
  - [x] 4.2 Especificación de Requerimientos No Funcionales (RNF)
  - [x] 4.3 Actores del Sistema
  - [x] 4.4 Casos de Uso (lista de 46 CU en 8 grupos, trazados a RF01–RF25)
  - [ ] 4.5 Diagramas de Casos de Uso
- [ ] 5. Análisis y Diseño
  - [ ] 5.1 Diagramas de Clases
  - [ ] 5.2 Diagramas de Secuencia
  - [ ] 5.3 Diagramas de Colaboración
  - [ ] 5.4 Diagramas de Estados
  - [ ] 5.5 Diagramas de Actividades
  - [ ] 5.6 Diagramas de Componentes
  - [ ] 5.7 Diagramas de Despliegue

### Desarrollo (MVP)
- [ ] 6. Base de Datos (PostgreSQL)
- [ ] 7. Prototipo (mockups web y móvil)
- [ ] 8. Implementación
  - [ ] 8.1 Backend: Python + FastAPI (API REST)
  - [ ] 8.2 Frontend web: Angular
  - [ ] 8.3 Aplicación móvil: Flutter + Dart
  - [ ] 8.4 Integración IA (asistente/recomendador)
  - [ ] 8.5 Realidad Aumentada (vestidor virtual)
  - [ ] 8.6 Pasarela de pago (entornos de prueba)
- [ ] 9. Pruebas
  - [ ] 9.1 Casos de Prueba
- [ ] 10. Despliegue en la nube

---

## Avances Realizados

### Sábado 29 de Agosto de 2026
- Se definió trabajar sobre la carpeta **PLATAFORMA WEB Y MOVIL DE E-COMMERCE DE TIENDA DE ROPA** (proyecto de Sistemas 2).
- Se creó la estructura de carpetas del proyecto según las fases del **PUDS**.
- Se creó este archivo `AVANCES.md` como registro de contexto, avances y pendientes.
- Se registró el **enunciado completo de la Ingeniera**: contexto, stack tecnológico, actores, RF01–RF25, RNF01–RNF09 y estructura de la documentación exigida.
- Se identificaron documentos de referencia dentro del proyecto:
  - `DOCUMENTACION/DOC E-COMMERCE.docx/.pdf`: ejemplo de otro grupo ("Sistema Web y Móvil para la Gestión Integral de Emprendimientos y Startups") que muestra la estructura que exige la Ingeniera.
  - `EJEMPLO DE DOCUMENTACION/Real PG 18 SI2.docx`: ejemplo académico de referencia.
- **Perfil 1.1 Introducción** redactado y adaptado a Tiendas Montaño (entregado en el chat para copiar a Word).
- **Perfil 1.4 Descripción del Problema** redactado y adaptado a Tiendas Montaño (entregado en el chat para copiar a Word).
- **Perfil 1.5 Alcance** redactado y adaptado a Tiendas Montaño: 15 módulos funcionales (usuarios/RBAC, ciudades y sucursales, catálogo, tallas/colores/categorías/temporadas, proveedores, inventario Kardex, disponibilidad consolidada, reservas, vestidor virtual RA, carrito y compra digital, ventas en caja, pasarela de pago, devoluciones, IA recomendadora, reportes y dashboards) + priorización del MVP. → `DOCUMENTACION/1.5 Alcance.md`.
- **1.5 Alcance — Aplicación Móvil** agregada: acceso remoto, vestidor virtual RA, monitoreo en tienda, alertas y notificaciones, y panel de reportes móvil.
- **Requerimientos**: se redactaron los apartados Actores principales (7 actores), Requisitos funcionales (RF01–RF25), Requisitos no funcionales (RNF01–RNF09) y la **Matriz de trazabilidad RF ↔ Módulos** verificando que los 25 RF están cubiertos por los 15 módulos + App Móvil (ninguno falta). → `DOCUMENTACION/2 Analisis de Requerimientos.md`.
- **Fundamentación Teórica a) E-commerce** redactada: conceptos generales, características, tipos y proceso de compra; experiencia como usuario (Amazon, Alibaba, Shopify); experiencia como desarrollador (Magento, PrestaShop, WooCommerce) + justificación de plataforma propia (prohibición de frameworks e-commerce) y bibliografía. → `DOCUMENTACION/Parte I - Fundamentacion Teorica - E-commerce.md`.
- **Flujos de trabajo PUDS – Requisitos 2.1 Identificación de Actores**: 7 actores adaptados (4 internos: Administrador, Encargado de Sucursal, Cajero, Cliente; 3 externos: Proveedor, Sistema de Pagos, Servicio de IA), con Rol Sistémico e Impacto en Vida Real. → `DOCUMENTACION/2.1 Actores del Sistema.md`.
- **Documentación consolidada** en un solo archivo → `DOCUMENTACION/DOCUMENTACION COMPLETA.md` (incluye Perfil 1.1/1.4/1.5, Análisis de Requerimientos, Actores PUDS y Fundamentación E-commerce; secciones pendientes listadas al final).
- **Actores del Sistema refinado** con estilo técnico (referencias a tablas del modelo de datos: `productos`, `inventario_stock`, `reservas`, `ventas`, `transacciones_pago`, `recomendaciones_ia`, etc.) para los 7 actores → `DOCUMENTACION/2.1 Actores del Sistema.md`.
- **Perfil 1.2 Objetivo General y 1.3 Objetivos Específicos** redactados (10 objetivos específicos trazables a los RF) y adaptados a Tiendas Montaño (entregados en el chat para copiar a Word). → `DOCUMENTACION/1.2 y 1.3 Objetivos.md`.
- **Flujos PUDS – 2.2 Lista de Casos de Uso**: 46 casos de uso en 8 grupos (Acceso/registro, Usuarios-RBAC, Catálogo/sucursales, Proveedores, Inventario, Reservas/vestidor RA, Venta/pago/devoluciones, IA y reporting) con prioridades, trazados a RF01–RF25 y a los módulos del Alcance. → `DOCUMENTACION/2.2 Casos de Uso.md`.
- **Detalle de Casos de Uso — Ciclo 1 v2** (CU01–CU27): reescritos con especificación técnica completa: endpoints exactos (/api/v1/...), queries SQL, tablas y columnas específicas del modelo, mensajes de error exactos al usuario, cruces con otros CU, comportamiento visual (badges, colores, toast), estados de tablas (old_data/new_data), y precondiciones con referencias a tablas y permisos. → `DOCUMENTACION/Detalle CU Ciclo 1 v2.md`.

### Martes 1 de Septiembre de 2026 (continuación)
- El usuario detectó **inconsistencia de detalle** en el v2: CU01 muy rico, pero CU09/CU10/CU18–CU27 más esquemáticos. Pidió "intensificar a partir del CU07"; se mantuvo v2 intacto y se creó un archivo nuevo.
- **Detalle de Casos de Uso — Ciclo 1 v3** (CU07–CU27) creado: reescritos todos al **estándar CU01** (máxima calidad técnica unificada). Cada CU con: PROPÓSITO, DESCRIPCIÓN (endpoints `/api/v1/` exactos, SQL queries, tablas/columnas del modelo, mensajes exactos, componentes UI Angular/Flutter con nombre, RBAC explícito, prevención de enumeración, bcrypt rounds=12, JWT 8h/7d, toasts, badges, old_data/new_data en bitácora), ACTORES, ACTOR INICIADOR, PRECONDICIÓN, FLUJO PRINCIPAL, POST CONDICIÓN, EXCEPCIONES, CASOS DE USO RELACIONADOS. → `DOCUMENTACION/Detalle CU Ciclo 1 v3.md` (verificado: CU07–CU27, 21 CU sin faltantes/duplicados).
- **Entrega en chat**: el usuario confirmó el **formato correcto para Word** (tabla de 2 columnas, filas `ETIQUETA⇥valor` con TAB real, **cada valor en una sola línea/celda** — sin romper en varias líneas). Se entregaron los **CU07–CU27 v3** completos en ese formato para copiar a Word. Lección clave: no acortar el contenido, pero mantener cada campo en una sola línea. El usuario aclaró que su tabla omite/usa 9 filas (el ejemplo que pegó bien no incluía "CASOS DE USO RELACIONADOS").

---

## Pendientes

- [ ] Recibir la documentación PUDS del sistema de Sistemas 1 para adaptarla a Tiendas Montaño.
- [ ] Definir la priorización del **MVP** (funcionalidades esenciales a implementar en 4 semanas).
- [ ] Definir qué pasarela de pago se usará en pruebas (LIBÉLULA / PayPal / Stripe u otra).
- [ ] Definir el modelo/servicio de IA y la tecnología de Realidad Aumentada para móvil.
- [ ] Completar el **Perfil** (1.1 – 1.5).
- [ ] Desarrollar la **Fundamentación Teórica** (Parte I).

---

## Historial de Cambios

| Fecha | Descripción |
|-------|-------------|
| 29/08/2026 | Creación de la estructura de carpetas PUDS y del archivo de avances |
| 29/08/2026 | Registro del enunciado completo de la Ingeniera (contexto, actores, RF, RNF, estructura doc.) |
| 29/08/2026 | Redacción del Perfil 1.1 Introducción adaptado a FashionStore |
| 29/08/2026 | Redacción del Perfil 1.4 Descripción del Problema adaptado a Tiendas Montaño |
| 29/08/2026 | Cambio de nombre oficial: **FashionStore → Tiendas Montaño** |
| 29/08/2026 | Redacción del Perfil 1.5 Alcance (15 módulos funcionales + priorización MVP) |
| 29/08/2026 | Agregado del apartado Aplicación Móvil al Alcance de Tiendas Montaño |
| 29/08/2026 | Requerimientos: Actores, RF01–RF25, RNF01–RNF09 y matriz de trazabilidad RF ↔ Módulos |
| 29/08/2026 | Fundamentación Teórica a) E-commerce (conceptos, Amazon/Alibaba/Shopify, Magento/PrestaShop/WooCommerce) |
| 29/08/2026 | Flujos PUDS: 2.1 Identificación de Actores del Sistema (7 actores: 4 internos, 3 externos) |
| 29/08/2026 | Consolidación de toda la documentación en `DOCUMENTACION COMPLETA.md` |
| 01/09/2026 | Perfil 1.2 Objetivo General y 1.3 Objetivos Específicos (10 OE trazables a RF) |
| 01/09/2026 | Flujos PUDS: 2.2 Lista de Casos de Uso (46 CU en 8 grupos con prioridades) |
| 01/09/2026 | Detalle de CU Ciclo 1 (CU01–CU27) con flujos principales y excepciones |
| 01/09/2026 | Detalle de CU Ciclo 1 **v3** (CU07–CU27) intensificado al estándar CU01 → `Detalle CU Ciclo 1 v3.md` |
| 31/10/2026 | Renovación de paleta a estética Nieve y Oxford Blue (#C2C6C3, #C0D0EF, #668DC0, #304A6E, #0F1C30) en Web y App Móvil. |
| 31/10/2026 | Arquitectura SaaS Multi-Tienda y Suscripciones: Módulo `saas` con entidades `tiendas`, `planes_suscripcion`, `suscripciones_tienda`, migración de `id_tienda` en tablas troncales y panel `AdminSaaS.tsx` (CU47). |
| 31/10/2026 | Modo Offline Tolerante a Fallos (Outbox Pattern): endpoint en lote `/ventas/sincronizar-offline`, buffer local y botón "Cargar datos pendientes" en POS Web (`AdminCaja.tsx`) y App Móvil (`cart_screen.dart`). |
| 31/10/2026 | Reportes Inteligentes con IA y Machine Learning: síntesis auditiva TTS en altavoz, modelos predictivos de demanda, Pareto ABC y detección de anomalías (`ReportesVoz.tsx`). |
| 31/10/2026 | Procesos Cíclicos automatizados con `@nestjs/schedule` para expiración diaria de suscripciones, recálculo periódico de ML y mantenimiento. |