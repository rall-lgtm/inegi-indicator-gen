import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, AlertCircle, CheckCircle, Download, RefreshCw, Loader2, TrendingUp, FileText, Info, AlertTriangle, Maximize2, Minimize2, FileDown, Sparkles, PenLine, Check, RotateCcw } from "lucide-react";
import { ResponsiveContainer, LineChart, BarChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType } from "docx";
import { saveAs } from "file-saver";

// Tipos de respuesta de la API
type ErrorGenerico = {
  tipo: "error";
  codigo: string;
  mensaje: string;
  detalles: string;
};

type ErrorTemporalidad = {
  success: false;
  tipo: "error_temporalidad";
  error: {
    codigo: string;
    mensaje: string;
    razon: string;
    sugerencia: string;
    nivel_fuente: string | null;
    alternativas_fallback: boolean;
    alternativas: Array<{
      idVar: string;
      nombre: string;
      proceso_nombre: string;
      totalAnios: number;
      estatus_similar: string;
    }>;
    detalles: {
      anios_requeridos: number;
      anios_disponibles: number;
    };
  };
  variable: {
    idVar: string;
    nombre: string;
    totalAnios: number;
    años: number[];
    proceso?: {
      estatus: string;
      proceso: string;
    };
  };
};

type ErrorValidacion = {
  tipo: "error_validacion";
  error: {
    codigo: string;
    mensaje: string;
    nombre_recibido: string;
    razon: string;
    sugerencias: string[];
    ejemplos_contextuales: string[];
  };
  variable: {
    idVar: string;
    nombre: string;
    tema: string;
    subtema: string;
  };
};

type AdvertenciaAmbiental = {
  detectado: boolean;
  mensaje: string;
  razon: string;
  tema_detectado: string;
  subtema_detectado: string;
  recomendacion?: string;
};

type PropuestaIndicador = {
  id: number;
  nombre: string;
  enfoque: string;
  tipo: string;
  descripcion: string;
  objetivo?: string;
  importancia?: string;
  enfoque_id?: string;
  razon_seleccion?: string;
  variantes?: string[];
  variante_usada?: string;
  viabilidad?: {
    nivel: "Alta" | "Media" | "Baja";
    fuentes: {
      microdatos: boolean;
      tabulados: boolean;
      datosAbiertos: boolean;
    };
    nota?: string;
  };
  formula?: string;
};

const CATALOGO_ENFOQUES = [
  { id: "E1", nombre: "Proporción", descripcion: "% con el evento" },
  { id: "E2", nombre: "Tendencia", descripcion: "Cambio entre períodos" },
  { id: "E3", nombre: "Comparación geográfica", descripcion: "Distribución por entidad federativa" },
  { id: "E4", nombre: "Variación acumulada", descripcion: "Cambio total del período" },
  { id: "E5", nombre: "Dist. por categoría", descripcion: "Entre categorías" },
  { id: "E6", nombre: "Brecha sexo/edad", descripcion: "Hombre vs mujer" },
  { id: "E7", nombre: "Brecha socioecon.", descripcion: "Por ingreso o decil" },
  { id: "E8", nombre: "Concentración", descripcion: "En subgrupo o territorio" },
  { id: "E9", nombre: "Composición", descripcion: "Estructura porcentual" },
  { id: "E10", nombre: "Intensidad", descripcion: "Total, promedio o per cápita" },
];

const CATALOGO_ENFOQUES_DETALLE: Record<string, { nombreCompleto: string; queMide: string; requiere: string }> = {
  E1: { nombreCompleto: "Proporción", queMide: "El porcentaje de casos que presentan un atributo respecto al total del universo.", requiere: "Variable categórica o binaria con clasificaciones definidas y total del universo." },
  E2: { nombreCompleto: "Tendencia", queMide: "El cambio porcentual de una variable entre períodos consecutivos.", requiere: "Aplica para cualquier tipo de variable (binaria, categórica y numérica). Requiere al menos 2 años de datos disponibles." },
  E3: { nombreCompleto: "Comparación geográfica", queMide: "Las diferencias en la ocurrencia de un fenómeno entre regiones o entidades.", requiere: "Variable categórica, binaria o numérica con desagregación geográfica en tabulados o microdatos." },
  E4: { nombreCompleto: "Variación acumulada", queMide: "El cambio porcentual total entre el año más antiguo y el más reciente de la serie.", requiere: "Variable binaria o numérica con serie de tiempo con, al menos, 3 años de datos comparables." },
  E5: { nombreCompleto: "Distribución por categoría", queMide: "La distribución de un fenómeno cruzado con otra variable categórica.", requiere: "Variable categórica con 3 o más clasificaciones." },
  E6: { nombreCompleto: "Brecha sexo/edad", queMide: "La diferencia o disparidad del fenómeno entre grupos de sexo o grupos de edad.", requiere: "Variable categórica o binaria donde el universo del proceso de producción incluya personas, o desglose por sexo/edad en tabulados o microdatos de personas." },
  E7: { nombreCompleto: "Brecha socioeconómica", queMide: "La diferencia o disparidad del fenómeno entre grupos socioeconómicos o niveles de ingreso.", requiere: "Variable categórica o binaria, con desglose por ingreso o decil en tabulados o microdatos cuyo universo sean hogares o viviendas." },
  E8: { nombreCompleto: "Concentración", queMide: "El grado en que un fenómeno se concentra en un subgrupo o territorio específico.", requiere: "Variable categórica o binaria con desagregación geográfica en tabulados o microdatos; o variable numérica con microdatos y desagregación geográfica." },
  E9: { nombreCompleto: "Composición porcentual", queMide: "La estructura porcentual interna de un fenómeno según sus categorías.", requiere: "Variable con múltiples categorías (3 o más)." },
  E10: { nombreCompleto: "Intensidad", queMide: "El promedio, total o valor per cápita del fenómeno por unidad de análisis.", requiere: "Variable numérica continua, sin clasificaciones categóricas definidas." },
};

type PropuestasIniciales = {
  tipo: "propuestas_iniciales";
  advertencia_ambiental?: AdvertenciaAmbiental;
  enfoques_evaluados?: {
    permitidos: string[];
    prohibidos: string[];
  };
  variable: {
    idVar: string;
    nombre: string;
    definicion: string;
    tema: string;
    subtema: string;
    totalAnios: number;
    años: number[];
    proceso?: {
      estatus: string;
      proceso: string;
      periodicidad?: string;
      metodo?: string;
    };
    _flags?: {
      tipo: string;
    };
    clasificacion_representativa?: string;
    clasificacion_regla?: string;
    justificacion_clasificacion?: string;
    viabilidad?: {
      nivel: "Alta" | "Media" | "Baja";
      nota?: string;
    };
    clasificaciones?: Array<{ clase: string }>;
  };
  propuestas: PropuestaIndicador[];
};

type PropuestasAdicionales = {
  tipo: "propuestas_adicionales";
  advertencia_ambiental?: AdvertenciaAmbiental;
  mensaje: string;
  variable: {
    idVar: string;
    nombre: string;
  };
  propuestas: PropuestaIndicador[];
};

type FichaMetodologica = {
  tipo: "ficha_metodologica";
  indicador: {
    id: number;
    nombre: string;
    siglas: string;
  };
  ficha: {
    objetivo: string;
    importancia: string;
    definicion_variables: Record<string, string>;
    unidad: string;
    formula: string;
    formula_detalle: Record<string, string>;
    tabla_datos: any;
    grafico: any;
    cobertura: string;
    desagregacion: string;
    temporal: string;
    frecuencia: string;
    periodicidad: string;
    temporal_fuente: string;
    fuente: {
      nombre: string;
      institucion: string;
      programa: string;
      url: string;
    };
    limitaciones: string[];
    alineacion: {
      ods?: Array<{
        objetivo: string;
        meta: string;
        indicador?: string;
      }>;
      mdea?: Array<{
        componente: string;
        subcomponente: string;
        topico: string;
        estadistica1?: string;
        estadistica2?: string;
      }>;
      pnd?: Array<{
        eje: string;
        objetivo: string;
        estrategia: string;
      }>;
    };
  };
  visualizacion?: {
    tabla: {
      tipo: string;
      columnas: Array<{ key: string; label: string; tipo: "texto" | "numero" | "porcentaje" | "entero" }>;
      filas: Array<Record<string, any>>;
      notas: string[];
    };
    grafico: {
      tipo: "lineas" | "barras" | "barras_horizontales" | "barras_agrupadas" | "barras_apiladas_100" | "pie";
      titulo: string;
      subtitulo?: string;
      eje_x: { label: string; valores: any[] };
      eje_y: { label: string; min: number | null; max: number | null };
      series: Array<{ nombre: string; color: string; datos: Array<{ x: any; y: number | null }> }>;
      leyenda: { posicion: string; visible: boolean };
      notas?: string[];
    };
  };
  descarga: {
    disponible: boolean;
    url: string;
  };
};

type ApiResponse = ErrorGenerico | ErrorTemporalidad | PropuestasIniciales | PropuestasAdicionales | FichaMetodologica;

const Index = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const idFromUrl = searchParams.get("idVar") || searchParams.get("id");
  const enfoqueFromUrl = searchParams.get("enfoque");
  
  const [idVar, setIdVar] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [fichaMetodologica, setFichaMetodologica] = useState<FichaMetodologica | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalExpanded, setIsModalExpanded] = useState(false);
  const [sessionId] = useState(`session-${Date.now()}`);
  const fichaModalRef = useRef<HTMLDivElement>(null);
  const [propuestasAcumuladas, setPropuestasAcumuladas] = useState<PropuestaIndicador[]>([]);
  const [mostrandoTodas, setMostrandoTodas] = useState(false);
  const [nombrePersonalizado, setNombrePersonalizado] = useState("");
  const [mostrarInputPersonalizado, setMostrarInputPersonalizado] = useState(false);
  const [errorValidacion, setErrorValidacion] = useState<ErrorValidacion | null>(null);
  const [loadingPropuestaId, setLoadingPropuestaId] = useState<number | null>(null);
  const [loadingMasOpciones, setLoadingMasOpciones] = useState(false);
  const [variableInfo, setVariableInfo] = useState<PropuestasIniciales["variable"] | null>(null);
  const [numPropuestasIniciales, setNumPropuestasIniciales] = useState(0);
  const [enfoquesPermitidos, setEnfoquesPermitidos] = useState<string[]>([]);
  const [loadingRegenerando, setLoadingRegenerando] = useState(false);
  const [loadingVarianteKey, setLoadingVarianteKey] = useState<string | null>(null);
  const [clasificacionOverride, setClasificacionOverride] = useState<string | null>(null);
  const { toast } = useToast();

  const API_URL = "https://n8n.fmoreno.com.mx/webhook/generar-propuestas";

  // Leer idVar de la URL al cargar la página
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idVarFromUrl = params.get("idVar");
    if (idVarFromUrl) {
      const cleaned = idVarFromUrl.toUpperCase().trim();
      setIdVar(cleaned);
      setTimeout(() => {
        // Ejecutar la consulta después de que el estado se actualice
        const runQuery = async () => {
          setLoading(true);
          try {
            const tieneEnfoque = enfoqueFromUrl !== undefined && enfoqueFromUrl !== null && enfoqueFromUrl !== "";

            const body = tieneEnfoque
              ? {
                  idVar: cleaned,
                  sessionId,
                  accion: "generar_propuesta_enfoque",
                  enfoque: enfoqueFromUrl === "null" ? null : enfoqueFromUrl,
                }
              : {
                  idVar: cleaned,
                  sessionId,
                  accion: "iniciar",
                };

            const res = await fetch(API_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            });

            if (!res.ok) {
              throw new Error("Error en la conexión con el servidor");
            }

            const data = await res.json();
            
            // Manejar error genérico (variable no encontrada)
            if (data.tipo === 'error') {
              setResponse(null);
              setPropuestasAcumuladas([]);
              toast({
                title: `❌ ${data.codigo === 'VARIABLE_NO_ENCONTRADA' ? 'Variable no encontrada' : 'Error'}`,
                description: `${data.mensaje} ${data.detalles}`,
                variant: "destructive",
              });
              return;
            }
            
            if (data.tipo === 'error_temporalidad') {
              setResponse(data);
              setPropuestasAcumuladas([]);
              toast({
                title: "⚠️ Temporalidad insuficiente",
                description: data.error.mensaje,
                variant: "destructive",
              });
              return;
            }
            
            setResponse(data);
            if (data.tipo === 'propuestas_iniciales' && data.propuestas) {
              setPropuestasAcumuladas(data.propuestas);
              setNumPropuestasIniciales(data.propuestas.length);
              setVariableInfo(data.variable);
              setEnfoquesPermitidos(data.enfoques_evaluados?.permitidos ?? []);
            }
          } catch (error) {
            toast({
              title: "Error",
              description: "No se pudo conectar con el servidor",
              variant: "destructive",
            });
          } finally {
            setLoading(false);
          }
        };
        runQuery();
      }, 300);
    }
  }, []);

  const enviarConsulta = async (accion: string, datos: any = {}) => {
    setLoading(true);
    try {
      const body = {
        idVar: idVar.toUpperCase(),
        sessionId,
        accion,
        ...datos,
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error("Error en la conexión con el servidor");
      }

      const data = await res.json();
      
      // Manejar error genérico (variable no encontrada)
      if (data.tipo === 'error') {
        setResponse(null);
        setPropuestasAcumuladas([]);
        toast({
          title: `❌ ${data.codigo === 'VARIABLE_NO_ENCONTRADA' ? 'Variable no encontrada' : 'Error'}`,
          description: `${data.mensaje} ${data.detalles}`,
          variant: "destructive",
        });
        return;
      }
      
      // Manejar error de temporalidad
      if (data.tipo === 'error_temporalidad') {
        setResponse(data);
        setPropuestasAcumuladas([]);
        toast({
          title: "⚠️ Temporalidad insuficiente",
          description: data.error.mensaje,
          variant: "destructive",
        });
        return;
      }
      
      setResponse(data);

      // Si es propuestas iniciales, resetear acumuladas
      if (data.tipo === 'propuestas_iniciales') {
        setPropuestasAcumuladas(data.propuestas || []);
        setNumPropuestasIniciales((data.propuestas || []).length);
        setVariableInfo(data.variable);
        setEnfoquesPermitidos(data.enfoques_evaluados?.permitidos ?? []);
      }
      
      // Si son propuestas adicionales, acumular y marcar como todas mostradas
      if (data.tipo === 'propuestas_adicionales') {
        setPropuestasAcumuladas(prev => [...prev, ...(data.propuestas || [])]);
        setMostrandoTodas(true);
        if (data.variable) {
          setVariableInfo(data.variable);
        }
      }

      // Scroll al resultado
      setTimeout(() => {
        const resultElement = document.getElementById("result-section");
        if (resultElement) {
          resultElement.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo conectar con el servidor. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInicio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (idVar.trim().length < 3) {
      toast({
        title: "Validación",
        description: "El ID de variable debe tener al menos 3 caracteres",
        variant: "destructive",
      });
      return;
    }
    await enviarConsulta("iniciar");
  };

  const handleMasOpciones = async () => {
    setLoadingMasOpciones(true);
    try {
      const overrideActivo = clasificacionOverride ||
        (variableInfo?.clasificacion_regla === "override_usuario"
          ? variableInfo?.clasificacion_representativa
          : null);

      const extras = overrideActivo
        ? { clasificacion_override: overrideActivo }
        : {};

      await enviarConsulta("mas_opciones", extras);
    } finally {
      setLoadingMasOpciones(false);
    }
  };

  const handlePersonalizado = async () => {
    if (nombrePersonalizado.trim().length < 3) {
      toast({
        title: "Validación",
        description: "El nombre del indicador debe tener al menos 3 caracteres",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    setErrorValidacion(null);
    try {
      const body = {
        idVar: idVar.toUpperCase(),
        sessionId,
        accion: "personalizado",
        nombreIndicador: nombrePersonalizado.trim(),
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error("Error en la conexión con el servidor");
      }

      const data = await res.json();
      
      // Parsear la respuesta que viene en el campo "output" como string con markdown
      let fichaData = data;
      if (data.output && typeof data.output === 'string') {
        const jsonMatch = data.output.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          fichaData = JSON.parse(jsonMatch[1]);
        }
      }
      
      // Manejar error de validación
      if (fichaData.tipo === "error_validacion") {
        setErrorValidacion(fichaData as ErrorValidacion);
        toast({
          title: "Nombre no válido",
          description: fichaData.error.mensaje,
          variant: "destructive",
        });
        return;
      }
      
      if (fichaData.tipo === "ficha_metodologica") {
        setFichaMetodologica(fichaData);
        setIsModalOpen(true);
        setMostrarInputPersonalizado(false);
        setNombrePersonalizado("");
        toast({
          title: "Ficha generada",
          description: `Se generó la ficha para "${nombrePersonalizado}"`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar la propuesta personalizada. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSeleccionar = async (propuesta: PropuestaIndicador, varianteSeleccionada?: string) => {
    setLoadingPropuestaId(propuesta.id);
    try {
      const overrideActivo = clasificacionOverride ||
        (variableInfo?.clasificacion_regla === "override_usuario"
          ? variableInfo?.clasificacion_representativa
          : null);

      const body = {
        idVar: idVar.toUpperCase(),
        sessionId,
        accion: "seleccionar",
        propuestaId: propuesta.id,
        nombrePropuesta: propuesta.nombre,
        varianteSeleccionada: varianteSeleccionada ?? propuesta.variante_usada ?? null,
        enfoque: propuesta.enfoque_id ?? "",
        enfoqueId: propuesta.enfoque_id ?? "",
        ...(overrideActivo ? { clasificacion_override: overrideActivo } : {}),
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Error en la conexión con el servidor");

      const data = await res.json();
      let fichaData = data;
      if (data.output && typeof data.output === 'string') {
        const jsonMatch = data.output.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) fichaData = JSON.parse(jsonMatch[1]);
      }

      if (fichaData.tipo === "ficha_metodologica") {
        setFichaMetodologica(fichaData);
        setIsModalOpen(true);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo conectar con el servidor. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setLoadingPropuestaId(null);
    }
  };

  const handleSeleccionarVariante = async (propuesta: PropuestaIndicador, variante: string) => {
    const key = `${propuesta.id}-${variante}`;
    setLoadingVarianteKey(key);
    try {
      const overrideActivo = clasificacionOverride ||
        (variableInfo?.clasificacion_regla === "override_usuario"
          ? variableInfo?.clasificacion_representativa
          : null);

      const body = {
        idVar: idVar.toUpperCase(),
        sessionId,
        accion: "seleccionar",
        propuestaId: propuesta.id,
        nombrePropuesta: propuesta.nombre,
        varianteSeleccionada: variante,
        enfoque: propuesta.enfoque_id ?? "",
        enfoqueId: propuesta.enfoque_id ?? "",
        ...(overrideActivo ? { clasificacion_override: overrideActivo } : {}),
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Error en la conexión con el servidor");

      const data = await res.json();
      let fichaData = data;
      if (data.output && typeof data.output === 'string') {
        const jsonMatch = data.output.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) fichaData = JSON.parse(jsonMatch[1]);
      }

      if (fichaData.tipo === "ficha_metodologica") {
        setFichaMetodologica(fichaData);
        setIsModalOpen(true);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar la ficha para esta variante.",
        variant: "destructive",
      });
    } finally {
      setLoadingVarianteKey(null);
    }
  };

const handleRegenerar = async (clasificacionOverrideVal?: string) => {
    setLoadingRegenerando(true);
    const idVarFinal = idVar.toUpperCase() || idFromUrl?.toUpperCase() || '';
    const esModoPorEnfoque = !!(enfoqueFromUrl && enfoqueFromUrl !== 'null');

    try {
      setPropuestasAcumuladas([]);
      setMostrandoTodas(false);
      setNumPropuestasIniciales(0);
      setFichaMetodologica(null);
      setErrorValidacion(null);
      setResponse(null);

      if (esModoPorEnfoque) {
        // Modo enfoque: regenerar la misma propuesta con la clasificación seleccionada manualmente
        const extras = clasificacionOverrideVal
          ? { clasificacion_override: clasificacionOverrideVal }
          : {};
        await enviarConsulta(
          clasificacionOverrideVal ? "generar_propuesta_enfoque_manual" : "generar_propuesta_enfoque",
          { enfoque: enfoqueFromUrl, ...extras }
        );
        toast({ title: "Regenerado", description: "La propuesta de enfoque se ha regenerado con la nueva clasificación." });
      } else {
        // Modo normal: regenerar propuestas iniciales
        const extras = clasificacionOverrideVal
          ? { clasificacion_override: clasificacionOverrideVal }
          : {};
        await enviarConsulta(clasificacionOverrideVal ? "iniciar_manual" : "iniciar", extras);
        toast({ title: "Regenerado", description: "Las propuestas iniciales se han regenerado correctamente." });
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudo regenerar las propuestas", variant: "destructive" });
    } finally {
      setLoadingRegenerando(false);
      setClasificacionOverride(null);
    }
  };

  const handleNuevaVariable = () => {
    setIdVar("");
    setResponse(null);
    setFichaMetodologica(null);
    setIsModalOpen(false);
    setPropuestasAcumuladas([]);
    setMostrandoTodas(false);
    setNombrePersonalizado("");
    setMostrarInputPersonalizado(false);
    setErrorValidacion(null);
    setVariableInfo(null);
    setLoadingPropuestaId(null);
    setLoadingMasOpciones(false);
    setNumPropuestasIniciales(0);
    setEnfoquesPermitidos([]);
    // Si venía por URL, navegar a la raíz
    if (idFromUrl) {
      navigate('/');
    }
  };

  // Helper para obtener advertencia ambiental
  const getAdvertenciaAmbiental = (): AdvertenciaAmbiental | undefined => {
    if (response && (response.tipo === 'propuestas_iniciales' || response.tipo === 'propuestas_adicionales')) {
      return response.advertencia_ambiental;
    }
    return undefined;
  };

  const advertenciaAmbiental = getAdvertenciaAmbiental();

  // Descargar ficha metodológica en Word
  const handleDownloadFichaWord = async () => {
    if (!fichaMetodologica) return;

    const ficha = fichaMetodologica.ficha;
    const indicador = fichaMetodologica.indicador;

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: "Ficha Metodológica del Indicador",
              heading: HeadingLevel.HEADING_1,
              alignment: "center",
            }),
            new Paragraph({
              text: "Instituto Nacional de Estadística y Geografía",
              alignment: "center",
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: indicador.nombre, bold: true, size: 28 }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Siglas: ${indicador.siglas}`, italics: true }),
              ],
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: "─".repeat(50),
              spacing: { after: 400 },
            }),
            // Objetivo
            new Paragraph({
              text: "Objetivo del Indicador",
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              text: ficha.objetivo,
              spacing: { after: 300 },
            }),
            // Importancia
            new Paragraph({
              text: "Importancia y/o Utilidad",
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              text: ficha.importancia,
              spacing: { after: 300 },
            }),
            // Definición de variables
            new Paragraph({
              text: "Definición de las Variables",
              heading: HeadingLevel.HEADING_2,
            }),
            ...Object.entries(ficha.definicion_variables || {}).flatMap(([nombre, definicion]) => [
              new Paragraph({
                children: [
                  new TextRun({ text: `• ${nombre}: `, bold: true }),
                  new TextRun({ text: definicion as string }),
                ],
                spacing: { after: 100 },
              }),
            ]),
            new Paragraph({ text: "", spacing: { after: 200 } }),
            // Unidad y Fórmula
            new Paragraph({
              text: "Unidad de Medida",
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              text: ficha.unidad,
              spacing: { after: 300 },
            }),
            new Paragraph({
              text: "Fórmula",
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              children: [new TextRun({ text: ficha.formula, bold: true })],
              spacing: { after: 200 },
            }),
            ...Object.entries(ficha.formula_detalle || {}).flatMap(([sigla, desc]) => [
              new Paragraph({
                children: [
                  new TextRun({ text: `${sigla}: `, bold: true }),
                  new TextRun({ text: desc as string }),
                ],
                spacing: { after: 100 },
              }),
            ]),
            new Paragraph({ text: "", spacing: { after: 200 } }),
            // Cobertura y desagregación
            new Paragraph({
              text: "Cobertura Geográfica",
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              text: ficha.cobertura,
              spacing: { after: 300 },
            }),
            new Paragraph({
              text: "Desagregación",
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              text: ficha.desagregacion,
              spacing: { after: 300 },
            }),
            // Temporalidad
            new Paragraph({
              text: "Información Temporal",
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Período: ", bold: true }),
                new TextRun({ text: ficha.temporal }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Frecuencia: ", bold: true }),
                new TextRun({ text: ficha.frecuencia }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Periodicidad: ", bold: true }),
                new TextRun({ text: ficha.periodicidad }),
              ],
              spacing: { after: 300 },
            }),
            // Fuente
            new Paragraph({
              text: "Fuente de Información",
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Nombre: ", bold: true }),
                new TextRun({ text: ficha.fuente?.nombre || "" }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Institución: ", bold: true }),
                new TextRun({ text: ficha.fuente?.institucion || "" }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Programa: ", bold: true }),
                new TextRun({ text: ficha.fuente?.programa || "" }),
              ],
            }),
            ...(ficha.fuente?.url ? [
              new Paragraph({
                children: [
                  new TextRun({ text: "URL: ", bold: true }),
                  new TextRun({ text: ficha.fuente.url }),
                ],
              }),
            ] : []),
            new Paragraph({ text: "", spacing: { after: 200 } }),
            // Tabla de datos
            ...(fichaMetodologica.visualizacion?.tabla ? (() => {
              const tb = fichaMetodologica.visualizacion!.tabla;
              const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
              const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
              const cellMargins = { top: 40, bottom: 40, left: 80, right: 80 };
              const colCount = tb.columnas.length;
              const colW = Math.floor(9360 / colCount);
              const columnWidths = Array(colCount).fill(colW);
              const headerCells = tb.columnas.map(col =>
                new TableCell({
                  borders: cellBorders, margins: cellMargins,
                  width: { size: colW, type: WidthType.DXA },
                  shading: { fill: "003D6B", type: ShadingType.CLEAR },
                  children: [new Paragraph({ alignment: col.tipo === "texto" ? AlignmentType.LEFT : AlignmentType.RIGHT, children: [new TextRun({ text: col.label, bold: true, color: "FFFFFF", size: 18 })] })],
                })
              );
              const dataRows = tb.filas.map((fila, idx) => {
                const fill = idx % 2 === 0 ? "FFFFFF" : "E8F0FE";
                return new TableRow({
                  children: tb.columnas.map(col => {
                    const val = fila[col.key];
                    let text = "—";
                    if (val !== null && val !== undefined) {
                      if (col.tipo === "porcentaje") text = Number(val).toFixed(2) + "%";
                      else if (col.tipo === "numero") text = Number(val).toLocaleString('es-MX');
                      else text = String(val);
                    }
                    return new TableCell({
                      borders: cellBorders, margins: cellMargins,
                      width: { size: colW, type: WidthType.DXA },
                      shading: { fill, type: ShadingType.CLEAR },
                      children: [new Paragraph({ alignment: col.tipo === "texto" ? AlignmentType.LEFT : AlignmentType.RIGHT, children: [new TextRun({ text, size: 20 })] })],
                    });
                  }),
                });
              });
              return [
                new Paragraph({
                  text: "Tabla de Datos",
                  heading: HeadingLevel.HEADING_2,
                }),
                new Table({
                  width: { size: 9360, type: WidthType.DXA },
                  columnWidths,
                  rows: [
                    new TableRow({ children: headerCells }),
                    ...dataRows,
                  ],
                }),
                ...(tb.notas?.map(nota => new Paragraph({
                  children: [new TextRun({ text: nota, italics: true, size: 18, color: "666666" })],
                  spacing: { after: 100 },
                })) || []),
                new Paragraph({ text: "", spacing: { after: 200 } }),
              ];
            })() : []),
            // Gráfico (nota referencial)
            ...(fichaMetodologica.visualizacion?.grafico ? [
              new Paragraph({
                text: "Gráfico",
                heading: HeadingLevel.HEADING_2,
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: fichaMetodologica.visualizacion.grafico.titulo, bold: true }),
                ],
                spacing: { after: 100 },
              }),
              ...(fichaMetodologica.visualizacion.grafico.subtitulo ? [
                new Paragraph({
                  children: [new TextRun({ text: fichaMetodologica.visualizacion.grafico.subtitulo, italics: true, color: "666666" })],
                  spacing: { after: 100 },
                }),
              ] : []),
              new Paragraph({
                children: [new TextRun({ text: `Tipo de gráfico: ${fichaMetodologica.visualizacion.grafico.tipo}`, italics: true })],
                spacing: { after: 100 },
              }),
              new Paragraph({
                children: [new TextRun({ text: "(El gráfico interactivo está disponible en la aplicación web)", italics: true, color: "999999" })],
                spacing: { after: 200 },
              }),
              ...(fichaMetodologica.visualizacion.grafico.notas?.map(nota => new Paragraph({
                children: [new TextRun({ text: nota, italics: true, size: 18, color: "666666" })],
                spacing: { after: 100 },
              })) || []),
              new Paragraph({ text: "", spacing: { after: 200 } }),
            ] : []),
            // Limitaciones
            ...(ficha.limitaciones && ficha.limitaciones.length > 0 ? [
              new Paragraph({
                text: "Limitaciones",
                heading: HeadingLevel.HEADING_2,
              }),
              ...ficha.limitaciones.map((lim) =>
                new Paragraph({
                  children: [new TextRun({ text: `• ${lim}` })],
                  spacing: { after: 100 },
                })
              ),
              new Paragraph({ text: "", spacing: { after: 200 } }),
            ] : []),
            // Alineación
            new Paragraph({
              text: "Alineación con Marcos Internacionales",
              heading: HeadingLevel.HEADING_2,
            }),
            // ODS
            new Paragraph({
              children: [new TextRun({ text: "Objetivos de Desarrollo Sostenible (ODS)", bold: true, size: 22 })],
              spacing: { after: 100 },
            }),
            ...(ficha.alineacion?.ods && ficha.alineacion.ods.length > 0
              ? ficha.alineacion.ods.flatMap((ods) => [
                  new Paragraph({
                    children: [
                      new TextRun({ text: `ODS: `, bold: true }),
                      new TextRun({ text: ods.objetivo }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Meta: ", bold: true }),
                      new TextRun({ text: ods.meta }),
                    ],
                  }),
                  ...(ods.indicador && ods.indicador !== '-' ? [
                    new Paragraph({
                      children: [
                        new TextRun({ text: "Indicador: ", bold: true }),
                        new TextRun({ text: ods.indicador }),
                      ],
                    }),
                  ] : []),
                  new Paragraph({ text: "", spacing: { after: 100 } }),
                ])
              : [new Paragraph({
                  children: [new TextRun({ text: "Sin alineación específica detectada", italics: true, color: "666666" })],
                  spacing: { after: 100 },
                })]),
            // MDEA
            new Paragraph({
              children: [new TextRun({ text: "Marco de Desarrollo Estadístico Ambiental (MDEA)", bold: true, size: 22 })],
              spacing: { before: 200, after: 100 },
            }),
            ...(ficha.alineacion?.mdea && ficha.alineacion.mdea.length > 0
              ? ficha.alineacion.mdea.flatMap((mdea) => [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Componente: ", bold: true }),
                      new TextRun({ text: mdea.componente }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Subcomponente: ", bold: true }),
                      new TextRun({ text: mdea.subcomponente }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Tópico: ", bold: true }),
                      new TextRun({ text: mdea.topico }),
                    ],
                  }),
                  ...(mdea.estadistica1 && mdea.estadistica1 !== '-' ? [
                    new Paragraph({
                      children: [
                        new TextRun({ text: "Estadística 1: ", bold: true }),
                        new TextRun({ text: mdea.estadistica1 }),
                      ],
                    }),
                  ] : []),
                  ...(mdea.estadistica2 && mdea.estadistica2 !== '-' ? [
                    new Paragraph({
                      children: [
                        new TextRun({ text: "Estadística 2: ", bold: true }),
                        new TextRun({ text: mdea.estadistica2 }),
                      ],
                    }),
                  ] : []),
                  new Paragraph({ text: "", spacing: { after: 100 } }),
                ])
              : [new Paragraph({
                  children: [new TextRun({ text: "Sin alineación específica detectada", italics: true, color: "666666" })],
                  spacing: { after: 100 },
                })]),
            // PND
            ...(ficha.alineacion?.pnd && ficha.alineacion.pnd.length > 0 ? [
              new Paragraph({
                children: [new TextRun({ text: "Plan Nacional de Desarrollo (PND)", bold: true, size: 22 })],
                spacing: { before: 200, after: 100 },
              }),
              ...ficha.alineacion.pnd.flatMap((pnd) => [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Eje: ", bold: true }),
                    new TextRun({ text: pnd.eje }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: "Objetivo: ", bold: true }),
                    new TextRun({ text: pnd.objetivo }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: "Estrategia: ", bold: true }),
                    new TextRun({ text: pnd.estrategia }),
                  ],
                }),
              ]),
            ] : []),
            new Paragraph({
              text: `Generado el ${new Date().toLocaleDateString("es-MX")}`,
              alignment: "center",
              spacing: { before: 800 },
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `ficha_${indicador.siglas || idVar || "indicador"}.docx`);

    toast({
      title: "Word descargado",
      description: "La ficha metodológica se ha exportado correctamente.",
    });
  };


  return (
    <div className="min-h-screen bg-gradient-inegi">
      {/* Header INEGI */}
      <header className="bg-inegi-blue-dark text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center">
            {/* Logo INEGI */}
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold tracking-tight">INEGI</div>
              <div className="h-12 w-px bg-white/30 hidden sm:block"></div>
              <div className="flex flex-col">
                <h1 className="text-lg sm:text-xl font-semibold leading-tight">
                  Generador de Propuestas de Indicadores Ambientales
                </h1>
                <p className="text-sm text-white/80 hidden sm:block">
                  Instituto Nacional de Estadística y Geografía
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Formulario de búsqueda o versión compacta */}
        {idFromUrl ? (
          <Card className="shadow-lg border-l-4 border-l-inegi-blue-medium">
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {(loading && !response) || loadingRegenerando ? (
                    <Loader2 className="w-5 h-5 animate-spin text-inegi-blue-medium" />
                  ) : null}
                  <div>
                    <p className="text-sm text-inegi-gray-medium">Variable en consulta</p>
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <p className="text-lg font-semibold text-inegi-blue-medium">
                        {idFromUrl.toUpperCase()}
                        {variableInfo ? ` — ${variableInfo.nombre}` : (response?.tipo === "error_temporalidad" ? ` — ${response.variable.nombre}` : "")}
                      </p>
                    </div>
                    {(loading && !response) || loadingRegenerando ? (
                      <p className="text-sm text-inegi-gray-medium mt-1">
                        {loadingRegenerando ? "Regenerando propuestas de indicadores..." : "Analizando variable y generando propuestas de indicadores..."}
                      </p>
                    ) : null}
                  </div>
                </div>
                {variableInfo && propuestasAcumuladas.length > 0 && !loadingRegenerando && variableInfo._flags?.tipo && ['binaria', 'multicategoria'].includes(variableInfo._flags.tipo) && !(['E5', 'E9', 'E10'].includes(enfoqueFromUrl ?? '')) && (
                  <AlertDialog onOpenChange={(open) => {
                    if (open) {
                      // Pre-select current representative classification
                      const currentRep = variableInfo?.clasificacion_representativa ?? null;
                      setClasificacionOverride(currentRep);
                    } else {
                      setClasificacionOverride(null);
                    }
                  }}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={loadingRegenerando || loading}
                        className="border-inegi-blue-medium/30 text-inegi-blue-medium hover:bg-inegi-blue-light shrink-0"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Regenerar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-md rounded-2xl border-0 shadow-2xl p-0 overflow-hidden">
                      {/* Header decorativo */}
                      <div className="bg-gradient-to-r from-inegi-blue-dark to-inegi-blue-medium px-6 pt-6 pb-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <RotateCcw className="w-5 h-5 text-white" />
                          </div>
                          <AlertDialogHeader className="space-y-1 flex-1">
                            <AlertDialogTitle className="text-white text-lg font-bold">¿Regenerar propuestas?</AlertDialogTitle>
                            <AlertDialogDescription className="text-blue-100/90 text-sm">
                              Se generarán nuevas propuestas para <strong className="text-white font-semibold">{idVar || idFromUrl?.toUpperCase()}</strong> con la clase seleccionada.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                        </div>
                      </div>

                      <div className="px-6 pb-6 pt-4">
                      {variableInfo._flags?.tipo && ['binaria', 'multicategoria'].includes(variableInfo._flags.tipo) &&
                       variableInfo.clasificaciones && variableInfo.clasificaciones.length > 0 && (() => {
                        const clases = variableInfo.clasificaciones!
                          .map(c => (typeof c === 'string' ? c : c?.clase ?? ''))
                          .filter(Boolean);
                        if (clases.length === 0) return null;
                        const currentRep = variableInfo.clasificacion_representativa ?? clases[0];
                        return (
                          <div className="space-y-3 mb-5">
                            <p className="text-sm font-semibold text-inegi-blue-dark">
                              Clase de análisis
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Selecciona la clase que representará el fenómeno en los indicadores. Si no seleccionas ninguna, se usará <span className="font-semibold text-inegi-blue-dark italic">{currentRep}</span> de forma automática.
                            </p>
                            <RadioGroup
                              value={clasificacionOverride ?? ""}
                              onValueChange={(val) => setClasificacionOverride(val)}
                              className="space-y-2 pt-1 max-h-[260px] overflow-y-auto pr-1"
                            >
                              {clases.map((clase) => {
                                const isSelected = clasificacionOverride === clase;
                                return (
                                  <label
                                    key={clase}
                                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                                      isSelected
                                        ? 'border-inegi-blue-medium bg-inegi-blue-light shadow-sm shadow-inegi-blue-medium/10'
                                        : 'border-border bg-background hover:border-inegi-blue-medium/40 hover:bg-secondary/50'
                                    }`}
                                  >
                                    <RadioGroupItem value={clase} className="shrink-0" />
                                    <span className={`text-sm leading-snug ${
                                      isSelected
                                        ? 'text-inegi-blue-dark font-semibold'
                                        : 'text-foreground'
                                    }`}>
                                      {clase}
                                    </span>
                                  </label>
                                );
                              })}
                            </RadioGroup>
                          </div>
                        );
                      })()}

                      <AlertDialogFooter className="flex-row gap-3 sm:gap-3">
                        <AlertDialogCancel
                          onClick={() => setClasificacionOverride(null)}
                          className="flex-1 rounded-xl h-11 border-2 font-medium hover:bg-secondary"
                        >
                          Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            const currentRep = variableInfo?.clasificacion_representativa ?? null;
                            const changed = clasificacionOverride && clasificacionOverride !== currentRep;
                            handleRegenerar(changed ? clasificacionOverride : undefined);
                          }}
                          className="flex-1 rounded-xl h-11 bg-inegi-blue-medium hover:bg-inegi-blue-dark font-medium shadow-lg shadow-inegi-blue-medium/25"
                        >
                          Regenerar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                      </div>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-xl border-0">
            <CardHeader>
              <CardTitle className="text-2xl text-inegi-blue-dark">Consultar Variable</CardTitle>
              <CardDescription>
                Ingresa el ID de la variable para generar propuestas de indicadores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInicio} className="flex gap-3">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Ej: ENIGH-068, CPV-139"
                    value={idVar}
                    onChange={(e) => setIdVar(e.target.value.toUpperCase())}
                    disabled={loading}
                    className="text-lg h-12 border-inegi-blue-medium/30 focus:border-inegi-blue-medium focus:ring-inegi-blue-medium"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading || idVar.trim().length < 3}
                  className="h-12 px-6 bg-inegi-blue-medium hover:bg-inegi-blue-dark"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Consultando...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5 mr-2" />
                      Generar Propuestas
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Resultados */}
        {response && (
          <div id="result-section" className="mt-8 space-y-6">
            {/* Advertencia Ambiental */}
            {advertenciaAmbiental?.detectado && (
              <Alert className="border-inegi-gold border-l-4 bg-amber-50">
                <AlertTriangle className="h-5 w-5 text-inegi-gold" />
                <AlertTitle className="text-inegi-blue-dark font-semibold">
                  {advertenciaAmbiental.mensaje}
                </AlertTitle>
                <AlertDescription className="text-inegi-gray-medium space-y-2 mt-2">
                  <p><strong className="text-inegi-blue-dark">Razón:</strong> {advertenciaAmbiental.razon}</p>
                  <p className="text-sm">
                    <strong className="text-inegi-blue-dark">Tema detectado:</strong> {advertenciaAmbiental.tema_detectado}
                    {advertenciaAmbiental.subtema_detectado && 
                      ` - ${advertenciaAmbiental.subtema_detectado}`
                    }
                  </p>
                  {advertenciaAmbiental.recomendacion && (
                    <p className="text-sm mt-2 pt-2 border-t border-inegi-gold">
                      💡 <strong className="text-inegi-blue-dark">Recomendación:</strong> {advertenciaAmbiental.recomendacion}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Error de temporalidad */}
            {response.tipo === "error_temporalidad" && (
              <Card className="border-l-4 border-l-inegi-blue-medium shadow-xl">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <AlertCircle className="w-8 h-8 text-inegi-blue-medium flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <CardTitle className="text-inegi-blue-dark text-xl">
                        {response.error.mensaje}
                      </CardTitle>
                      <CardDescription className="text-inegi-gray-medium mt-2">
                        {response.variable.proceso?.proceso
                          ? response.error.razon.split(response.variable.proceso.proceso).map((part, i, arr) =>
                              i < arr.length - 1 ? (
                                <span key={i}>{part}<strong className="text-inegi-blue-medium">{response.variable.proceso?.proceso}</strong></span>
                              ) : <span key={i}>{part}</span>
                            )
                          : response.error.razon
                        }
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {/* Información de la variable */}
                  <div className="bg-inegi-blue-light rounded-lg p-4 space-y-3">
                    <p className="text-xs text-inegi-gray-medium uppercase tracking-wider mb-2">Disponibilidad de datos</p>
                    
                    {/* Años disponibles vs requeridos */}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-amber-100 border-inegi-gold text-amber-900 font-semibold">
                        Disponibles: {response.error.detalles.anios_disponibles} año(s)
                      </Badge>
                      <span className="text-inegi-gray-medium">·</span>
                      <Badge variant="outline" className="bg-green-100 border-inegi-green text-green-800 font-semibold">
                        Requeridos: {response.error.detalles.anios_requeridos} años
                      </Badge>
                    </div>

                    {/* Lista de años */}
                    <div>
                      <p className="text-xs text-inegi-gray-medium mb-2">Años con información:</p>
                      <div className="flex flex-wrap gap-2">
                        {response.variable.años.map((año) => (
                          <Badge key={año} variant="secondary" className="text-xs bg-white text-inegi-blue-dark font-medium border border-inegi-blue-medium/20">
                            {año}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Sugerencia */}
                  <div className="space-y-2">
                    <p className="text-xs text-inegi-gray-medium uppercase tracking-wider font-semibold">Sugerencia</p>
                    <div className="border border-inegi-blue-medium/20 rounded-lg overflow-hidden">

                      {/* Texto de sugerencia — siempre visible */}
                      <div className="flex items-start gap-2.5 px-3 py-3 border-b border-inegi-blue-medium/10">
                        <p className="text-sm text-inegi-gray-medium leading-relaxed">
                          {response.error.sugerencia}
                        </p>
                      </div>

                      {/* Alternativas — solo cuando nivel_fuente es nivel_a o nivel_b y hay alternativas */}
                      {(response.error.nivel_fuente === 'nivel_a' || response.error.nivel_fuente === 'nivel_b') &&
                        response.error.alternativas && response.error.alternativas.length > 0 && (
                        <>
                          {/* Badge de nivel */}
                          <div className="flex flex-wrap gap-2 px-3 py-2 bg-inegi-blue-light border-b border-inegi-blue-medium/15">
                            {response.error.nivel_fuente === 'nivel_a' && (
                              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-600 inline-block" />
                                Variables alternativas con nombre similar
                              </span>
                            )}
                            {response.error.nivel_fuente === 'nivel_b' && (
                              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                                Variables alternativas por similitud conceptual
                              </span>
                            )}
                            {/* Aviso si todas son inactivas/históricas */}
                            {response.error.alternativas_fallback && (
                              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                                Sin procesos activos disponibles
                              </span>
                            )}
                          </div>

                          {/* Lista de alternativas con proceso y clic */}
                          <div className="divide-y divide-inegi-blue-medium/10">
                            {response.error.alternativas.map((alt) => (
                              <button
                                key={alt.idVar}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-inegi-blue-light transition-colors duration-150"
                                onClick={() => {
                                  window.open(`https://inegi-indicator-gen.lovable.app/?idVar=${alt.idVar.toUpperCase().trim()}`, '_blank');
                                }}
                              >
                                <span className="text-sm font-semibold text-inegi-blue-medium min-w-[90px]">
                                  {alt.idVar}
                                </span>
                                <span className="text-sm text-inegi-gray-dark flex-1">
                                  <span className="font-medium">{alt.nombre}</span>
                                  {'proceso_nombre' in alt && alt.proceso_nombre && (
                                    <span className="block text-xs text-inegi-gray-medium mt-0.5">{alt.proceso_nombre}</span>
                                  )}
                                </span>
                                <span className="text-xs text-inegi-gray-medium whitespace-nowrap">
                                  {alt.totalAnios} años
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                                  alt.estatus_similar === 'Activo'
                                    ? 'bg-green-100 text-green-800'
                                    : alt.estatus_similar === 'Inactivo'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {alt.estatus_similar}
                                </span>
                                <span className="text-inegi-gray-medium">›</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Propuestas */}
            {(response.tipo === "propuestas_iniciales" || response.tipo === "propuestas_adicionales") && (() => {
              const propuestasIniciales = propuestasAcumuladas.slice(0, numPropuestasIniciales);
              const propuestasAdicionalesArr = propuestasAcumuladas.slice(numPropuestasIniciales);
              const enfoquesInicialesIds = new Set(propuestasIniciales.map(p => p.enfoque_id).filter(Boolean));
              const enfoquesAdicionalesIds = new Set(propuestasAdicionalesArr.map(p => p.enfoque_id).filter(Boolean));
              // Map enfoque_id -> proposal number (1-based)
              const enfoqueToPropuesta: Record<string, number> = {};
              propuestasAcumuladas.forEach((p, i) => {
                if (p.enfoque_id && !enfoqueToPropuesta[p.enfoque_id]) {
                  enfoqueToPropuesta[p.enfoque_id] = i + 1;
                }
              });

              const renderCard = (propuesta: PropuestaIndicador, index: number, isInicial: boolean = true) => (
                <Card
                  key={propuesta.id}
                  className="shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-inegi-blue-medium/10 animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-inegi-blue-medium text-white flex items-center justify-center font-bold text-sm">
                            {propuesta.id}
                          </div>
                          <CardTitle className="text-lg leading-tight text-inegi-blue-dark">
                            {propuesta.nombre}
                          </CardTitle>
                        </div>
                        <CardDescription className="mt-2 text-inegi-gray-medium">
                          {propuesta.descripcion}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      {propuesta.enfoque_id && (
                        <Badge
                          variant="outline"
                          className={`font-bold text-xs ${
                            isInicial
                              ? "bg-[#EAF3DE] text-[#27500A] border-[#EAF3DE]"
                              : "bg-[#E6F1FB] text-[#0C447C] border-[#E6F1FB]"
                          }`}
                        >
                          {propuesta.enfoque_id}
                        </Badge>
                      )}
                      <Badge
                        className={`${
                          isInicial
                            ? "bg-[#EAF3DE] text-[#27500A]"
                            : "bg-[#E6F1FB] text-[#0C447C]"
                        }`}
                      >
                        {propuesta.enfoque}
                      </Badge>
                    </div>
                    {propuesta.razon_seleccion && (
                      <div className="rounded-md bg-[#E8F4F8] border-l-3 border-[#0066B3] px-3 py-2.5">
                        <p className="text-xs font-semibold text-[#00447C] uppercase mb-1">¿Por qué este enfoque?</p>
                        <p className="text-xs text-[#333333] leading-relaxed">{propuesta.razon_seleccion}</p>
                      </div>
                    )}
                    {propuesta.variantes && propuesta.variantes.length > 0 && (
                      <div className="rounded-md bg-[#F0F7FF] border border-[#C5DCEF] px-3 py-2.5">
                        <p className="text-xs font-semibold text-[#00447C] uppercase mb-1.5">
                          Variantes disponibles
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {propuesta.variantes.map((variante, idx) => {
                            const esUsada = variante === propuesta.variante_usada;
                            const varianteKey = `${propuesta.id}-${variante}`;
                            const estaCargando = loadingVarianteKey === varianteKey;

                            if (esUsada) {
                              return (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#185FA5] text-white border border-[#185FA5]"
                                >
                                  <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  {variante}
                                </span>
                              );
                            }

                            return (
                              <TooltipProvider key={idx}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => handleSeleccionarVariante(propuesta, variante)}
                                      disabled={loadingPropuestaId !== null || loadingMasOpciones || loadingVarianteKey !== null}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white text-[#185FA5] border border-[#C5DCEF] hover:bg-[#185FA5] hover:text-white hover:border-[#185FA5] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {estaCargando ? (
                                        <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                                      ) : (
                                        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 12 12" fill="none">
                                          <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                        </svg>
                                      )}
                                      {variante}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    Generar ficha con variante "{variante}"
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {propuesta.formula && (
                      <div className="rounded-md bg-[#F5F5F5] border border-[#E0E0E0] px-3 py-2.5">
                        <p className="text-xs font-semibold text-[#666666] mb-1">Fórmula:</p>
                        <p className="text-sm font-mono text-[#333333]">{propuesta.formula}</p>
                      </div>
                    )}
                    <Button
                      onClick={() => handleSeleccionar(propuesta)}
                      disabled={loadingPropuestaId !== null || loadingMasOpciones}
                      className="w-full bg-inegi-gold hover:bg-[#D4A004] text-inegi-gray-dark font-semibold"
                    >
                      {loadingPropuestaId === propuesta.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Generando ficha metodológica...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Generar ficha metodológica
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );

              return (
                <div className="animate-fade-in">
                  {/* Sección: Definición */}
                  {variableInfo && propuestasAcumuladas.length > 0 && (() => {
                    const tipoVar = variableInfo._flags?.tipo;
                    const tipoLabel: Record<string, string> = {
                      multicategoria: "Multicategoría",
                      binaria: "Binaria",
                      numerica: "Numérica",
                    };
                    const estatus = variableInfo.proceso?.estatus;
                    const estatusColor: Record<string, string> = {
                      Activo: "bg-green-100 text-green-800 border-green-300",
                      Inactivo: "bg-red-100 text-red-800 border-red-300",
                      Histórico: "bg-amber-100 text-amber-800 border-amber-300",
                    };
                    const viabilidadNivel = (response as PropuestasIniciales)?.variable?.viabilidad?.nivel ?? null;

                    return (
                      <Card className="shadow-lg border-l-4 border-l-inegi-blue-medium animate-fade-in mb-6">
                        <CardContent className="pt-6 space-y-4">

                          {/* Definición */}
                          <div>
                            <p className="text-sm font-semibold text-inegi-gray-dark uppercase tracking-wider mb-1">Definición</p>
                            <p className="text-inegi-gray-dark font-semibold">{variableInfo.definicion}</p>
                          </div>

                          {/* Fila 1: tema, subtema, años */}
                          <div className="flex flex-wrap gap-2">
                            <Badge className="bg-inegi-blue-dark text-white">{variableInfo.tema}</Badge>
                            <Badge className="bg-inegi-blue-medium text-white">{variableInfo.subtema}</Badge>
                            <Badge className="bg-inegi-green text-white">
                              {variableInfo.totalAnios} años disponibles
                            </Badge>
                            <Badge variant="outline" className="border-inegi-blue-medium text-inegi-blue-dark">
                              {variableInfo.años.join(", ")}
                            </Badge>
                          </div>

                          {/* Divisor */}
                          <div className="border-t border-inegi-blue-medium/10" />

                          {/* Fila 2: proceso + estatus + tipo variable + viabilidad */}
                          <div className="flex flex-wrap items-center gap-3">

                            {/* Proceso de producción */}
                            {variableInfo.proceso?.proceso && (
                              <span className="text-xs text-inegi-gray-medium">
                                <span className="font-medium text-inegi-blue-dark">Proceso: </span>
                                {variableInfo.proceso.proceso}
                              </span>
                            )}

                            {/* Estatus */}
                            {estatus && (
                              <Badge variant="outline" className={`border ${estatusColor[estatus] ?? "bg-gray-100 text-gray-700 border-gray-300"}`}>
                                {estatus}
                              </Badge>
                            )}

                            {/* Tipo de variable con tooltip de clasificaciones */}
                            {tipoVar && (
                              <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex">
                                      <Badge
                                        variant="outline"
                                        className="border-inegi-blue-medium/40 text-inegi-blue-dark bg-inegi-blue-light cursor-help"
                                      >
                                        {tipoLabel[tipoVar] ?? tipoVar}
                                      </Badge>
                                    </span>
                                  </TooltipTrigger>
                                   <TooltipContent side="bottom" className="max-w-xs p-3 bg-white border border-gray-200 shadow-xl rounded-lg">
                                     {variableInfo?.clasificaciones && variableInfo.clasificaciones.length > 0 ? (
                                       <>
                                         <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                                           Clasificaciones disponibles
                                         </p>
                                         <div className="flex flex-col gap-1">
                                           {variableInfo.clasificaciones.map((c, i) => (
                                             <div key={i} className="flex items-center gap-1.5">
                                               <div className="w-1.5 h-1.5 rounded-full bg-inegi-blue-medium flex-shrink-0" />
                                               <span className="text-xs text-gray-700">{c.clase}</span>
                                             </div>
                                           ))}
                                         </div>
                                       </>
                                     ) : (
                                       <span className="text-xs text-gray-400">Sin clasificaciones</span>
                                     )}
                                   </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {/* Viabilidad */}
                            {viabilidadNivel && (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
                                <span className="text-xs text-inegi-gray-medium">Viabilidad</span>
                                <div className="flex gap-1">
                                  {[1, 2, 3].map(i => (
                                    <div key={i} className={`w-2.5 h-2.5 rounded-full ${
                                      viabilidadNivel === "Alta" ? "bg-green-600" :
                                      viabilidadNivel === "Media" && i <= 2 ? "bg-amber-500" :
                                      viabilidadNivel === "Baja" && i === 1 ? "bg-red-500" : "bg-gray-200"
                                    }`} />
                                  ))}
                                </div>
                                <span className={`text-xs font-medium ${
                                  viabilidadNivel === "Alta" ? "text-green-700" :
                                  viabilidadNivel === "Media" ? "text-amber-600" : "text-red-600"
                                }`}>
                                  {viabilidadNivel}
                                </span>
                              </div>
                            )}

                          </div>

                          {(viabilidadNivel === "Media" || viabilidadNivel === "Baja") && (
                            <div className={`flex items-start gap-2 rounded-lg px-3 py-2 mt-2 border ${
                              viabilidadNivel === "Media"
                                ? "bg-amber-50 border-amber-300"
                                : "bg-red-50 border-red-300"
                            }`}>
                              <span className={`text-sm flex-shrink-0 mt-0.5 ${
                                viabilidadNivel === "Media" ? "text-amber-600" : "text-red-600"
                              }`}>ⓘ</span>
                              <p className={`text-xs leading-relaxed m-0 ${
                                viabilidadNivel === "Media" ? "text-amber-800" : "text-red-800"
                              }`}>
                                {viabilidadNivel === "Media"
                                  ? "Este proceso ya no genera nuevas ediciones; los indicadores se calcularán únicamente con los datos disponibles."
                                  : "Esta variable no cuenta con tabulados, microdatos ni datos abiertos disponibles; los indicadores generados tendrán limitaciones importantes para su cálculo."
                                }
                              </p>
                            </div>
                          )}

                          {/* Fila 3: categoría de análisis (solo si existe) */}
                          {variableInfo.clasificacion_representativa && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-inegi-blue-light border border-inegi-blue-medium/20">
                              <span className="text-xs text-inegi-gray-medium">Clase de análisis:</span>
                              <span className="text-xs font-semibold text-inegi-blue-dark">
                                {variableInfo.clasificacion_representativa}
                              </span>
                              <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-[10px] text-inegi-gray-medium inline-flex items-center gap-1 cursor-help">
                                      · {variableInfo.clasificacion_regla === "override_usuario"
                                          ? "Definida manualmente"
                                          : "Automática"}
                                      {variableInfo.justificacion_clasificacion && (
                                        <span className="text-inegi-gray-medium/60 text-[11px]">ⓘ</span>
                                      )}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="max-w-[380px] bg-white text-inegi-gray-dark text-xs leading-relaxed p-3 shadow-md border border-inegi-blue-medium/15 rounded-lg">
                                    {variableInfo.justificacion_clasificacion || "Sin justificación disponible"}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          )}

                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Sidebar fijo a la izquierda de la página */}
                  <div className="hidden lg:block fixed left-0 top-20 w-[220px] z-40 h-[calc(100vh-5rem)] overflow-y-auto p-3">
                    <div className="bg-white rounded-lg border border-inegi-blue-medium/10 shadow-sm p-4 space-y-4">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-inegi-gray-medium">
                        Catálogo de enfoques
                      </p>
                      {/* Leyenda */}
                      <div className="space-y-1 text-[11px] text-inegi-gray-medium">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-inegi-green inline-block" />
                          Inicial
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-inegi-blue-medium inline-block" />
                          Adicional
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
                          Disponible
                        </div>
                      </div>
                      {/* Chips */}
                      <TooltipProvider delayDuration={200}>
                      <div className="space-y-1.5">
                        {CATALOGO_ENFOQUES.map((enfoque) => {
                          const isInicial = enfoquesInicialesIds.has(enfoque.id);
                          const isAdicional = enfoquesAdicionalesIds.has(enfoque.id);
                          const isGenerado = isInicial || isAdicional;
                          const detalle = CATALOGO_ENFOQUES_DETALLE[enfoque.id];
                          const propNum = enfoqueToPropuesta[enfoque.id];
                          return (
                            <Tooltip key={enfoque.id}>
                              <TooltipTrigger asChild>
                                <div
                                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                                    isInicial
                                      ? "bg-inegi-green/10 border border-inegi-green/30"
                                      : isAdicional
                                      ? "bg-inegi-blue-medium/10 border border-inegi-blue-medium/30"
                                      : "bg-gray-50 border border-gray-100 opacity-50"
                                  }`}
                                >
                                  <span className={`font-bold flex-shrink-0 ${
                                    isInicial ? "text-inegi-green" : isAdicional ? "text-inegi-blue-medium" : "text-gray-400"
                                  }`}>
                                    {enfoque.id}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className={`font-semibold leading-tight truncate ${
                                      isGenerado ? "text-inegi-blue-dark" : "text-gray-400"
                                    }`}>
                                      {enfoque.nombre}
                                    </p>
                                    <p className={`text-[10px] leading-tight truncate ${
                                      isGenerado ? "text-inegi-gray-medium" : "text-gray-300"
                                    }`}>
                                      {enfoque.descripcion}
                                    </p>
                                  </div>
                                  {isGenerado && (
                                    <Check className={`w-3.5 h-3.5 flex-shrink-0 ${
                                      isInicial ? "text-inegi-green" : "text-inegi-blue-medium"
                                    }`} />
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="w-72 p-0 bg-white border border-gray-200 shadow-xl rounded-lg overflow-hidden" sideOffset={8}>
                                <div className="p-3 space-y-2.5">
                                  {/* Header: badge ID + nombre completo */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
                                      style={{
                                        backgroundColor: isInicial ? "#EAF3DE" : isAdicional ? "#E6F1FB" : "#F3F4F6",
                                        color: isInicial ? "#27500A" : isAdicional ? "#0C447C" : "#6B7280",
                                      }}
                                    >
                                      {enfoque.id}
                                    </span>
                                    <span className="text-sm font-semibold text-gray-800">{detalle?.nombreCompleto}</span>
                                  </div>
                                  {/* Qué mide */}
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Qué mide</p>
                                    <p className="text-xs text-gray-600 leading-relaxed">{detalle?.queMide}</p>
                                  </div>
                                  {/* Requiere */}
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Requiere</p>
                                    <p className="text-xs text-gray-600 leading-relaxed">{detalle?.requiere}</p>
                                  </div>
                                  {/* Estado */}
                                  <div className="pt-1.5 border-t border-gray-100">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Estado</p>
                                    {isInicial ? (
                                      <span
                                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                        style={{ backgroundColor: "#EAF3DE", color: "#27500A" }}
                                      >
                                        <Check className="w-3 h-3" />
                                        Generado en propuesta {propNum}
                                      </span>
                                    ) : isAdicional ? (
                                      <span
                                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                        style={{ backgroundColor: "#E6F1FB", color: "#0C447C" }}
                                      >
                                        <Check className="w-3 h-3" />
                                        Generado en propuesta {propNum}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-500">
                                        Disponible
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                      </TooltipProvider>
                    </div>
                  </div>

                  {/* Main content — proposals grid (full width) */}
                  <div className="space-y-6">
                      <TooltipProvider>
                        {/* Propuestas iniciales */}
                        {propuestasIniciales.length > 0 && (
                          <>
                            {!(enfoqueFromUrl && enfoqueFromUrl !== 'null') && (
                              <div className="flex items-center gap-3 mb-4">
                                <p className="text-xs font-semibold uppercase tracking-widest text-inegi-gray-medium">
                                  Propuestas iniciales
                                </p>
                                <div className="flex-1 h-px bg-inegi-blue-medium/15" />
                              </div>
                            )}
                            <div className={enfoqueFromUrl && enfoqueFromUrl !== 'null'
                              ? "flex justify-center"
                              : "grid gap-4 md:grid-cols-2"
                            }>
                              {propuestasIniciales.map((propuesta, index) => (
                                <div key={propuesta.id} className={enfoqueFromUrl && enfoqueFromUrl !== 'null' ? "w-full" : ""}>
                                  {renderCard(propuesta, index, true)}
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        {/* Propuestas adicionales */}
                        {propuestasAdicionalesArr.length > 0 && (
                          <>
                            <div className="flex items-center gap-3 mt-8 mb-4">
                              <p className="text-xs font-semibold uppercase tracking-widest text-inegi-gray-medium">
                                Propuestas adicionales
                              </p>
                              <div className="flex-1 h-px bg-inegi-blue-medium/15" />
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              {propuestasAdicionalesArr.map((propuesta, index) => renderCard(propuesta, index + numPropuestasIniciales, false))}
                            </div>
                          </>
                        )}
                      </TooltipProvider>

                      {/* Botones de acción */}
                      <div className="space-y-4">
                        {(() => {
                          const hayMasEnfoques = enfoquesPermitidos.length > propuestasAcumuladas.length;
                          const enfoquesYaUsados = new Set(propuestasAcumuladas.map(p => p.enfoque_id).filter(Boolean));
                          const enfoquesPendientes = enfoquesPermitidos.filter(e => !enfoquesYaUsados.has(e));

                          if (mostrandoTodas || !hayMasEnfoques) {
                            if (propuestasAcumuladas.length > 0) {
                              return (
                                <div className="p-4 bg-inegi-blue-light border border-inegi-blue-medium/30 rounded-lg text-center">
                                  <p className="text-sm text-inegi-blue-dark">
                                    ✅ {propuestasAcumuladas.length} {propuestasAcumuladas.length === 1 ? 'propuesta generada' : 'propuestas generadas'}. Selecciona del 1 al {propuestasAcumuladas.length}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }

                          return (
                            <div className="space-y-3">
                              <div className="flex items-center gap-3 mt-8">
                                <p className="text-xs font-semibold uppercase tracking-widest text-inegi-gray-medium">
                                  Propuestas adicionales disponibles
                                </p>
                                <div className="flex-1 h-px bg-inegi-blue-medium/15" />
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                {enfoquesPendientes.map((enfoqueId, idx) => {
                                  const info = CATALOGO_ENFOQUES.find(e => e.id === enfoqueId);
                                  const detalle = CATALOGO_ENFOQUES_DETALLE[enfoqueId];
                                  const numPropuesta = propuestasAcumuladas.length + idx + 1;

                                  return (
                                    <div
                                      key={enfoqueId}
                                      className="rounded-xl border border-dashed border-inegi-blue-medium/40 bg-inegi-blue-light/50 p-4 flex flex-col gap-3"
                                    >
                                      <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-full border-2 border-dashed border-inegi-blue-medium/40 text-inegi-blue-medium/70 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                          {numPropuesta}
                                        </div>
                                        <div>
                                          <p className="font-semibold text-sm text-inegi-blue-dark leading-tight">
                                            {detalle?.nombreCompleto ?? info?.nombre ?? enfoqueId}
                                          </p>
                                          <p className="text-xs text-inegi-gray-medium mt-0.5">
                                            {info?.descripcion}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex gap-2">
                                        <Badge
                                          variant="outline"
                                          className="bg-[#E6F1FB] text-[#0C447C] border-[#C5DCEF] font-bold text-xs"
                                        >
                                          {enfoqueId}
                                        </Badge>
                                      </div>

                                      {detalle?.queMide && (
                                        <p className="text-xs text-inegi-gray-medium leading-relaxed line-clamp-2">
                                          {detalle.queMide}
                                        </p>
                                      )}

                                      <div className="flex items-center gap-1.5 text-[11px] text-inegi-blue-medium/70 mt-auto pt-1 border-t border-inegi-blue-medium/10">
                                        <RefreshCw className="w-3 h-3 flex-shrink-0" />
                                        <span>
                                          Se generará al hacer clic en "Generar{' '}
                                          {enfoquesPendientes.length === 1
                                            ? '1 propuesta adicional'
                                            : `${enfoquesPendientes.length} propuestas adicionales`}"
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <Button
                                onClick={handleMasOpciones}
                                disabled={loading || loadingPropuestaId !== null || loadingMasOpciones}
                                variant="outline"
                                className="w-full border-inegi-blue-medium text-inegi-blue-medium hover:bg-inegi-blue-light hover:text-inegi-blue-dark"
                                size="lg"
                              >
                                {loadingMasOpciones ? (
                                  <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Generando {enfoquesPendientes.length} propuesta{enfoquesPendientes.length !== 1 ? 's' : ''} adicional{enfoquesPendientes.length !== 1 ? 'es' : ''}...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="w-5 h-5 mr-2" />
                                    Generar {enfoquesPendientes.length} propuesta{enfoquesPendientes.length !== 1 ? 's' : ''} adicional{enfoquesPendientes.length !== 1 ? 'es' : ''}
                                  </>
                                )}
                              </Button>
                            </div>
                          );
                        })()}

                        {/* Propuesta Personalizada - Oculto temporalmente
                        <Card className="border-inegi-green/30 bg-gradient-to-r from-inegi-green/5 to-inegi-blue-light">
                          <CardContent className="pt-4 pb-4">
                            ...
                          </CardContent>
                        </Card>
                        */}
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        )}

        {/* Modal de Ficha Metodológica */}
        <Dialog open={isModalOpen} onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setIsModalExpanded(false);
        }}>
          <DialogContent className={`${isModalExpanded ? 'max-w-[95vw] max-h-[95vh]' : 'max-w-4xl max-h-[90vh]'} p-0 overflow-hidden transition-all duration-300`}>
            <DialogHeader className="bg-inegi-blue-dark text-white p-6">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-3 text-2xl">
                  <FileText className="w-8 h-8" />
                  Ficha Metodológica del Indicador
                </DialogTitle>
                <button
                  onClick={() => setIsModalExpanded(!isModalExpanded)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title={isModalExpanded ? "Reducir" : "Expandir"}
                >
                  {isModalExpanded ? (
                    <Minimize2 className="w-5 h-5" />
                  ) : (
                    <Maximize2 className="w-5 h-5" />
                  )}
                </button>
              </div>
            </DialogHeader>
            <ScrollArea className={`${isModalExpanded ? 'h-[calc(95vh-8rem)]' : 'h-[calc(90vh-8rem)]'} p-6`}>
              {fichaMetodologica && (
                <div className="space-y-6" id="contenido-ficha" ref={fichaModalRef}>
                  {/* Header de la ficha */}

                  {/* Nombre y sigla del indicador */}
                  {fichaMetodologica.indicador && (
                    <div className="border-l-4 border-inegi-blue-dark bg-inegi-blue-light px-4 py-3 rounded-r-lg">
                      <p className="text-xs font-semibold text-inegi-blue-medium uppercase tracking-widest mb-1">
                        {fichaMetodologica.indicador.siglas}
                      </p>
                      <p className="text-lg font-semibold text-inegi-blue-dark leading-snug">
                        {fichaMetodologica.indicador.nombre}
                      </p>
                    </div>
                  )}
                  <Card className="border-inegi-blue-medium/20">
                    <CardHeader className="bg-inegi-blue-light">
                      <CardTitle className="text-inegi-blue-dark">Objetivo del Indicador</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <p className="text-inegi-gray-dark">{fichaMetodologica.ficha.objetivo}</p>
                    </CardContent>
                  </Card>

                  <Card className="border-inegi-blue-medium/20">
                    <CardHeader className="bg-inegi-blue-light">
                      <CardTitle className="text-inegi-blue-dark">Importancia y/o Utilidad del Indicador</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <p className="text-inegi-gray-dark">{fichaMetodologica.ficha.importancia}</p>
                    </CardContent>
                  </Card>

                  {/* Definición de las Variables */}
                  <Card className="border-inegi-blue-medium/20">
                    <CardHeader className="bg-inegi-blue-light">
                      <CardTitle className="text-inegi-blue-dark">Definición de las Variables</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">
                      {fichaMetodologica.ficha.definicion_variables && Object.entries(fichaMetodologica.ficha.definicion_variables).map(([variable, definicion]) => (
                        <div key={variable}>
                          <p className="font-semibold text-sm mb-1 text-inegi-blue-dark">{variable}</p>
                          <p className="text-inegi-gray-medium text-sm">{definicion}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Fórmula */}
                  <Card className="bg-inegi-gray-light border-inegi-blue-medium/20">
                    <CardHeader>
                      <CardTitle className="text-inegi-blue-dark">Fórmula de Cálculo</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {(() => {
                        const formula = fichaMetodologica.ficha.formula;
                        const detalle = fichaMetodologica.ficha.formula_detalle || {};

                        // ── PATRÓN 1: Fracción simple (A / B) × 100
                        const matchFraccion = formula.match(
                          /^\((.+?)\s*\/\s*(.+?)\)\s*[×x\*]\s*100$/i
                        );

                        // ── PATRÓN 2: Variación porcentual ((A - B) / B) × 100
                        const matchVariacion = formula.match(
                          /\(\((.+?)\s*[-−]\s*(.+?)\)\s*\/\s*(.+?)\)\s*[×x\*]\s*100/i
                        );

                        // ── PATRÓN 3: Tasa acumulada CAGR con potencia ^
                        const matchCagr = formula.match(
                          /\^\s*\(?\s*1\s*\/\s*(.+?)\s*\)?/i
                        );

                        if (matchFraccion) {
                          const [, numerador, denominador] = matchFraccion;
                          return (
                            <div className="flex flex-col items-center py-6 gap-2">
                              <div className="flex items-center gap-4 text-inegi-blue-dark font-medium">
                                <div className="flex flex-col items-center">
                                  <span className="font-mono text-sm px-6 pb-2 border-b-2 border-inegi-blue-dark text-center">
                                    {numerador.trim()}
                                  </span>
                                  <span className="font-mono text-sm px-6 pt-2 text-center">
                                    {denominador.trim()}
                                  </span>
                                </div>
                                <span className="text-xl font-bold">× 100</span>
                              </div>
                            </div>
                          );
                        }

                        if (matchVariacion) {
                          const [, aN, aN1, base] = matchVariacion;
                          return (
                            <div className="flex flex-col items-center py-6 gap-2">
                              <div className="flex items-center gap-4 text-inegi-blue-dark font-medium">
                                <div className="flex flex-col items-center">
                                  <span className="font-mono text-sm px-6 pb-2 border-b-2 border-inegi-blue-dark text-center">
                                    {aN.trim()} − {aN1.trim()}
                                  </span>
                                  <span className="font-mono text-sm px-6 pt-2 text-center">
                                    {base.trim()}
                                  </span>
                                </div>
                                <span className="text-xl font-bold">× 100</span>
                              </div>
                            </div>
                          );
                        }

                        if (matchCagr) {
                          const matchBase = formula.match(/\(\s*(.+?)\s*\/\s*(.+?)\s*\)\s*\^/i);
                          const [, reciente, antiguo] = matchBase || [null, "Valor reciente", "Valor antiguo"];
                          return (
                            <div className="flex flex-col items-center py-6 gap-2">
                              <div className="flex items-center gap-3 text-inegi-blue-dark font-medium flex-wrap justify-center">
                                <span className="text-2xl">[</span>
                                <div className="flex flex-col items-center">
                                  <span className="font-mono text-sm px-4 pb-2 border-b-2 border-inegi-blue-dark text-center">
                                    {reciente?.trim()}
                                  </span>
                                  <span className="font-mono text-sm px-4 pt-2 text-center">
                                    {antiguo?.trim()}
                                  </span>
                                </div>
                                <div className="flex flex-col justify-start">
                                  <span className="font-mono text-xs text-inegi-blue-medium leading-none mb-1">
                                    1 / n períodos
                                  </span>
                                  <span className="text-xl">]</span>
                                </div>
                                <span className="text-xl font-bold">− 1) × 100</span>
                              </div>
                            </div>
                          );
                        }

                        // ── PATRÓN 4: Fracción con × Unicode explícito (A / B) × 100
                        const matchFraccionUnicode = formula.match(
                          /\((.+?)\s*\/\s*(.+?)\)\s*×\s*100/i
                        );

                        if (matchFraccionUnicode && !matchFraccion && !matchVariacion && !matchCagr) {
                          const [, numerador, denominador] = matchFraccionUnicode;
                          return (
                            <div className="flex flex-col items-center py-6 gap-2">
                              <div className="flex items-center gap-4 text-inegi-blue-dark font-medium">
                                <div className="flex flex-col items-center">
                                  <span className="font-mono text-sm px-6 pb-2 border-b-2 border-inegi-blue-dark text-center">
                                    {numerador.trim()}
                                  </span>
                                  <span className="font-mono text-sm px-6 pt-2 text-center">
                                    {denominador.trim()}
                                  </span>
                                </div>
                                <span className="text-xl font-bold">× 100</span>
                              </div>
                            </div>
                          );
                        }

                        // ── FALLBACK: texto plano
                        return (
                          <code className="block p-4 bg-white rounded-lg text-sm font-mono border border-inegi-blue-medium/20 leading-relaxed">
                            {formula}
                          </code>
                        );
                      })()}

                      {fichaMetodologica.ficha.formula_detalle && Object.keys(fichaMetodologica.ficha.formula_detalle).length > 0 && (
                        <div className="space-y-2 pt-2">
                          <p className="text-sm font-semibold text-inegi-blue-dark">Donde:</p>
                          {Object.entries(fichaMetodologica.ficha.formula_detalle).map(([sigla, descripcion]) => (
                            <div key={sigla} className="text-sm text-inegi-gray-medium pl-2">
                              <span className="font-mono font-semibold text-inegi-blue-medium">
                                {sigla}
                              </span>
                              {" = "}{descripcion as string}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Tabla de datos */}
                  {fichaMetodologica.visualizacion?.tabla && (
                    <Card className="border-inegi-blue-medium/20">
                      <CardHeader className="bg-inegi-blue-light">
                        <CardTitle className="text-inegi-blue-dark">Tabla de Datos</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4 overflow-x-auto">
                        {(() => {
                          const tb = fichaMetodologica.visualizacion!.tabla;
                          const esGeo = tb.tipo === "geografico_entidad" || tb.tipo === "geografico_municipal";
                          return (
                            <>
                              <table className="w-full text-sm border-collapse">
                                <thead>
                                  <tr className="bg-inegi-blue-dark text-white">
                                    {tb.columnas.map((col) => (
                                      <th key={col.key} className={`p-2 font-semibold ${col.tipo === "texto" ? "text-left" : "text-right"}`}>
                                        {col.label}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {tb.filas.map((fila, idx) => (
                                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-inegi-blue-light/30"}>
                                      {tb.columnas.map((col, colIdx) => {
                                        const val = fila[col.key];
                                        const isNull = val === null || val === undefined;

                                        // Geographic: first col = ranking (small gray), second col = bold name
                                        if (esGeo && colIdx === 0) {
                                          return <td key={col.key} className="p-2 text-xs text-inegi-gray-medium">{isNull ? "—" : val}</td>;
                                        }
                                        if (esGeo && colIdx === 1) {
                                          return <td key={col.key} className="p-2 font-semibold text-inegi-gray-dark">{isNull ? "—" : val}</td>;
                                        }

                                        if (isNull) {
                                          return <td key={col.key} className={`p-2 ${col.tipo === "texto" ? "text-left" : "text-right"}`}>—</td>;
                                        }

                                        if (col.tipo === "porcentaje") {
                                          const numVal = Number(val);
                                          return (
                                            <td key={col.key} className={`p-2 text-right font-medium ${numVal < 0 ? "text-red-600" : "text-inegi-blue-dark"}`}>
                                              {numVal.toFixed(2)}%
                                            </td>
                                          );
                                        }
                                        if (col.tipo === "numero") {
                                          return <td key={col.key} className="p-2 text-right text-inegi-gray-dark">{Number(val).toLocaleString('es-MX')}</td>;
                                        }
                                        if (col.tipo === "entero") {
                                          return <td key={col.key} className="p-2 text-right text-inegi-gray-dark">{val}</td>;
                                        }
                                        return <td key={col.key} className="p-2 text-left text-inegi-gray-dark">{val}</td>;
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {tb.notas?.map((nota, i) => (
                                <p key={i} className="text-xs text-inegi-gray-medium italic mt-2">{nota}</p>
                              ))}
                            </>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}

                  {/* Gráfico */}
                  {fichaMetodologica.visualizacion?.grafico && (() => {
                    const grafico = fichaMetodologica.visualizacion!.grafico;
                    const yDomain: [number | string, number | string] = [
                      grafico.eje_y.min ?? 'auto',
                      grafico.eje_y.max ?? 'auto'
                    ];

                    if (grafico.tipo === "pie") {
                      const pieData = grafico.series.map(s => ({
                        name: s.nombre,
                        value: s.datos[0]?.y ?? 0,
                        fill: s.color,
                      }));
                      return (
                        <Card className="border-inegi-blue-medium/20">
                          <CardHeader className="bg-inegi-blue-light">
                            <CardTitle className="text-inegi-blue-dark">Gráfico</CardTitle>
                            <p className="text-sm text-inegi-gray-medium">{grafico.titulo}</p>
                            {grafico.subtitulo && <p className="text-xs text-inegi-gray-medium">{grafico.subtitulo}</p>}
                          </CardHeader>
                          <CardContent className="pt-4">
                            <ResponsiveContainer width="100%" height={350}>
                              <PieChart>
                                <Pie
                                  data={pieData}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={120}
                                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                                >
                                  {pieData.map((entry, index) => (
                                    <Cell key={index} fill={entry.fill} />
                                  ))}
                                </Pie>
                                <RechartsTooltip />
                                {grafico.leyenda.visible && <Legend />}
                              </PieChart>
                            </ResponsiveContainer>
                            {grafico.notas?.map((nota, i) => (
                              <p key={i} className="text-xs text-inegi-gray-medium italic mt-2">{nota}</p>
                            ))}
                          </CardContent>
                        </Card>
                      );
                    }

                    const chartData = grafico.series[0].datos.map((d, i) => ({
                      x: d.x,
                      ...grafico.series.reduce((acc, s) => ({
                        ...acc,
                        [s.nombre]: s.datos[i]?.y ?? null
                      }), {} as Record<string, number | null>)
                    }));

                    const chartHeight = grafico.tipo === "barras_horizontales"
                      ? Math.max(400, chartData.length * 22)
                      : 300;

                    return (
                      <Card className="border-inegi-blue-medium/20">
                        <CardHeader className="bg-inegi-blue-light">
                          <CardTitle className="text-inegi-blue-dark">Gráfico</CardTitle>
                          <p className="text-sm text-inegi-gray-medium">{grafico.titulo}</p>
                          {grafico.subtitulo && <p className="text-xs text-inegi-gray-medium">{grafico.subtitulo}</p>}
                        </CardHeader>
                        <CardContent className="pt-4">
                          <ResponsiveContainer width="100%" height={chartHeight}>
                            {grafico.tipo === "lineas" ? (
                              <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="x" />
                                <YAxis domain={yDomain} />
                                <RechartsTooltip />
                                {grafico.leyenda.visible && <Legend />}
                                {grafico.series.map((serie) => (
                                  <Line key={serie.nombre} type="monotone" dataKey={serie.nombre} stroke={serie.color} strokeWidth={2} dot={{ r: 4 }} connectNulls />
                                ))}
                              </LineChart>
                            ) : grafico.tipo === "barras_horizontales" ? (
                              <BarChart data={chartData} layout="vertical" margin={{ left: 165, right: 30, top: 5, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" domain={[0, 100]} unit="%" />
                                <YAxis type="category" dataKey="x" width={160} tick={{ fontSize: 11 }} />
                                <RechartsTooltip />
                                {grafico.leyenda.visible && <Legend />}
                                <Bar dataKey={grafico.series[0].nombre} fill={grafico.series[0].color} radius={[0, 3, 3, 0]} />
                              </BarChart>
                            ) : grafico.tipo === "barras_apiladas_100" ? (
                              <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="x" />
                                <YAxis domain={yDomain} />
                                <RechartsTooltip />
                                {grafico.leyenda.visible && <Legend />}
                                {grafico.series.map((serie) => (
                                  <Bar key={serie.nombre} dataKey={serie.nombre} fill={serie.color} stackId="a" />
                                ))}
                              </BarChart>
                            ) : grafico.tipo === "barras_agrupadas" ? (
                              <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="x" />
                                <YAxis domain={yDomain} />
                                <RechartsTooltip />
                                {grafico.leyenda.visible && <Legend />}
                                {grafico.series.map((serie) => (
                                  <Bar key={serie.nombre} dataKey={serie.nombre} fill={serie.color} />
                                ))}
                              </BarChart>
                            ) : (
                              <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="x" />
                                <YAxis domain={yDomain} />
                                <RechartsTooltip />
                                {grafico.leyenda.visible && <Legend />}
                                {grafico.series.map((serie) => (
                                  <Bar key={serie.nombre} dataKey={serie.nombre} fill={serie.color} />
                                ))}
                              </BarChart>
                            )}
                          </ResponsiveContainer>
                          {grafico.notas?.map((nota, i) => (
                            <p key={i} className="text-xs text-inegi-gray-medium italic mt-2">{nota}</p>
                          ))}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Características técnicas */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card className="border-inegi-blue-medium/20">
                      <CardHeader className="bg-inegi-blue-light">
                        <CardTitle className="text-base text-inegi-blue-dark">Unidad de Medida</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <p className="text-sm font-semibold text-inegi-gray-dark">{fichaMetodologica.ficha.unidad}</p>
                      </CardContent>
                    </Card>

                    <Card className="border-inegi-blue-medium/20">
                      <CardHeader className="bg-inegi-blue-light">
                        <CardTitle className="text-base text-inegi-blue-dark">Cobertura Geográfica</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <p className="text-sm font-semibold text-inegi-gray-dark">{fichaMetodologica.ficha.cobertura}</p>
                      </CardContent>
                    </Card>

                    <Card className="border-inegi-blue-medium/20">
                      <CardHeader className="bg-inegi-blue-light">
                        <CardTitle className="text-base text-inegi-blue-dark">Desagregación</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <p className="text-sm font-semibold text-inegi-gray-dark">{fichaMetodologica.ficha.desagregacion}</p>
                      </CardContent>
                    </Card>

                    <Card className="border-inegi-blue-medium/20">
                      <CardHeader className="bg-inegi-blue-light">
                        <CardTitle className="text-base text-inegi-blue-dark">Frecuencia de Actualización del Indicador</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <p className="text-sm font-semibold text-inegi-gray-dark">{fichaMetodologica.ficha.frecuencia}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Temporal y Fuente */}
                  <Card className="border-inegi-blue-medium/20">
                    <CardHeader className="bg-inegi-blue-light">
                      <CardTitle className="text-inegi-blue-dark">Información Temporal y Fuente de Datos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">
                      <div>
                        <p className="text-sm text-inegi-gray-medium">Cobertura Temporal del Indicador:</p>
                        <p className="font-semibold text-inegi-gray-dark">{fichaMetodologica.ficha.temporal}</p>
                      </div>
                      {fichaMetodologica.ficha.periodicidad && (
                        <div>
                          <p className="text-sm text-inegi-gray-medium">Periodicidad:</p>
                          <p className="font-semibold text-inegi-gray-dark">{fichaMetodologica.ficha.periodicidad}</p>
                        </div>
                      )}
                      {fichaMetodologica.ficha.temporal_fuente && (
                        <div>
                          <p className="text-sm text-inegi-gray-medium">Cobertura Temporal de la Fuente de Datos:</p>
                          <p className="font-semibold text-inegi-gray-dark">{fichaMetodologica.ficha.temporal_fuente}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-inegi-gray-medium">Fuente de Datos:</p>
                        <p className="font-semibold text-inegi-gray-dark">
                          {fichaMetodologica.ficha.fuente.nombre} - {fichaMetodologica.ficha.fuente.institucion}
                        </p>
                        <p className="text-sm text-inegi-gray-medium mt-1">
                          Programa: {fichaMetodologica.ficha.fuente.programa}
                        </p>
                        {fichaMetodologica.ficha.fuente.url && (
                          <a 
                            href={fichaMetodologica.ficha.fuente.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-inegi-blue-medium hover:underline mt-1 inline-block"
                          >
                            Ver fuente →
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Limitaciones */}
                  {fichaMetodologica.ficha.limitaciones && fichaMetodologica.ficha.limitaciones.length > 0 && (
                    <Card className="border-inegi-gold/50 bg-amber-50">
                      <CardHeader>
                        <CardTitle className="text-inegi-blue-dark">Limitaciones</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {fichaMetodologica.ficha.limitaciones.map((limitacion, idx) => (
                            <li key={idx} className="text-sm text-inegi-gray-medium flex gap-2">
                              <span className="text-inegi-gold">•</span>
                              <span>{limitacion}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Alineación ODS, MDEA y PND */}
                  <Card className="border-inegi-blue-medium/30 bg-inegi-blue-light/50">
                    <CardHeader>
                      <CardTitle className="text-inegi-blue-dark">Alineación con Marcos Internacionales</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">

                      {/* ODS — siempre visible */}
                      <div>
                        <p className="text-sm text-inegi-gray-medium mb-2 font-semibold">
                          Objetivos de Desarrollo Sostenible (ODS)
                        </p>
                        {fichaMetodologica.ficha.alineacion.ods && fichaMetodologica.ficha.alineacion.ods.length > 0 ? (
                          <div className="pl-2 space-y-3">
                            {fichaMetodologica.ficha.alineacion.ods.map((ods, idx) => (
                              <div key={idx} className={`pl-2 space-y-1 ${idx > 0 ? "pt-3 border-t border-inegi-blue-medium/10" : ""}`}>
                                <p className="text-sm text-inegi-gray-dark">
                                  <span className="font-medium text-inegi-blue-dark">Objetivo:</span> {ods.objetivo}
                                </p>
                                <p className="text-sm text-inegi-gray-dark">
                                  <span className="font-medium text-inegi-blue-dark">Meta:</span> {ods.meta}
                                </p>
                                <p className="text-sm text-inegi-gray-dark">
                                  <span className="font-medium text-inegi-blue-dark">Indicador:</span> {ods.indicador}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-inegi-gray-medium pl-2 italic">Sin alineación específica detectada</p>
                        )}
                      </div>

                      {/* MDEA — siempre visible */}
                      <div className="pt-2 border-t border-inegi-blue-medium/20">
                        <p className="text-sm text-inegi-gray-medium mb-2 font-semibold">
                          Marco de Desarrollo Estadístico Ambiental (MDEA)
                        </p>
                        {fichaMetodologica.ficha.alineacion.mdea && fichaMetodologica.ficha.alineacion.mdea.length > 0 ? (
                          <div className="pl-2 space-y-3">
                            {fichaMetodologica.ficha.alineacion.mdea.map((mdea, idx) => (
                              <div key={idx} className={idx > 0 ? "pt-3 border-t border-inegi-blue-medium/10" : ""}>
                                <p className="text-sm text-inegi-gray-dark">
                                  <span className="font-medium text-inegi-blue-dark">Componente:</span> {mdea.componente}
                                </p>
                                <p className="text-sm text-inegi-gray-dark">
                                  <span className="font-medium text-inegi-blue-dark">Subcomponente:</span> {mdea.subcomponente}
                                </p>
                                <p className="text-sm text-inegi-gray-dark">
                                  <span className="font-medium text-inegi-blue-dark">Tópico:</span> {mdea.topico}
                                </p>
                                {mdea.estadistica1 && mdea.estadistica1 !== '-' && (
                                  <p className="text-sm text-inegi-gray-dark">
                                    <span className="font-medium text-inegi-blue-dark">Estadística 1:</span> {mdea.estadistica1}
                                  </p>
                                )}
                                {mdea.estadistica2 && mdea.estadistica2 !== '-' && (
                                  <p className="text-sm text-inegi-gray-dark">
                                    <span className="font-medium text-inegi-blue-dark">Estadística 2:</span> {mdea.estadistica2}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-inegi-gray-medium pl-2 italic">Sin alineación específica detectada</p>
                        )}
                      </div>

                      {/* PND — siempre visible */}
                      <div className="pt-2 border-t border-inegi-blue-medium/20">
                          <p className="text-sm text-inegi-gray-medium mb-2 font-semibold">
                            Plan Nacional de Desarrollo (PND)
                          </p>
                          {fichaMetodologica.ficha.alineacion.pnd && fichaMetodologica.ficha.alineacion.pnd.length > 0 ? (
                            <div className="pl-2 space-y-3">
                              {fichaMetodologica.ficha.alineacion.pnd.map((pnd, idx) => (
                                <div key={idx} className={`pl-2 space-y-1 ${idx > 0 ? "pt-3 border-t border-inegi-blue-medium/10" : ""}`}>
                                  <p className="text-sm text-inegi-gray-dark">
                                    <span className="font-medium text-inegi-blue-dark">Eje:</span> {pnd.eje}
                                  </p>
                                  <p className="text-sm text-inegi-gray-dark">
                                    <span className="font-medium text-inegi-blue-dark">Objetivo:</span> {pnd.objetivo}
                                  </p>
                                  <p className="text-sm text-inegi-gray-dark">
                                    <span className="font-medium text-inegi-blue-dark">Estrategia:</span> {pnd.estrategia}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-inegi-gray-medium pl-2 italic">Sin alineación específica detectada</p>
                          )}
                        </div>

                    </CardContent>
                  </Card>

                  {/* Botones de acción */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button
                      className="flex-1 bg-inegi-green hover:bg-[#5A8E31] text-white"
                      size="lg"
                      onClick={async () => {
                        const contenido = fichaModalRef.current;
                        if (!contenido || !fichaMetodologica) return;
                        let wrapper: HTMLDivElement | null = null;
                        try {
                          // Load html2pdf.js from CDN if not already loaded
                          if (!(window as any).html2pdf) {
                            await new Promise<void>((resolve, reject) => {
                              const script = document.createElement('script');
                              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                              script.onload = () => resolve();
                              script.onerror = () => reject(new Error('Failed to load html2pdf.js'));
                              document.head.appendChild(script);
                            });
                          }
                          const html2pdf = (window as any).html2pdf;
                          wrapper = document.createElement('div');
                          wrapper.setAttribute('aria-hidden', 'true');
                          wrapper.style.cssText = 'position:absolute;left:0;top:0;width:210mm;padding:0;background:#fff;z-index:-1;opacity:1;display:block;visibility:visible;overflow:visible;pointer-events:none;';
                          const clone = contenido.cloneNode(true) as HTMLElement;
                          const buttons = clone.querySelectorAll('button');
                          buttons.forEach(btn => btn.remove());
                          clone.style.cssText = 'display:block;visibility:visible;opacity:1;overflow:visible;max-height:none;height:auto;transform:none;background:#fff;';
                          wrapper.appendChild(clone);
                          document.body.appendChild(wrapper);

                          await html2pdf().set({
                            margin: [5, 10, 10, 10],
                            filename: `Ficha_${fichaMetodologica.indicador.nombre ?? 'indicador'}.pdf`,
                            image: { type: 'jpeg', quality: 0.98 },
                            html2canvas: {
                              scale: 2,
                              useCORS: true,
                              scrollX: 0,
                              scrollY: 0,
                              backgroundColor: '#ffffff'
                            },
                            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                            pagebreak: { mode: ['css', 'legacy'] }
                          }).from(clone).save();

                          toast({ title: "PDF generado", description: "El archivo se descargó correctamente." });
                        } catch (error) {
                          toast({ title: "Error", description: "No se pudo generar el PDF.", variant: "destructive" });
                        } finally {
                          wrapper?.remove();
                        }
                      }}
                    >
                      <Download className="w-5 h-5 mr-2" />
                      Descargar PDF
                    </Button>
                    <Button
                      className="flex-1 bg-inegi-blue-medium hover:bg-inegi-blue-dark text-white"
                      size="lg"
                      onClick={() => handleDownloadFichaWord()}
                    >
                      <FileDown className="w-5 h-5 mr-2" />
                      Descargar Word
                    </Button>
                    <Button
                      onClick={() => setIsModalOpen(false)}
                      variant="outline"
                      size="lg"
                      className="flex-1 border-inegi-blue-medium text-inegi-blue-medium hover:bg-inegi-blue-light"
                    >
                      Cerrar
                    </Button>
                  </div>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </main>

      {/* Footer INEGI */}
      <footer className="mt-16 py-8 border-t bg-inegi-blue-dark text-white">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm font-semibold">
            Instituto Nacional de Estadística y Geografía (INEGI)
          </p>
          <p className="text-xs text-white/80 mt-1">
            Generador de Propuestas de Indicadores Ambientales
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
