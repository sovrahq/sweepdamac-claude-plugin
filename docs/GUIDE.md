# SweepDaMac — Guía Completa

> Sweep your Mac clean, right from Claude Code.

---

## Tabla de Contenidos

1. [Qué es SweepDaMac](#qué-es-sweepdamac)
2. [Arquitectura](#arquitectura)
3. [Instalación](#instalación)
4. [Las 14 Herramientas](#las-14-herramientas)
5. [Ejemplos de Uso](#ejemplos-de-uso)
6. [Seguridad](#seguridad)
7. [Desarrollo](#desarrollo)
8. [Distribución](#distribución)

---

## Qué es SweepDaMac

SweepDaMac es un **plugin de Claude Code** que trae funcionalidad de limpieza, optimización y mantenimiento de macOS directamente a tu terminal. Funciona como un **MCP Server** (Model Context Protocol) que expone 14 herramientas que Claude puede usar para analizar y limpiar tu Mac.

### Cómo funciona

```
┌─────────────────┐     stdio      ┌──────────────────┐
│   Claude Code   │◄──────────────►│  SweepDaMac MCP  │
│   (CLI/IDE)     │   JSON-RPC     │     Server       │
└─────────────────┘                └──────┬───────────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │    macOS      │
                                   │  filesystem,  │
                                   │  launchctl,   │
                                   │  osascript,   │
                                   │  diskutil...  │
                                   └──────────────┘
```

1. **Tú hablas con Claude** en lenguaje natural: "Escanea mi sistema en busca de basura"
2. **Claude decide** qué herramienta usar y con qué parámetros
3. **El MCP Server ejecuta** la operación en tu Mac
4. **Claude te muestra** los resultados formateados en markdown
5. **Para operaciones destructivas**, siempre pide confirmación explícita

---

## Arquitectura

### Tecnologías

| Componente | Tecnología |
|------------|-----------|
| Runtime | Node.js 18+ |
| Lenguaje | TypeScript (ESM) |
| Protocolo | MCP (Model Context Protocol) |
| SDK | @modelcontextprotocol/sdk |
| Validación | Zod |
| Transporte | stdio (JSON-RPC sobre stdin/stdout) |

### Estructura del proyecto

```
sweepdamac-claude-plugin/
├── .claude-plugin/
│   └── plugin.json          # Manifiesto del plugin
├── .mcp.json                # Configuración MCP
├── .gitignore
├── README.md
├── docs/
│   └── GUIDE.md             # Esta guía
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts         # Entry point — registra las 14 tools
│   │   ├── tools/
│   │   │   ├── system-junk.ts      # scan + clean junk
│   │   │   ├── trash.ts            # vaciar papelera
│   │   │   ├── large-files.ts      # archivos grandes
│   │   │   ├── mail-cleanup.ts     # Mail.app
│   │   │   ├── privacy.ts          # browsers
│   │   │   ├── maintenance.ts      # tareas de sistema
│   │   │   ├── optimization.ts     # launch agents, login items, hung apps
│   │   │   ├── uninstaller.ts      # desinstalar apps
│   │   │   ├── space-lens.ts       # uso de disco
│   │   │   ├── extensions.ts       # extensiones del sistema
│   │   │   └── system-overview.ts  # resumen del sistema
│   │   └── utils/
│   │       ├── scanner.ts   # Escaneo de directorios y cálculo de tamaños
│   │       ├── formatter.ts # Formateo de bytes, tablas markdown
│   │       └── executor.ts  # Ejecución segura de comandos del sistema
│   └── dist/                # Output compilado (generado por `npm run build`)
```

---

## Instalación

### Prerequisitos

- macOS (cualquier versión reciente)
- Node.js 18 o superior
- Claude Code CLI instalado

### Opción A: Como Plugin (recomendado)

Desde Claude Code, ejecuta:

```
/plugin marketplace add sovrahq/sweepdamac-claude-plugin
/plugin install sweepdamac@sweepdamac-marketplace
```

Luego compila el MCP server (una sola vez):

```bash
./setup.sh
```

Reinicia Claude Code y listo.

### Opción B: Manual

```bash
git clone git@github.com:sovrahq/sweepdamac-claude-plugin.git
cd sweepdamac-claude-plugin
./setup.sh
```

Agrega a tu `~/.claude.json`:

```json
{
  "mcpServers": {
    "sweepdamac": {
      "command": "node",
      "args": ["/ruta/absoluta/a/sweepdamac-claude-plugin/server/dist/index.js"]
    }
  }
}
```

### Verificar

Reinicia Claude Code y prueba:

```
> /sweep
```

o simplemente:

```
> Muéstrame el system overview de mi Mac
```

Si ves información de tu sistema (disco, RAM, CPU, etc.), el plugin está funcionando.

---

## Las 14 Herramientas

### Herramientas de solo lectura (seguras)

#### 1. `scan_system_junk`
Escanea basura del sistema sin eliminar nada.

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `include_xcode` | boolean | false | Incluir DerivedData, Archives, DeviceSupport |
| `include_broken_prefs` | boolean | false | Incluir archivos .plist corruptos |

**Ubicaciones escaneadas:**
- `~/Library/Caches/*` — Caches de usuario
- `/Library/Caches/*` — Caches del sistema
- `~/Library/Logs/*` — Logs de usuario
- `/var/log/*` — Logs del sistema
- `~/Library/Logs/DiagnosticReports/*` — Reportes de crash

#### 2. `find_large_files`
Busca archivos grandes y viejos.

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `min_size_mb` | number | 100 | Tamaño mínimo en MB |
| `older_than_days` | number | 90 | Solo archivos más viejos que N días |
| `path` | string | ~ | Directorio a escanear |
| `limit` | number | 50 | Máximo de resultados |

#### 3. `space_lens`
Análisis de uso de disco con vista de árbol.

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `path` | string | ~ | Directorio a analizar |
| `depth` | number | 2 | Profundidad del árbol (1-4) |
| `limit` | number | 15 | Máximo items por nivel |

#### 4. `system_overview`
Resumen completo del sistema. Sin parámetros.

Muestra: versión de macOS, CPU, disco (total/usado/disponible/purgeable), RAM (total/activa/inactiva/wired/libre), top 5 procesos por CPU y RAM, uptime.

---

### Herramientas destructivas (requieren confirmación)

#### 5. `clean_system_junk`
Elimina basura por categoría.

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `categories` | string[] | sí | Categorías a limpiar |
| `confirm` | boolean | sí | Debe ser `true` |

**Categorías disponibles:** `user_caches`, `system_caches`, `user_logs`, `system_logs`, `diagnostic_reports`, `xcode_derived_data`, `xcode_archives`, `xcode_device_support`, `xcode_simulator_caches`, `broken_preferences`

#### 6. `empty_trash`
Vacía todas las papeleras.

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `confirm` | boolean | sí | `true` para vaciar, `false` para solo ver tamaño |

#### 7. `clean_mail`
Limpia adjuntos y descargas de Mail.app.

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `action` | "scan" \| "clean" | scan | Modo de operación |
| `confirm` | boolean | false | Requerido para clean |

#### 8. `clean_privacy`
Limpia datos de privacidad de browsers.

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `browsers` | string[] | ["safari","chrome"] | Browsers a limpiar |
| `categories` | string[] | ["cache"] | Categorías de datos |
| `action` | "scan" \| "clean" | scan | Modo |
| `confirm` | boolean | false | Requerido para clean |

**Browsers:** `safari`, `chrome`, `firefox`, `brave`
**Categorías:** `cache`, `history`, `cookies`, `downloads`, `autofill`, `recent_items`

---

### Herramientas de mantenimiento

#### 9. `run_maintenance`
Ejecuta tareas de mantenimiento del sistema.

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `tasks` | string[] | ["all"] | Tareas a ejecutar |
| `confirm` | boolean | — | Requerido |

**Tareas disponibles:**

| Tarea | Requiere sudo | Descripción |
|-------|:----:|-------------|
| `flush_dns` | sí | Limpia caché DNS |
| `free_ram` | sí | Libera memoria inactiva (`purge`) |
| `run_periodic` | sí | Ejecuta scripts periodic daily/weekly/monthly |
| `rebuild_spotlight` | sí | Reconstruye índice de Spotlight |
| `repair_permissions` | no | Repara permisos de disco |
| `rebuild_launch_services` | no | Reconstruye la DB de Launch Services |
| `speed_up_mail` | no | Elimina Envelope Index de Mail.app |
| `thin_time_machine` | sí | Elimina snapshots locales de Time Machine |

---

### Herramientas de optimización

#### 10. `manage_launch_agents`
Gestiona servicios en background.

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `action` | "list" \| "disable" \| "enable" | list | Acción |
| `label` | string | — | Label del agent (para disable/enable) |

#### 11. `manage_login_items`
Gestiona apps que arrancan al iniciar sesión.

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `action` | "list" \| "remove" | list | Acción |
| `name` | string | — | Nombre de la app a remover |

#### 12. `kill_hung_apps`
Detecta y mata apps que no responden.

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `force` | boolean | false | `true` para forzar cierre |

---

### Herramientas de gestión de apps

#### 13. `uninstall_app`
Desinstala una app completamente con todos sus archivos relacionados.

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `app_name` | string | — | Nombre exacto de la app |
| `action` | "scan" \| "uninstall" | scan | Modo |
| `confirm` | boolean | false | Requerido para uninstall |

**Busca en ~20 ubicaciones:**
- `/Applications/`, `~/Applications/`
- `~/Library/Application Support/`, `~/Library/Caches/`, `~/Library/Preferences/`
- `~/Library/Logs/`, `~/Library/Containers/`, `~/Library/Group Containers/`
- `~/Library/HTTPStorages/`, `~/Library/WebKit/`, `~/Library/Saved Application State/`
- `~/Library/Cookies/`, `~/Library/LaunchAgents/`
- `/Library/Application Support/`, `/Library/Caches/`, `/Library/LaunchAgents/`
- `/Library/LaunchDaemons/`, `/Library/Preferences/`, `/Library/PrivilegedHelperTools/`

#### 14. `manage_extensions`
Gestiona extensiones del sistema.

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `action` | "list" \| "delete" | list | Acción |
| `category` | string | all | Categoría de extensiones |
| `name` | string | — | Nombre para eliminar |
| `confirm` | boolean | false | Requerido para delete |

**Categorías:** `safari_extensions`, `preference_panes`, `spotlight_plugins`, `internet_plugins`, `quicklook_plugins`

---

## Ejemplos de Uso

### Limpieza rápida
```
> Escanea mi sistema y dime cuánta basura hay
> Limpia los caches de usuario y los logs viejos
```

### Liberar espacio
```
> Busca archivos de más de 500MB que no he tocado en 6 meses
> Muéstrame qué está ocupando más espacio en mi disco
> Vacía mi papelera
```

### Privacidad
```
> Escanea qué datos de privacidad tienen mis browsers
> Limpia el caché y cookies de Chrome y Safari
```

### Mantenimiento
```
> Ejecuta todas las tareas de mantenimiento
> Limpia el DNS y reconstruye Spotlight
> Qué launch agents tengo activos?
```

### Desinstalar apps
```
> Quiero desinstalar Slack completamente
> Muéstrame todos los archivos relacionados con Docker
```

### Monitoreo
```
> Dame un resumen de mi sistema
> Hay alguna app colgada?
> Qué apps arrancan con mi sesión?
```

---

## Seguridad

### Principios

1. **Scan primero, delete después** — Todas las herramientas destructivas tienen un modo scan/preview que es el default
2. **Confirmación explícita** — Se requiere `confirm: true` para cualquier eliminación
3. **Paths protegidos** — Nunca se tocan paths protegidos por SIP: `/System`, `/usr`, `/bin`, `/sbin`, `/private/var/db`
4. **Sin sorpresas** — Siempre se muestra exactamente qué se va a eliminar y cuánto espacio se va a liberar

### Qué NUNCA hace SweepDaMac

- No elimina archivos del sistema operativo
- No modifica configuraciones del sistema sin autorización
- No envía datos a ningún servidor externo
- No ejecuta código arbitrario
- No toca archivos dentro de apps protegidas por SIP

---

## Desarrollo

### Agregar una nueva herramienta

1. Crea un archivo en `server/src/tools/mi-tool.ts`
2. Define el schema con Zod y la función async
3. Regístrala en `server/src/index.ts` con `server.tool()`
4. Compila: `npm run build`

### Compilar en modo watch

```bash
cd server
npm run dev
```

### Probar manualmente

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/index.js
```

---

## Distribución

### Para el equipo

Una vez que el repo esté en GitHub, cada miembro del equipo ejecuta:

```
/plugin marketplace add sovrahq/sweepdamac-claude-plugin
/plugin install sweepdamac@sweepdamac-marketplace
```

Luego compila el MCP server (una sola vez):

```bash
./setup.sh
```

Y reinicia Claude Code.

### Gestión del plugin

```bash
# Ver plugins instalados
/plugin

# Actualizar
/plugin marketplace update sweepdamac-marketplace

# Desinstalar
/plugin uninstall sweepdamac@sweepdamac-marketplace

# Deshabilitar sin desinstalar
/plugin disable sweepdamac@sweepdamac-marketplace
```

### Para el marketplace oficial (futuro)

El plugin ya tiene la estructura necesaria:
- `.claude-plugin/plugin.json` — manifiesto del plugin
- `.claude-plugin/marketplace.json` — manifiesto del marketplace
- `.mcp.json` — auto-configuración del MCP server
- `skills/sweep/SKILL.md` — skill `/sweep`
- `setup.sh` — script de setup automático

Para publicar en el marketplace oficial de Anthropic:
- Claude.ai: `https://claude.ai/settings/plugins/submit`
- Console: `https://platform.claude.com/plugins/submit`

---

*SweepDaMac v1.0.0 — Sweep your Mac clean.*
