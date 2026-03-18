

## Plan: 4 cambios en la aplicación

### 1. Card de variable siempre visible
**Líneas 967-988**: Eliminar la condición `response.tipo === "propuestas_iniciales"` que envuelve la card de variable. En su lugar, almacenar la info de variable en un estado separado (`variableInfo`) que se guarde cuando llegan las propuestas iniciales y persista cuando llegan las adicionales. La card se mostrará siempre que `propuestasAcumuladas.length > 0` y exista `variableInfo`.

### 2. Renombrar botón
**Línea 1079**: Cambiar el texto "Ver más opciones" por "Generar más propuestas".

### 3. Spinner individual por propuesta
- Agregar estado `loadingPropuestaId: number | null` (inicialmente `null`).
- En `handleSeleccionar`: usar `setLoadingPropuestaId(propuesta.id)` al inicio y `setLoadingPropuestaId(null)` en el `finally`.
- En el botón de cada propuesta (líneas 1025-1038): `disabled={loadingPropuestaId !== null}`, y mostrar spinner solo si `loadingPropuestaId === propuesta.id`.

### 4. Tabla y gráfico con datos de `visualizacion`
- Actualizar el tipo `FichaMetodologica` para incluir `visualizacion` con la estructura proporcionada (tabla_datos y grafico).
- Importar componentes de recharts: `ResponsiveContainer`, `LineChart`, `BarChart`, `Line`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip as RechartsTooltip`, `Legend`.
- Reemplazar las secciones actuales de tabla_datos (líneas 1311-1325) y gráfico (líneas 1327-1341) con:
  - **Tabla**: Renderizar con `<table>` HTML, encabezado `bg-inegi-blue-dark text-white`, columna "Año" + una por serie, valores con `.toFixed(2)`, notas al pie en itálica.
  - **Gráfico**: Usar `ResponsiveContainer` height 300. Si `tipo === "barras"` usar `BarChart`, sino `LineChart`. Preparar `chartData` mapeando `eje_x.valores`. Una `<Line>` o `<Bar>` por serie con su color. Incluir `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`. Notas al pie en itálica gris.
- Leer datos desde `fichaMetodologica.ficha.visualizacion?.tabla_datos` y `fichaMetodologica.ficha.visualizacion?.grafico` (o fallback a `fichaMetodologica.ficha.tabla_datos` / `fichaMetodologica.ficha.grafico` por compatibilidad).
- Colocar tabla y gráfico antes de la sección de Limitaciones (posición actual ya es correcta).

### Archivos a modificar
- `src/pages/Index.tsx`: Todos los cambios.

