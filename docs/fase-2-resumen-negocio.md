# Fase 2 — Módulo de Cotizaciones
## Resumen para discusión con el cliente

> Documento de visión general orientado a negocio. No incluye detalles técnicos
> ni estimaciones de tiempo.

---

### ¿Qué es esta fase?

Hoy la aplicación permite armar y exportar una cotización, pero cada cotización
es, en la práctica, un documento aislado: no queda guardado de forma organizada
ni es fácil volver a él. La Fase 2 convierte esa capacidad en un **módulo
completo de gestión de cotizaciones**, donde el equipo comercial puede guardar
su trabajo, retomarlo, organizarlo y controlar quién ve qué.

---

### Qué podrán hacer los usuarios

**1. Guardar y recuperar cotizaciones**
Las cotizaciones quedarán almacenadas y disponibles para consultarlas,
reabrirlas y seguir trabajando en ellas en cualquier momento, sin perder el
trabajo hecho.

**2. Trabajar con borradores**
El equipo podrá crear **borradores**: cotizaciones en progreso que se guardan, se
editan, se recuperan y se eliminan libremente, sin convertirse todavía en un
documento "oficial". Cuando el borrador esté listo, se **convierte en cotización
definitiva** con su número formal asignado. Esto evita que se consuman números
oficiales en trabajos que aún no están terminados.

**3. Organizar y encontrar cotizaciones**
Listados, búsqueda y filtros para ubicar rápidamente una cotización por cliente,
estado, fecha o número.

**4. Perfiles y permisos (roles)**
Se introducen dos tipos de usuario:

- **Administrador:** visibilidad total sobre las cotizaciones del equipo.
- **Usuario (comercial):** acceso a sus propias cotizaciones.

Esto da control sobre qué información ve cada persona y sienta la base para
crecer a más roles en el futuro.

**5. Plantillas flexibles ("plantilla libre")**
Hoy todas las cotizaciones siguen una misma estructura de página. La Fase 2 añade
la posibilidad de crear cotizaciones con una **plantilla libre**, adaptada al
criterio del comercial, para los casos que no encajan en el formato estándar —
manteniendo el formato estándar disponible para el uso habitual.

**6. Imágenes de producto confiables y permanentes**
Las imágenes de los productos provienen de un servicio externo cuyos enlaces
caducan con el tiempo. Hoy eso significa que una cotización guardada puede
quedarse sin imágenes al reabrirla más adelante. La Fase 2 **guarda las imágenes
en nuestro propio almacenamiento**, de modo que las cotizaciones se vean
completas siempre, incluso tiempo después. Además, el sistema reutiliza de forma
inteligente las imágenes ya guardadas (sin duplicar trabajo) y las actualiza
periódicamente por si el producto cambia.

---

### Por qué importa para el negocio

- **No se pierde trabajo:** las cotizaciones quedan guardadas, organizadas y
  siempre disponibles.
- **Más agilidad:** los borradores permiten avanzar sin compromiso y formalizar
  solo cuando corresponde.
- **Control y seguridad:** cada persona ve lo que le corresponde según su rol.
- **Flexibilidad comercial:** se cubren tanto el caso estándar como las
  cotizaciones a medida.
- **Documentos duraderos:** una cotización guardada hoy se verá igual de completa
  dentro de meses.

---

### Punto de partida favorable

Buena parte de los cimientos de este módulo **ya están construidos** en fases
anteriores. La Fase 2 se apoya en ese trabajo previo para **completar, habilitar
y pulir** el módulo, en lugar de empezar de cero — lo que reduce el riesgo del
proyecto.

---

### Decisiones de negocio pendientes (a definir con el cliente)

Para cerrar el alcance necesitamos acordar algunos puntos de negocio, por
ejemplo:

- ¿En qué momento se asigna el **número oficial** de la cotización: al crear el
  borrador o al formalizarla?
- ¿Un comercial puede **ver o modificar** cotizaciones de otros, o solo el
  administrador?
- **Reemplazo o ausencia de un comercial** (vacaciones, licencias o ausencias
  prolongadas): ¿quién gestiona y ve las cotizaciones de ese comercial mientras
  no está? Opciones a evaluar:
  - Que las asuma quien tenga rol **administrador**, o
  - Habilitar una opción **configurable de reemplazo** (asignar temporalmente las
    cotizaciones de un comercial a otro, o transferir la cartera de clientes).
- ¿Las cotizaciones eliminadas se **archivan** (recuperables) o se borran
  definitivamente?
- ¿Con qué frecuencia conviene **refrescar las imágenes** de producto?
- **Tiempo de conservación de las imágenes.** El almacenamiento está en un plan
  gratuito con espacio limitado, por lo que no es viable guardar imágenes de
  forma indefinida. Esta decisión depende directamente de **cuánto tiempo hacia
  atrás se necesita poder recuperar una cotización completa (con sus imágenes)**:
  - Definir ese período de recuperación (por ejemplo, los últimos N meses) marca
    cuánto tiempo deben conservarse las imágenes.
  - Pasado ese período, las imágenes antiguas podrían depurarse para liberar
    espacio (la cotización se conserva, pero sus imágenes podrían dejar de estar
    disponibles).
  - A futuro, si se requiere un período de recuperación más largo, puede implicar
    ampliar el plan de almacenamiento.
