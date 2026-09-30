---
name: clima
description: Consulta el clima o tiempo actual (temperatura, sensación térmica, humedad, viento, pronóstico) de una ciudad usando la API pública gratuita wttr.in, sin necesidad de API key ni dependencias. Usa esta skill siempre que el usuario pregunte por el clima, el tiempo, la temperatura, si va a llover, o el pronóstico de una ciudad o de "aquí"/su ubicación actual, incluso si no menciona explícitamente "wttr.in" o "API". También úsala si el usuario pide comparar el clima entre varias ciudades o quiere un resumen rápido del tiempo para hoy.
---

# Clima (wttr.in)

Esta skill obtiene el clima actual de cualquier ciudad del mundo haciendo una
petición HTTP simple a la API pública y gratuita **wttr.in**, que no requiere
API key ni registro. Es coherente con este proyecto (Tetris en JS puro, sin
dependencias, sin gestor de paquetes): la consulta se hace con una sola
petición HTTP desde PowerShell, sin instalar nada.

Recuerda: el `CLAUDE.md` de este proyecto indica responder siempre en
español, así que presenta los resultados en español.

## Cómo consultar el clima

Usa `Invoke-RestMethod` de PowerShell contra `wttr.in`. El parámetro
`format` de wttr.in permite pedir justo los datos que necesitas en una sola
línea de texto, y `lang=es` traduce las descripciones (soleado, nublado,
etc.) al español.

### 1. Clima de una ciudad específica

Si el usuario menciona una ciudad, ponla en la URL (usa `[System.Uri]::EscapeDataString`
para ciudades con espacios, acentos o ñ):

```powershell
$ciudad = "Ciudad de Mexico"
$ciudadEsc = [System.Uri]::EscapeDataString($ciudad)
Invoke-RestMethod -Uri "https://wttr.in/$ciudadEsc?format=%l:+%c+%t+(sensacion+%f)+humedad+%h+viento+%w&lang=es" -TimeoutSec 10
```

Esto devuelve una sola línea, por ejemplo:

```
Ciudad de Mexico: ☀️  +22°C (sensacion +21°C) humedad 35% viento ↙10km/h
```

Tradúcela a una respuesta natural para el usuario, por ejemplo:

> En Ciudad de México hace 22°C (sensación de 21°C), cielo soleado,
> humedad del 35% y viento suave de 10 km/h.

### 2. Ubicación por defecto (sin ciudad especificada)

Si el usuario no da una ciudad ("¿cómo está el clima?", "¿va a llover hoy?"),
omite el nombre de ciudad en la URL. wttr.in detecta la ubicación
aproximada a partir de la IP de salida:

```powershell
Invoke-RestMethod -Uri "https://wttr.in/?format=%l:+%c+%t+(sensacion+%f)+humedad+%h+viento+%w&lang=es" -TimeoutSec 10
```

Aclara siempre al usuario que la ubicación es aproximada (según la IP de
red), y ofrécele indicarte una ciudad concreta si quiere más precisión.

### 3. Más detalle: pronóstico de varios días o datos ampliados

Si el usuario pide pronóstico extendido (varios días, por hora, humedad
detallada, presión, UV, etc.), pide el JSON completo con `format=j1` y
extrae los campos relevantes en vez de mostrar el JSON crudo:

```powershell
$ciudadEsc = [System.Uri]::EscapeDataString($ciudad)
$datos = Invoke-RestMethod -Uri "https://wttr.in/$ciudadEsc?format=j1&lang=es" -TimeoutSec 10
$datos.current_condition[0]   # clima actual con todos los campos
$datos.weather                # arreglo con el pronóstico de los próximos días
```

Campos útiles dentro de `current_condition[0]`: `temp_C`, `FeelsLikeC`,
`humidity`, `windspeedKmph`, `winddir16Point`, `weatherDesc[0].value` (en
inglés aunque pidas `lang=es`; usa el texto en español que sí trae
`lang_es[0].value` si está presente, y si no, traduce tú mismo la
descripción en inglés).

## Manejo de errores

- Si `Invoke-RestMethod` falla o hace timeout (sin internet, ciudad mal
  escrita, servicio caído), informa al usuario de forma breve y sugiere
  reintentar o verificar el nombre de la ciudad — no inventes datos de
  clima.
- Si el nombre de ciudad es ambiguo (hay varias ciudades con ese nombre),
  wttr.in normalmente resuelve la más conocida; si el resultado no parece
  corresponder a lo que el usuario espera, pídele que aclare con país o
  región (por ejemplo "Guadalajara, España" vs "Guadalajara, México").

## Notas

- No se requiere API key ni registro.
- El servicio es de terceros (wttr.in) y puede tener límites de uso o
  caídas ocasionales; en ese caso, avisa al usuario en vez de fallar en
  silencio.
- Si el entorno no es Windows/PowerShell, el equivalente en `curl` es:
  `curl "wttr.in/CIUDAD?format=...&lang=es"`.
