# Plan de Implementacion: IA, Comidas, Gastos y Recomendaciones

Fecha: 2026-05-02  
Proyecto: TCT - Tu Casa Tracker

## Objetivo

Evolucionar TCT para que use los datos existentes de la base de datos como fuente principal de contexto y pueda recomendar desayunos, almuerzos y onces sanas, con calorias estimadas, ingredientes usados, ingredientes faltantes y acciones claras para convertir una receta interesante en lista de compras.

La IA no debe inventar el estado de la casa. Debe partir desde lo que TCT ya sabe: gastos, productos comprados, lista de compras, comidas planificadas, presupuestos y tendencias historicas. Si falta informacion, debe marcarla como faltante o recomendacion, no tratarla como disponible.

## Estado Actual Del Proyecto

TCT ya tiene estas piezas relevantes:

- Finanzas con presupuestos separados para `comida` y `aseo`.
- Gastos con `expenses` y productos asociados en `expense_items`.
- Edicion y eliminacion de gastos mediante API.
- Lista de compras en `/lista`, separada por `comida` y `aseo`, usando `shopping_list_items`.
- Conversion basica de item comprado a gasto real cuando tiene precio.
- Planificador de comidas en `/comidas`, usando `meal_plans` y `meal_types`.
- Tipos de comida actuales: `Desayuno`, `Almuerzo`, `Once`.
- Scheduler con Supabase `pg_cron`/`pg_net` para notificaciones.
- Push notifications ya configuradas para peso y comidas.

## Principios De Diseno

- La IA es asistente, no autoridad. Propone, clasifica y resume, pero el usuario confirma antes de guardar cambios.
- Los datos financieros finales se calculan con reglas deterministicas, no con IA.
- Las calorias son estimaciones visibles como aproximadas.
- Las recetas deben traer ingredientes estructurados para saber que se tiene y que falta comprar.
- Toda recomendacion importante debe ser trazable: modelo usado, input relevante y output validado.
- Las API keys nunca se guardan en el repositorio.

## Manejo De API Keys

Cuando se entreguen las keys de Gemini, configurarlas como variables de entorno:

- `GEMINI_API_KEY`
- `AI_PROVIDER=google`
- `AI_MODEL=gemini-3.1-flash-lite-preview`

En local pueden vivir en `.env` no versionado. En produccion deben configurarse en Vercel Environment Variables. Ninguna key debe aparecer en archivos del repo, migraciones, logs visibles o respuestas del frontend.

## Fuentes De Datos Para La IA

La IA debe construir recomendaciones desde una capa server-side que lea datos de Supabase y arme un contexto compacto.

Fuentes iniciales:

- `expense_items`: productos efectivamente comprados.
- `expenses`: fecha, tipo de presupuesto, categoria y gasto asociado.
- `shopping_list_items`: items pendientes o comprados recientemente.
- `meal_plans`: comidas ya planificadas para evitar repeticion.
- `meal_types`: tipos de comida disponibles.
- `budget_weeks`: presupuesto de comida y aseo, restante y periodo activo.

Reglas de contexto:

- Usar solo items `comida` para generar recetas.
- Excluir o penalizar items clasificados como `aseo`.
- Preferir productos comprados recientemente.
- Considerar lista pendiente como ingredientes faltantes potenciales, no como disponibles.
- Si un producto tiene nombre ambiguo, clasificarlo con confianza baja.

## Modelo De Datos Propuesto

### Auditoria y Deshacer En Gastos

Agregar soporte para historial y deshacer seguro.

Tabla sugerida: `expense_audit_logs`

```sql
id uuid primary key
expense_id uuid null
action text not null -- created, updated, moved, deleted, restored
changed_by uuid not null
before_data jsonb null
after_data jsonb null
undo_token uuid null
undo_expires_at timestamptz null
created_at timestamptz not null default now()
```

Extender `expenses`:

```sql
deleted_at timestamptz null
deleted_by uuid null
updated_at timestamptz null
updated_by uuid null
```

Notas:

- La eliminacion debe ser soft delete.
- El deshacer puede restaurar `before_data` desde `expense_audit_logs`.
- Las consultas normales deben filtrar `deleted_at is null`.

### Recetas

Tabla sugerida: `recipes`

```sql
id uuid primary key
title text not null
description text null
meal_type_id uuid null
source text not null -- manual, ai
created_by uuid not null
servings integer not null default 1
calories_per_serving integer null
protein_g numeric null
carbs_g numeric null
fat_g numeric null
health_score integer null
instructions jsonb not null default '[]'
ai_generation_id uuid null
created_at timestamptz not null default now()
updated_at timestamptz null
```

Tabla sugerida: `recipe_ingredients`

```sql
id uuid primary key
recipe_id uuid not null
name text not null
normalized_name text null
quantity numeric null
unit text null
is_optional boolean not null default false
estimated_calories integer null
source text not null -- available, missing, suggested
created_at timestamptz not null default now()
```

Cada receta generada por IA debe distinguir ingredientes:

- `available`: existe en productos comprados recientes.
- `missing`: no existe, se debe comprar si se quiere preparar.
- `suggested`: mejora opcional o reemplazo.

### Generaciones IA

Tabla sugerida: `ai_generations`

```sql
id uuid primary key
type text not null -- meal_suggestion, weekly_summary, monthly_summary, classification
provider text not null
model text not null
input_json jsonb not null
output_json jsonb not null
created_by uuid null
created_at timestamptz not null default now()
```

Esta tabla permite depurar malas recomendaciones, controlar costos y repetir analisis si cambia el prompt.

### Insights Del Hogar

Tabla sugerida: `household_insights`

```sql
id uuid primary key
period_type text not null -- weekly, monthly
period_start date not null
period_end date not null
summary text not null
metrics_json jsonb not null
ai_json jsonb null
created_at timestamptz not null default now()
```

## Arquitectura IA

Crear una capa server-side. El frontend nunca llama a Gemini directamente.

Archivos sugeridos:

- `src/lib/ai/gemini.ts`
- `src/lib/ai/prompts.ts`
- `src/lib/ai/schemas.ts`
- `src/lib/food/context.ts`
- `src/lib/food/normalization.ts`
- `src/pages/api/ai/meals/suggest.ts`
- `src/pages/api/ai/insights/weekly.ts`
- `src/pages/api/ai/insights/monthly.ts`

Responsabilidades:

- `context.ts`: leer Supabase y crear contexto compacto.
- `normalization.ts`: normalizar nombres de productos.
- `prompts.ts`: prompts versionados.
- `schemas.ts`: validar JSON de salida.
- APIs: autenticar usuario, llamar IA, validar respuesta, guardar `ai_generations`.

## Endpoint Principal: Sugerir Comidas

`POST /api/ai/meals/suggest`

Entrada sugerida:

```json
{
  "meal_date": "2026-05-02",
  "meal_type_id": "uuid",
  "people": 2,
  "preferences": {
    "healthy": true,
    "max_calories_per_serving": 650,
    "avoid": [],
    "prefer": []
  },
  "mode": "use_available_first"
}
```

La API debe enriquecer internamente con:

- productos de comida comprados recientemente,
- items pendientes de lista de comida,
- comidas ya planificadas esta semana,
- recetas guardadas,
- presupuesto restante de comida.

Salida esperada:

```json
{
  "suggestions": [
    {
      "title": "Tostadas integrales con huevo y tomate",
      "meal_type": "Desayuno",
      "servings": 2,
      "calories_per_serving": 420,
      "protein_g": 23,
      "carbs_g": 38,
      "fat_g": 18,
      "health_note": "Alta en proteina y con carbohidratos moderados.",
      "ingredients": [
        {
          "name": "huevo",
          "quantity": 4,
          "unit": "unidad",
          "source": "available"
        },
        {
          "name": "pan integral",
          "quantity": 4,
          "unit": "rebanada",
          "source": "available"
        },
        {
          "name": "tomate",
          "quantity": 2,
          "unit": "unidad",
          "source": "missing"
        }
      ],
      "steps": [
        "Cocer o revolver los huevos.",
        "Tostar el pan integral.",
        "Servir con tomate en rodajas."
      ],
      "shopping_items": [
        {
          "name": "tomate",
          "quantity": 2,
          "unit": "unidad"
        }
      ]
    }
  ]
}
```

Validaciones:

- Debe devolver JSON parseable.
- Debe incluir al menos un ingrediente por receta.
- `source` solo puede ser `available`, `missing` o `suggested`.
- No guardar automaticamente en `meal_plans`; el usuario confirma.
- No agregar faltantes automaticamente a lista; el usuario confirma.

## UI En Comidas

Agregar una seccion en `/comidas` dentro de `ComidasIsland`:

- Boton `SUGERIR CON IA`.
- Selector de tipo: Desayuno, Almuerzo, Once.
- Selector de fecha.
- Campo opcional: cantidad de personas.
- Campo opcional: preferencias/restricciones.
- Cards de sugerencias.

Cada card debe mostrar:

- nombre de receta,
- calorias estimadas por porcion,
- ingredientes disponibles,
- ingredientes faltantes,
- pasos cortos,
- nota saludable,
- acciones:
  - `USAR EN PLANIFICACION`,
  - `GUARDAR RECETA`,
  - `AGREGAR FALTANTES A LISTA`.

## Lista De Compras Conectada A Recetas

Cuando una receta tenga ingredientes faltantes, permitir agregarlos a `shopping_list_items` como `list_type = comida`.

Flujo:

1. IA propone receta.
2. Usuario revisa ingredientes faltantes.
3. Usuario pulsa `AGREGAR FALTANTES A LISTA`.
4. TCT crea items pendientes en lista de comida.
5. Al comprar y registrar precio, esos items se pueden convertir en gasto real.

Campos utiles a agregar en `shopping_list_items`:

```sql
source_recipe_id uuid null
estimated_price numeric null
unit text null
notes text null
converted_expense_id uuid null
```

## Edicion Completa De Gastos

Extender el editor actual de gastos para modificar productos.

Debe permitir:

- cambiar nombre de producto,
- cambiar cantidad,
- cambiar precio unitario,
- agregar producto,
- quitar producto,
- recalcular total del gasto,
- mover entre `comida` y `aseo`,
- cambiar fecha y categoria.

Reglas:

- Si hay productos, `expenses.amount` se recalcula desde `expense_items`.
- Si no hay productos, se permite monto manual.
- Todo cambio escribe `expense_audit_logs`.
- Mostrar `DESHACER` luego de guardar.

## Presupuesto Restante Por Dia

Agregar a Finanzas:

- dias restantes del periodo,
- monto restante,
- restante por dia,
- promedio diario actual,
- proyeccion de cierre.

Ejemplo de copy:

`Quedan $42.000 para 4 dias · $10.500/dia`

Para comida se calcula por semana. Para aseo se calcula por mes.

## Dashboard Mensual De Tendencias

Agregar una vista de tendencias con:

- gasto total del mes,
- comida vs aseo,
- top productos,
- top categorias,
- semanas mas caras,
- comparacion contra mes anterior,
- resumen IA mensual.

Endpoint sugerido:

- `GET /api/finanzas/trends?period=month`
- `POST /api/ai/insights/monthly`

## Resumen Semanal/Mensual Inteligente

El resumen IA debe usar datos agregados, no listas enormes.

Input sugerido:

- total gastado,
- presupuesto total,
- gasto por tipo,
- top categorias,
- top productos,
- comidas planificadas,
- productos disponibles,
- variacion vs periodo anterior.

Output sugerido:

```json
{
  "summary": "Esta semana el gasto de comida subio por compras de supermercado...",
  "alerts": ["Comida va al 82% del presupuesto"],
  "recommendations": ["Usar pollo y arroz comprados para dos almuerzos"],
  "meal_opportunities": ["Hay ingredientes para una once alta en proteina"]
}
```

## Mejoras Moviles

Mejoras prioritarias:

- Boton flotante `+ GASTO`.
- Formulario tipo ticket para productos.
- Acciones rapidas en gastos: editar, mover, eliminar.
- Paneles inferiores en mobile para edicion.
- Botones grandes y faciles de usar con una mano.
- Evitar reload completo cuando sea posible.

## Orden De Implementacion Recomendado

### Fase 1 - Datos confiables

1. Soft delete de gastos.
2. `expense_audit_logs`.
3. Deshacer para editar/eliminar/mover.
4. Filtrar gastos eliminados en todas las consultas.

### Fase 2 - Edicion completa

1. Editor de productos dentro del gasto.
2. Recalculo de total.
3. Auditoria por cambio.
4. UI de confirmacion y deshacer.

### Fase 3 - Lista conectada

1. Mejorar `shopping_list_items` con precio estimado, unidad y receta origen.
2. Crear gasto desde varios items comprados.
3. Asociar gasto generado a lista.

### Fase 4 - Contexto alimenticio

1. Construir `src/lib/food/context.ts`.
2. Normalizar productos comprados.
3. Separar disponibles vs faltantes.
4. Crear endpoint interno para contexto de comidas.

### Fase 5 - IA de comidas

1. Configurar Gemini server-side.
2. Crear `POST /api/ai/meals/suggest`.
3. Validar salida JSON.
4. Mostrar sugerencias en `/comidas`.
5. Guardar receta o usar en planificacion solo con confirmacion.

### Fase 6 - Recetas y compras

1. Crear `recipes` y `recipe_ingredients`.
2. Guardar recetas IA/manuales.
3. Agregar faltantes a lista de compras.
4. Reutilizar recetas en el planner semanal.

### Fase 7 - Presupuestos y tendencias

1. Restante por dia.
2. Proyeccion de cierre.
3. Dashboard mensual.
4. Resumen IA semanal/mensual.

### Fase 8 - Mobile first

1. Boton flotante `+ GASTO`.
2. Entrada tipo ticket.
3. Acciones rapidas.
4. Optimizar pantallas compactas.

## Criterios De Aceptacion Del MVP IA

- La IA genera sugerencias usando datos existentes de Supabase.
- Cada sugerencia incluye calorias estimadas por porcion.
- Cada receta incluye ingredientes estructurados.
- Cada ingrediente indica si esta disponible, falta comprar o es opcional.
- El usuario puede guardar una sugerencia en planificacion.
- El usuario puede guardar una sugerencia como receta.
- El usuario puede agregar faltantes a la lista de comida.
- La API key de Gemini no se expone al cliente.
- La respuesta IA queda registrada en `ai_generations`; si el registro falla, la solicitud no se considera exitosa.
- Si Gemini falla, la UI muestra error recuperable y no rompe el planner.

## Riesgos Y Mitigaciones

- Calorias imprecisas: mostrar siempre como estimadas y permitir editar manualmente en recetas guardadas.
- Productos ambiguos: usar confianza y pedir confirmacion.
- Costos IA: limitar tokens, usar contexto resumido, cachear generaciones y usar modelos Flash.
- Respuestas invalidas: validar JSON y reintentar una vez con prompt de correccion.
- Datos sensibles: no enviar informacion innecesaria; usar solo contexto domestico relevante.

## Estado De Implementacion Actual

Implementado localmente el 2026-05-02:

- Cliente server-side para Gemini en `src/lib/ai/gemini.ts`.
- Modelo por defecto: `gemini-3.1-flash-lite-preview`.
- Schema y validacion de salida JSON en `src/lib/ai/schemas.ts`.
- Validacion de nutricion: kcal por porcion, macros no vacios, limites razonables y coherencia kcal/macros.
- Prompt de comidas en `src/lib/ai/prompts.ts`.
- Contexto alimenticio desde Supabase en `src/lib/food/context.ts`.
- Normalizacion simple de productos en `src/lib/food/normalization.ts`.
- Endpoint `POST /api/ai/meals/suggest`.
- Endpoint `POST /api/recipes/save`.
- UI de sugerencias IA en `/comidas`.
- Acciones: usar en planificacion, guardar receta, agregar faltantes a lista.
- Migration `20260502_create_ai_recipes.sql` aplicada a Supabase.
- Campos extra en `shopping_list_items`: `source_recipe_id`, `estimated_price`, `unit`, `notes`, `converted_expense_id`.
- Prompt IA reforzado como experto en nutriologia, con macros por porcion y unidades explicitas.
- Reintento automatico cuando Gemini no devuelve JSON valido o incumple el schema.
- Rate limit basico para solicitudes IA por usuario.
- Selects y campos del panel IA estilizados y con etiquetas visibles.
- Estadisticas nutricionales visibles como kcal/proteina/carbos/grasas por porcion.
- Agendar receta ahora abre modal editable antes de guardar en calendario.
- Calendario semanal abre modal al seleccionar una celda por clic/touch/teclado.
- Preferencias IA se recuerdan localmente en el navegador.
- Recetas guardadas se listan en el panel IA y se pueden volver a agendar.
- Recetas guardadas propias se pueden quitar con confirmacion; las recetas compartidas de otra persona no muestran accion destructiva.
- Guardar receta evita duplicados simples por titulo para el usuario actual.
- Recetas guardadas tambien pueden enviar faltantes a la lista de comida manteniendo `source_recipe_id`.
- Faltantes agregados a lista intentan fusionarse con pendientes existentes para evitar duplicados simples.
- Ingredientes de recetas guardadas rellenan `normalized_name` para mejorar fusiones y busquedas.
- Marcar un item de lista como comprado con precio crea el gasto real y guarda `converted_expense_id`.
- Desmarcar un item comprado pide confirmacion si va a revertir un gasto automatico enlazado mediante RPC seguro.
- Constraint unica de `meal_plans(meal_date, meal_type_id)` versionada en `20260502_close_ai_meals_release_gaps.sql`.
- Inventario real descartado por alcance: la IA usa ingredientes existentes en compras/lista/base de datos como fuente de ideas, sin intentar saber si ya fueron consumidos.
- Pasada Nothing Design aplicada: sin sombras en modal, sin skeleton shimmer, botones con touch target de 44px, tokens CSS ajustados y cierres de modal estilo `[ X ]`.

Configuracion ya realizada:

- `GEMINI_API_KEY` configurada en entorno local y Vercel.
- `AI_PROVIDER=google` configurado en entorno local y Vercel.
- `AI_MODEL=gemini-3.1-flash-lite-preview` configurado en entorno local y Vercel.

Pendiente despues del despliegue:

1. Ejecutar una prueba autenticada en `/comidas` con datos reales despues de cada ajuste de UX.
2. Ajustar prompt/calorias segun la calidad de las primeras respuestas.
3. Evaluar si la edicion completa de productos dentro de gastos entra en la siguiente fase.

## No Implementar Todavia

Aunque el MVP IA ya existe, seguir evitando por ahora:

- guardar comidas generadas automaticamente sin confirmacion,
- agregar ingredientes faltantes automaticamente sin confirmacion,
- mezclar datos personales de peso con recomendaciones de comida,
- usar IA para modificar o borrar gastos sin confirmacion,
- depender de IA para calculos financieros finales.