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

| Login | PassWord | Rol | Estado |
|---|---|---|---|
| `Joh12Man05$nm` | `Ger12abc34Def56@` | Gerente / Administrador | vigente |
| `Nor23Pen45@lp` | `Vet90vax11Bcd22*` | Médico Veterinario | vigente |
| `Oma12Rec78*om` | `Rec34ani56Mno78+` | Encargado de Recinto | vigente |
| `Mar45Mto90+cr` | `Mto01fij23Pqr45$` | Encargado de Mantenimiento | vigente |
| `Pro20Mot04+` | `Pro20Mot04Bar26+` | Gerente / Administrador | inicia en el futuro |
| `Pro24Mot04+` | `Pro24Mot04Bar26+` | Gerente / Administrador | cuenta desactivada |
| `Pro18Mot04+` | `Pro18Mot04Bar26+` | Gerente / Administrador | vigencia vencida |

> Las contraseñas están **en texto plano a propósito**: al no existir backend,
> cualquier cifrado sería cosmético y daría una falsa sensación de seguridad.
> Es una maqueta de datos de prueba, no un sistema en producción.

## Archivos de datos (fuente base)

| Archivo | Formato | Relación |
|---|---|---|
| `personas.txt` | `id_persona\|nombres\|ap_p\|ap_m\|puesto\|correo\|telefono` | mPersonas |
| `usuarios.txt` | `login\|password\|rol\|id_persona\|estado\|fec_ini\|fec_fin` | mUsuarios |
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

Los botones marcados con `data-real` ejecutan lógica real; el resto responde
**"Acción no disponible."** (30 funcionales / 179 visuales).

| Pantalla | Estado |
|---|---|
| `login.html` | **Funcional** — validación de formato, vigencia, bloqueo por intentos |
| `cambiar-password.html` | **Funcional** — reglas de PassWord y unicidad |
| `roles-accesos.html` | **Funcional** — altas/bajas de roles y asignaciones |
| `seguridad-roles.html` | **Funcional** — asignación de roles por usuario |
| `seguridad-usuarios.html` | **Funcional** — cuentas, bitácora, alta de personas |
| `seguridad-aplicaciones.html` | **Funcional** — CRUD de aplicaciones |
| `catalogo-mantenimiento.html` | **Funcional** — CRUD de catálogos |
| `mi-perfil.html` | **Lectura real** — datos de la sesión en curso |
| `index.html`, `inicio.html` | Sólo navegación |
| El resto (21 pantallas) | **Maqueta visual** — tablas y formularios estáticos |

Detalle por página de botones `data-real`: `cambiar-password` 2,
`catalogo-mantenimiento` 6, `roles-accesos` 6, `seguridad-aplicaciones` 6,
`seguridad-roles` 4, `seguridad-usuarios` 6.

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
- Rama de trabajo: `mejoras/auditoria-frontend` (correcciones de la auditoría).
  **No se hace `merge` a `main` sin revisión previa.**
