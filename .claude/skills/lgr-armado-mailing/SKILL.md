<!--
  AUTO-GENERADO POR scripts/sync-skills.sh — NO EDITAR ACÁ.
  Fuente de verdad: mdd145-prog/LIGIER/marketing/lgr-armado-mailing/SKILL.md
  Para cambios: editar en LIGIER, hacer push, volver acá y re-correr el sync.
-->

---
name: lgr-armado-mailing
description: Reglas duras para ARMAR piezas de mailing de Vinoteca Ligier (Recompra, Bienvenida, Dormidos, NPS, banners, automations). Usar CADA VEZ que una pieza de email muestre productos o promos. Cubre stock, presentación 750ml, promos validadas con cart real, qué endpoints custom de Magento usar y qué nunca asumir.
---

# Armado de piezas de mailing Ligier — reglas duras

> v1 — 26 jun 2026. Capturado durante el armado del endpoint `send-transactional`
> de Vercel (`ligier-app`) que arma piezas con productos reales para el flujo
> de marketing. Está en **lgr** y **ligier-app** para que cualquier sesión Claude
> que toque selección de productos en marketing la cargue automáticamente.
>
> Cada vez que mostrar un producto en una pieza tiene una variable más
> (presentación, monto mínimo, restricción regional, etc.) se actualiza acá.

---

## 1. Regla de oro — nunca asumir, siempre corroborar

Aplica a TODA pieza nueva que muestre productos o promos:

| Vector | Cómo corroborar | Si no se puede corroborar |
|---|---|---|
| **Stock** | `is_in_stock=true && qty_stock>0` desde Magento | Descartar el SKU |
| **Presentación** (750ml en vinos) | `contenido` o, hasta que el endpoint lo filtre, regex por name | Descartar |
| **Promoción activa** | `api_promos.php?activas=true` devuelve ≥1 regla | NO mostrar promo |
| **Promo aplica a estos SKUs** | `getCartGrandTotal(cartUrl)` muestra grand_total < suma listados | NO mostrar promo |

Mostrar default: **OFF**. Es preferible un mail con menos info que uno que promete lo que no se puede entregar.

---

## 2. Endpoints que usar (y en qué orden)

Toda la lectura de catálogo, stock y promos se hace contra los **endpoints custom de Magento** (NO el REST nativo, NO scraping HTML):

- `GET /api_productos.php?categoria_id=X&contenido=25&activos=1&per_page=200`
- `GET /api_productos.php?sku=A,B,C` (para SKUs específicos, ej. carrito armado)
- `GET /api_stock.php?skus=A,B,C` (cuando solo se necesita stock por SKU)
- `GET /api_promos.php?activas=true`

**Auth obligatoria** en todos:
- Header **`X-API-KEY: <secret>`** (NO `X-LGR-Key` como decía la spec borrador).
- Header **`User-Agent`** NEUTRO tipo `LGR-Mailer/1.0`. El UA de navegador (`Mozilla/...`) dispara el WAF de Nexcess → 403 HTML.

El secret vive en:
- LGR backend: `.env` → `MAGENTO_CUSTOM_API_KEY` (solo en el VPS, no en repos).
- ligier-app Vercel: env var `MAGENTO_CUSTOM_API_KEY` (Production + Preview).

**Razón para preferir custom sobre REST:**
- Sin token rotativo (REST exige `/V1/integration/admin/token` cada 50min).
- Sin WAF (los paths custom están whitelisted).
- Una sola llamada trae `sku, name, price, special_price, qty_stock, is_in_stock, image_url, thumbnail_url, category_ids` — todo lo que un mail necesita.
- Pensado para nuestro uso (LGR + ligier-app), no es API genérica.

---

## 3. Stock — qué pasa con la respuesta de Magento

El detalle `/rest/V1/products/{sku}` **NO devuelve stock confiablemente** (solo trae `website_ids, category_links` en `extension_attributes`). Para stock real hay dos caminos:

1. **Endpoint custom `/api_productos.php`** → ya devuelve `qty_stock` e `is_in_stock` en el listado. Es el camino preferido.
2. Endpoint nativo `/rest/V1/stockItems/{sku}` → requiere permiso `Catalog::Inventory` en el token de integración (típicamente apagado). Si lo prendés tenés stock confiable, pero suma latencia (1 request por SKU).

**Regla de implementación:** `parseCustomProduct` debe leer `is_in_stock` y `qty_stock` del response custom; cualquier producto con `inStock !== true || qty === 0` se filtra ANTES de devolverlo al template.

---

## 4. Presentación — filtro 750ml para vinos

El endpoint custom acepta `?contenido=25` (donde 25 = 750ml según el atributo `contenido`), pero **HOY filtra mal**: se cuelan SKUs de 375, 500, 1000, 1500ml.

**Solución defensiva client-side** en `lib/render.js → is750ml(name)`:
- Descartar si el name contiene `\b(187|375|500|1000|1500|1750|3000)\s?(ml|cc)?\b`.
- Descartar si contiene `\b\d+(\.\d+)?\s?(lt|lts|litros?)\b`.
- Descartar si contiene `\bestuche\s+\d+\b`.
- En cualquier otro caso, asumir 750ml (la mayoría del catálogo).

**Pendiente del programador de Magento:** que `api_productos.php?contenido=25` filtre estrictamente, O que el response incluya `custom_attributes.contenido` (para filtrar bien client-side sin regex). Cuando alguno de los dos se resuelva, sacar el filtro defensivo.

---

## 5. Promociones — dos fuentes, AND obligatorio

### Historia de errores (no repetir)
1. Asumí "6×5 va en cualquier categoría con productos" → metí 6×5 en whisky donde no existe.
2. Hardcodeé `vinos → 6×5` → no escala, las promos pueden cambiar diariamente.
3. Deducí "hay promo si grand_total < suma listados" → con promos OFF también daba descuento por `special_price`/lista mayorista. Falso positivo.

### Lógica correcta (la que sí funciona)
**AMBAS condiciones deben ser true para prender `withPromo`:**

1. `api_promos.php?activas=true` devuelve ≥1 regla activa.
2. Armar el cart real con los SKUs del mail (`vinotecaligier.com/compartircarrito/index/share/data/{base64}/`), pegar a `getCartGrandTotal(cartUrl)` y verificar **`grand_total < (suma de precios listados) - tolerancia`**.

Si ambas: la regla activa SE APLICA al cart específico → mostrar 6×5 (banda + precios rebajados ×5/6 visuales). Si una falla: sin banda.

### Lo que NO sabemos exponer todavía
- `api_promos.php` no expone las **condiciones** de cada regla (categorías, monto mínimo, etc.). Lo deducimos empíricamente con el cart real.
- **Pendiente del programador:** agregar `conditions` o `category_ids` al response de `api_promos.php`. Cuando esté, simplificamos la inferencia y validamos sin pegarle al carrito por cada mail.

### Override del caller
- `withPromo: false` en el JSON del workflow → fuerza apagar la promo aunque cuadre (útil para A/B tests).
- `withPromo: true` **NO** fuerza prender — sigue mandando la verificación. La verdad la pone Magento.

---

## 6. La promo "6×5 Mix" (estado actual jun 2026)

Única regla activa en `is_active=true`:
- `name: "6x5 Mix"`, `discount_type: thecheapest`, `discount_amount: 100`, `coupon_code: null`, `to_date: null`.
- Mecánica: **el producto más barato del cart sale 100% off** cuando hay 6 en el carrito.
- Visualmente en los templates: precio lleno tachado + precio rebajado ×5/6 (aproximación) + "c/u comprando 6". Es la convención del wizard `generate-campaign.js`. El total real lo recalcula Magento al armar el cart.
- **Se aplica solo en VINOS** según testeo empírico (Guardados/Whisky/Espirituosas dan grand_total == suma listada → la regla no aplica). El endpoint NO expone esa restricción explícitamente.

---

## 7. Cart URL — convención

Para que el CTA del hero y el botón APROVECHAR del bloque PROMO lleven al cart pre-armado:

```js
const cartJson = JSON.stringify(products.map(p => ({ sku: p.sku, qty: 1 })));
const cartB64 = Buffer.from(cartJson).toString('base64');
const cartUrl = `https://vinotecaligier.com/compartircarrito/index/share/data/${cartB64}/`;
```

Es la misma convención que usa el wizard del repo. Magento renderiza el cart con descuento aplicado al hacer click.

---

## 8. Qué falta — pedidos al programador de Magento

Cuando se actualice `api_productos.php` para sumar estos campos, simplificamos lib/render.js:

| Campo | Para qué | Hoy se resuelve cómo |
|---|---|---|
| `custom_attributes.bodega` | Label "Bodega · Región · País" en cada tarjeta | Falta |
| `custom_attributes.varietal` | Idem | Deducido del `name` con regex |
| `custom_attributes.anio` | Idem | Falta |
| `custom_attributes.region` | Idem | Falta |
| `custom_attributes.pais` | Idem | Falta |
| `custom_attributes.contenido` | Filtro 750ml estricto | Regex defensivo client-side |
| `short_description` | Bajada de la tarjeta | Vacío |
| `url_key` | Link directo al producto | Fallback a `catalogsearch?q=SKU` |

Pendiente también `api_promos.php`: exponer `conditions` (categorías, monto mínimo, SKUs incluidos/excluidos).

---

## 9. Composición con redactor-ligier

Esta skill **NO** define copy — eso lo hace `[[redactor-ligier]]` (voz, subjects, hero, CTA). Esta skill define **qué productos mostrar** y **cuándo prender la banda 6×5**. Las dos se aplican juntas: cada vez que el wizard / endpoint / workflow arma una pieza con productos, corre esta para seleccionar correctamente Y `redactor-ligier` para el copy.

---

## 10. Memoria relacionada

- `regla-de-oro-corroborar-promo-y-stock` (en memoria de Martin) — la regla original que dio origen a esta skill.
- `marketing-brevo-sender` — qué se manda con Brevo, qué con Mailchimp.
- `stack-marketing-division` — las 5 capas (templates / armado / procesos / datos / sender).
