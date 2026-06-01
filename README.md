# TCT — Tu Casa Tracker

Aplicacion web progresiva (PWA) para la gestion colaborativa del hogar: finanzas, comidas, lista de compras, peso corporal y notificaciones push, todo en un mismo lugar.

## Que hace TCT

- **Presupuestos semanales y mensuales** separados por tipo (`comida` y `aseo`), con visualizacion de gasto restante, promedio diario, proyeccion y segment bar de progreso.
- **Registro de gastos** con productos desglosados (nombre, cantidad, precio unitario), edicion, eliminacion suave y auditoria de cambios.
- **Planificador de comidas** con calendario semanal. Sugerencias generadas por IA (Gemini) que usan los productos comprados como contexto real; cada receta incluye calorias estimadas, macros, ingredientes disponibles/faltantes y pasos de preparacion.
- **Lista de compras** conectada a recetas: los ingredientes faltantes se pueden enviar a la lista en un toque. Al marcar un item como comprado con precio, se crea el gasto automaticamente.
- **Registro de peso** diario (mañana y noche) con historial y progreso.
- **Notificaciones push** para recordar registrar peso o planificar comidas, usando el scheduler nativo de Supabase.
- **Multi-usuario**: cada miembro del hogar tiene su perfil, avatar, y los gastos y comidas se comparten entre todos.

## Stack

| Capa | Tecnologia |
|------|------------|
| Framework | [Astro](https://astro.build) (SSR con output `server`) |
| UI interactiva | [Preact](https://preactjs.com) |
| Base de datos / Auth | [Supabase](https://supabase.com) |
| IA | Gemini (Google AI) via `@google/generative-ai` |
| Push notifications | Web Push API + Supabase `pg_cron` / `pg_net` |
| Despliegue | [Vercel](https://vercel.com) con adapter `@astrojs/vercel` |

## Estructura del proyecto

```text
/
├── public/                  # Service worker, manifest, iconos PWA
├── src/
│   ├── components/          # Componentes Astro y Preact (islands)
│   │   └── islands/         # BudgetIsland, ComidasIsland, ShoppingListIsland, WeightIsland
│   ├── layouts/             # Layout base
│   ├── lib/                 # Clientes (Supabase, AI), utilidades (dates, food context)
│   │   ├── ai/              # gemini.ts, prompts.ts, schemas.ts
│   │   └── food/            # context.ts, normalization.ts
│   ├── pages/               # Rutas: index, signin, finanzas, comidas, peso, lista, api/
│   │   ├── api/             # Endpoints server-side (ai/meals/suggest, recipes/save, etc.)
│   │   └── finanzas/        # presupuesto.astro
│   └── styles/              # Tokens CSS y estilos de islands
├── supabase/
│   └── migrations/          # Migraciones SQL versionadas
├── scripts/                 # Generacion de iconos PWA
├── .docs/                   # Documentacion interna del proyecto
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

## Requisitos

- Node.js >= 22.12.0
- Cuenta de Supabase (gratuita)
- Cuenta de Vercel (gratuita, opcional para deploy)
- API key de Gemini (Google AI Studio) para las funciones de IA

## Variables de entorno

```env
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

GEMINI_API_KEY=<gemini-api-key>
AI_PROVIDER=google
AI_MODEL=gemini-2.0-flash

# VAPID keys para push notifications
VAPID_SUBJECT=mailto:tu@email.com
VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
```

## Comandos

| Comando              | Accion                                            |
|----------------------|---------------------------------------------------|
| `npm install`        | Instalar dependencias                             |
| `npm run dev`        | Servidor local en `localhost:4321`                |
| `npm run build`      | Build de produccion                               |
| `npm run preview`    | Previsualizar build local antes de desplegar      |
| `npm run astro ...`  | CLI de Astro (`astro add`, `astro check`, etc.)   |

## Estado del proyecto

TCT esta en desarrollo activo. El MVP de IA para sugerencias de comidas esta implementado y funcional. Las fases pendientes incluyen edicion completa de productos en gastos, dashboard mensual de tendencias y mejoras mobile-first.

Consulta `.docs/ai-meals-and-household-intelligence-plan.md` para ver el plan completo de implementacion y el detalle de cada fase.

## Licencia

MIT
