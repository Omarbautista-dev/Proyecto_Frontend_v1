# NutriZoo LT — Maqueta frontend

Maqueta estática (HTML + CSS + JS, sin backend ni base de datos) del sistema de
administración nutricional del Zoológico de La Trinitaria.

## Cómo ejecutarla

El proyecto lee los `.txt` con `fetch`, por lo que **no funciona abriendo los
archivos con `file://`**: necesita un servidor HTTP local.

```bash
cd Maquetado
python3 -m http.server 8000
# o: npx live-server
```

Luego abre <http://localhost:8000/login.html>.

## Cuentas de prueba

| Login | Contraseña inicial | Rol | Vigencia (desde–hasta) | Estado al 26/11/2026 |
|---|---|---|---|---|
| `Mau20Jos04+` | `Mau06Jes05Nin26*` | Encargado de Recinto | 28/11/2026–30/11/2026 | Pendiente de activar |
| `Bra18Yan04+` | `Bra07Ros05Car26*` | Gerente / Administrador | 25/11/2026–30/11/2026 | Vigente |
| `Tri10Cam05*` | `Tri10Cam05Dal26*` | Médico Veterinario | 20/11/2026–30/11/2026 | Vigente |
| `Pol10Sim05*` | `Pol10Sim05Sol26*` | Encargado de Mantenimiento | 20/11/2026–30/12/2026 | Vigente |
| `Gua10Lla05*` | `Gua10Lla05Alf26*` | Encargado de Recinto | 10/11/2026–20/12/2026 | Vigente |

> Son credenciales iniciales de demostración en texto plano; no se deben reutilizar fuera de pruebas locales ni en producción. El proyecto no tiene backend ni almacén seguro de contraseñas.

## Archivos de datos (fuente base)

| Archivo | Formato | Relación |
|---|---|---|
| `mDatosPersonales.txt` | `id_persona\|nombres\|ap_p\|ap_m\|puesto\|correo\|telefono` | mDatosPersonales |
| `mUsuarios.txt` | `login\|password\|rol\|id_persona\|estado\|fec_ini\|fec_fin` | mUsuarios |
| `roles.txt` | `clave_rol\|nombre\|descripcion\|accesos` | mRoles |
| `accesos.txt` | `id_acceso\|modulo\|operacion\|nombre` | mAccesos |
| `aplicaciones.txt` | `clave\|descripcion` | mAplicaciones |
| `catalogos.txt` | `id_catalogo\|nombre\|descripcion` | mCatalogos |
| `catalogos-registros.txt` | `id_catalogo\|clave\|descripcion` | mCatalogoRegistros |

El navegador **no puede escribir en los `.txt`**, así que cada alta, baja o
modificación se guarda encima en `localStorage` (claves `nz_*_respaldo`) y se
aplica sobre la base leída. Borrar esas claves del navegador restaura el
estado original.

## Pantallas: funcionales vs. maqueta

Los botones marcados con `data-real` ejecutan lógica local de la maqueta; otras pantallas usan datos estáticos de ejemplo. Esto no implica persistencia compartida ni seguridad de servidor.

| Pantalla | Estado |
|---|---|
| `login.html` | **Funcional** — validación de formato, vigencia, bloqueo por intentos |
| `cambiar-password.html` | **Funcional** — reglas de PassWord y unicidad |
| `roles-accesos.html` | **Funcional en navegador** — creación/edición/baja de roles y permisos, separada de asignaciones |
| `seguridad-roles.html` | **Funcional** — asignación de roles por usuario |
| `seguridad-usuarios.html` | **Funcional** — cuentas, bitácora, alta de personas |
| `seguridad-aplicaciones.html` | **Funcional** — CRUD de aplicaciones |
| `catalogo-mantenimiento.html` | **Funcional** — CRUD de catálogos |
| `mi-perfil.html` | **Lectura real** — datos de la sesión en curso |
| `reportes-oficiales.html` | **Vista previa local** — filtros y exportación de filas demo a imprimir/CSV |
| `gerente-tareas-recintos.html` | **Consulta local** — filtra filas estáticas de supervisión |
| `configuracion.html#respaldo` | Restauración deshabilitada; no hay base de datos |
| `index.html`, `inicio.html` | Sólo navegación |
| El resto | **Maqueta visual** — tablas y formularios estáticos |

Detalle por página de botones `data-real`: `cambiar-password` 2,
`catalogo-mantenimiento` 6, `roles-accesos` 6, `seguridad-aplicaciones` 6,
`seguridad-roles` 4, `seguridad-usuarios` 6. Los reportes y la vista de tareas no guardan un historial de generación/edición.

## Mejoras en la rama `agent/nutrizoo-consolidated-improvements`

- Los enlaces de reportes llevan a un centro común con filtros de periodo y vista previa. El origen actual son filas estáticas de demostración; la exportación disponible es imprimir/guardar como PDF desde el navegador y CSV compatible con Excel. No equivale a reportes transaccionales ni registra auditoría en servidor.
- `roles-accesos.html` administra la definición de roles y permisos; `seguridad-roles.html` conserva la asignación explícita de roles a cuentas. El editor ya no cambia asignaciones al editar un rol. Su almacenamiento y bitácora son locales al navegador, no controles de seguridad de producción.
- `gerente-tareas-recintos.html` ofrece consulta filtrable, sólo para Gerente en la interfaz, usando los ejemplos existentes de supervisión de alimentación. No hay tareas guardadas ni acceso seguro de servidor.
- La sección de respaldo/restauración está deshabilitada intencionalmente: no existe una base de datos real que restaurar.
- Los accesos a información clínica se limitan visualmente a Gerente/Médico Veterinario, pero una maqueta sin backend no puede garantizar confidencialidad ni auditoría.
- `mDatosPersonales.txt` y `mUsuarios.txt` contienen exclusivamente las cinco filas proporcionadas; los roles numéricos se expresan con las claves/nombres que ya reconoce el lector, salvo el rol administrador asignado a `Bra18Yan04+` por solicitud. Su puesto personal sigue siendo Encargado de Mantenimiento. Correo y teléfono quedan vacíos porque no se proporcionaron.

Estas pantallas no sustituyen la implementación de backend, base de datos, autenticación, permisos ni bitácora.

## Modelo de permisos

- `roles.txt` + `accesos.txt` son la fuente de verdad de los permisos.
- `PERMISOS` (en `app.js`) es **sólo el respaldo** si esos archivos no se
  pueden leer. Al cargarlos se comparan las dos fuentes y cualquier desfase
  se avisa en consola (`avisarDesfasePermisos`).
- Regla de negocio: Alta/Baja/Modificación ⇒ acceso `full`; sólo Consulta ⇒
  `consulta` (menú marcado con ◐).
- Cada pantalla declara `data-modulo` en `<body>`; el JS lee ese atributo en
  vez de números de módulo escritos a mano.

## Estructura

```
Maquetado/
├── *.html            31 pantallas
├── assets/
│   ├── css/estilos.css
│   └── js/app.js     IIFE única: sesión, permisos, validadores y módulos
└── *.txt             datos base
```

## Textos heredados del sistema legacy

Se conservan tal cual porque replican los mensajes del sistema que se modela:
`PassWord`, `Cuenta desabilitada…`, `USUARIO SELECC.`, `Name User`, etc.

## Control de versiones

- Rama base: `main` (estado original de la maqueta).
- Rama de trabajo de estas mejoras: `agent/nutrizoo-consolidated-improvements` (creada desde la rama activa al iniciar el trabajo).
  **No se hace `merge` a la rama principal sin revisión previa.**
