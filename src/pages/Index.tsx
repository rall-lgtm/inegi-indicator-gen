import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, AlertCircle, CheckCircle, Download, RefreshCw, Loader2, TrendingUp, FileText, Info, AlertTriangle, Maximize2, Minimize2, FileDown, Sparkles, PenLine, Check } from "lucide-react";
import { ResponsiveContainer, LineChart, BarChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from "recharts";
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
  viabilidad?: {
    nivel: "Alta" | "Media" | "Baja";
    fuentes: {
      microdatos: boolean;
      tabulados: boolean;
      datosAbiertos: boolean;
    };
    nota?: string;
  };
};

const CATALOGO_ENFOQUES = [
  { id: "E1", nombre: "Proporción", descripcion: "% con el evento" },
  { id: "E2", nombre: "Evolución temporal", descripcion: "Cambio entre períodos" },
  { id: "E3", nombre: "Comp. geográfico", descripcion: "Diferencias por región" },
  { id: "E4", nombre: "Comp. por categoría", descripcion: "Entre categorías" },
  { id: "E5", nombre: "Brecha socioecon.", descripcion: "Por ingreso o decil" },
  { id: "E6", nombre: "Brecha sexo/edad", descripcion: "Hombre vs mujer" },
  { id: "E7", nombre: "Intensidad", descripcion: "Promedio per cápita" },
  { id: "E8", nombre: "Composición", descripcion: "Estructura porcentual" },
  { id: "E9", nombre: "Concentración", descripcion: "En subgrupo" },
  { id: "E10", nombre: "Tasa acumulada", descripcion: "Cambio total" },
];

type PropuestasIniciales = {
  tipo: "propuestas_iniciales";
  advertencia_ambiental?: AdvertenciaAmbiental;
  variable: {
    idVar: string;
    nombre: string;
    definicion: string;
    tema: string;
    subtema: string;
    totalAnios: number;
    años: number[];
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
      pnd?: {
        eje: string;
        objetivo: string;
        estrategia: string;
      };
    };
  };
  visualizacion?: {
    tabla_datos: {
      años: number[];
      series: Array<{
        nombre: string;
        color: string;
        columnas: {
          numerador:   { label: string; datos: Array<{ año: number; valor: number }> };
          denominador: { label: string; datos: Array<{ año: number; valor: number }> };
          resultado:   { label: string; datos: Array<{ año: number; valor: number }> };
        };
      }>;
      notas?: string[];
    };
    grafico: {
      tipo: "lineas" | "barras" | "lineas_multiples";
      titulo: string;
      subtitulo?: string;
      eje_x: { label: string; valores: number[] };
      eje_y: { label: string; min: number; max: number };
      series: Array<{ nombre: string; color: string; datos: Array<{ año: number; valor: number }> }>;
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
  
  const [idVar, setIdVar] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [fichaMetodologica, setFichaMetodologica] = useState<FichaMetodologica | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalExpanded, setIsModalExpanded] = useState(false);
  const [sessionId] = useState(`session-${Date.now()}`);
  const [propuestasAcumuladas, setPropuestasAcumuladas] = useState<PropuestaIndicador[]>([]);
  const [mostrandoTodas, setMostrandoTodas] = useState(false);
  const [nombrePersonalizado, setNombrePersonalizado] = useState("");
  const [mostrarInputPersonalizado, setMostrarInputPersonalizado] = useState(false);
  const [errorValidacion, setErrorValidacion] = useState<ErrorValidacion | null>(null);
  const [loadingPropuestaId, setLoadingPropuestaId] = useState<number | null>(null);
  const [loadingMasOpciones, setLoadingMasOpciones] = useState(false);
  const [variableInfo, setVariableInfo] = useState<PropuestasIniciales["variable"] | null>(null);
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
            const body = {
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
              setVariableInfo(data.variable);
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
        setVariableInfo(data.variable);
      }
      
      // Si son propuestas adicionales, acumular y marcar como todas mostradas
      if (data.tipo === 'propuestas_adicionales') {
        setPropuestasAcumuladas(prev => [...prev, ...(data.propuestas || [])]);
        setMostrandoTodas(true);
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
      await enviarConsulta("mas_opciones");
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

  const handleSeleccionar = async (propuesta: PropuestaIndicador) => {
    setLoadingPropuestaId(propuesta.id);
    try {
      const body = {
        idVar: idVar.toUpperCase(),
        sessionId,
        accion: "seleccionar",
        propuestaId: propuesta.id,
        nombrePropuesta: propuesta.nombre,
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
        // Extraer el JSON del markdown code block
        const jsonMatch = data.output.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          fichaData = JSON.parse(jsonMatch[1]);
        }
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
            ...(fichaMetodologica.visualizacion?.tabla_datos ? (() => {
              const td = fichaMetodologica.visualizacion!.tabla_datos;
              const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
              const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
              const cellMargins = { top: 40, bottom: 40, left: 80, right: 80 };
              // Build columns: Año + per series (num, den, res)
              const colCount = 1 + td.series.length * 3;
              const yearColW = 1200;
              const dataColW = Math.floor((9360 - yearColW) / (td.series.length * 3));
              const columnWidths = [yearColW, ...Array(colCount - 1).fill(dataColW)];
              const headerCells = [
                new TableCell({
                  borders: cellBorders, margins: cellMargins,
                  width: { size: yearColW, type: WidthType.DXA },
                  shading: { fill: "003D6B", type: ShadingType.CLEAR },
                  children: [new Paragraph({ children: [new TextRun({ text: "Año", bold: true, color: "FFFFFF", size: 20 })] })],
                }),
                ...td.series.flatMap((serie) => [
                  new TableCell({
                    borders: cellBorders, margins: cellMargins,
                    width: { size: dataColW, type: WidthType.DXA },
                    shading: { fill: "003D6B", type: ShadingType.CLEAR },
                    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: serie.columnas.numerador.label, bold: true, color: "FFFFFF", size: 16 })] })],
                  }),
                  new TableCell({
                    borders: cellBorders, margins: cellMargins,
                    width: { size: dataColW, type: WidthType.DXA },
                    shading: { fill: "003D6B", type: ShadingType.CLEAR },
                    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: serie.columnas.denominador.label, bold: true, color: "FFFFFF", size: 16 })] })],
                  }),
                  new TableCell({
                    borders: cellBorders, margins: cellMargins,
                    width: { size: dataColW, type: WidthType.DXA },
                    shading: { fill: "003D6B", type: ShadingType.CLEAR },
                    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: serie.columnas.resultado.label, bold: true, color: "FFFFFF", size: 18 })] })],
                  }),
                ]),
              ];
              const dataRows = td.años.map((año, idx) => {
                const fill = idx % 2 === 0 ? "FFFFFF" : "E8F0FE";
                return new TableRow({
                  children: [
                    new TableCell({
                      borders: cellBorders, margins: cellMargins,
                      width: { size: yearColW, type: WidthType.DXA },
                      shading: { fill, type: ShadingType.CLEAR },
                      children: [new Paragraph({ children: [new TextRun({ text: String(año), bold: true, size: 20 })] })],
                    }),
                    ...td.series.flatMap((serie) => {
                      const num = serie.columnas.numerador.datos.find(d => d.año === año);
                      const den = serie.columnas.denominador.datos.find(d => d.año === año);
                      const res = serie.columnas.resultado.datos.find(d => d.año === año);
                      return [
                        new TableCell({
                          borders: cellBorders, margins: cellMargins,
                          width: { size: dataColW, type: WidthType.DXA },
                          shading: { fill, type: ShadingType.CLEAR },
                          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: num !== undefined ? num.valor.toLocaleString('es-MX') : "—", size: 20 })] })],
                        }),
                        new TableCell({
                          borders: cellBorders, margins: cellMargins,
                          width: { size: dataColW, type: WidthType.DXA },
                          shading: { fill, type: ShadingType.CLEAR },
                          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: den !== undefined ? den.valor.toLocaleString('es-MX') : "—", size: 20 })] })],
                        }),
                        new TableCell({
                          borders: cellBorders, margins: cellMargins,
                          width: { size: dataColW, type: WidthType.DXA },
                          shading: { fill, type: ShadingType.CLEAR },
                          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: res !== undefined ? res.valor.toFixed(2) : "—", bold: true, size: 20 })] })],
                        }),
                      ];
                    }),
                  ],
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
                ...(td.notas?.map(nota => new Paragraph({
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
                children: [new TextRun({ text: `Tipo de gráfico: ${fichaMetodologica.visualizacion.grafico.tipo === "barras" ? "Barras" : "Líneas"}`, italics: true })],
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
            ...(ficha.alineacion?.pnd ? [
              new Paragraph({
                children: [new TextRun({ text: "Plan Nacional de Desarrollo (PND)", bold: true, size: 22 })],
                spacing: { before: 200, after: 100 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Eje: ", bold: true }),
                  new TextRun({ text: ficha.alineacion.pnd.eje }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Objetivo: ", bold: true }),
                  new TextRun({ text: ficha.alineacion.pnd.objetivo }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Estrategia: ", bold: true }),
                  new TextRun({ text: ficha.alineacion.pnd.estrategia }),
                ],
              }),
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
              <div className="flex items-center gap-3">
                {loading && !response && (
                  <Loader2 className="w-5 h-5 animate-spin text-inegi-blue-medium" />
                )}
                <div>
                  <p className="text-sm text-inegi-gray-medium">Variable en consulta</p>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <p className="text-lg font-semibold text-inegi-blue-medium">{idFromUrl.toUpperCase()}</p>
                    <p className="text-sm text-inegi-gray-dark">{response?.tipo === "error_temporalidad" ? response.variable.nombre : ""}</p>
                  </div>
                  {loading && !response && (
                    <p className="text-sm text-inegi-gray-medium mt-1">Analizando variable y generando propuestas de indicadores...</p>
                  )}
                </div>
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
                  <div className="bg-inegi-blue-light border border-inegi-blue-medium/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">💡</span>
                      <div>
                        <p className="font-medium text-sm mb-1 text-inegi-blue-dark">Sugerencia</p>
                        <p className="text-sm text-inegi-gray-medium">
                          {response.error.sugerencia}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Propuestas */}
            {(response.tipo === "propuestas_iniciales" || response.tipo === "propuestas_adicionales") && (
              <div className="space-y-6 animate-fade-in">
                {/* Info de la variable */}
                {variableInfo && propuestasAcumuladas.length > 0 && (
                  <Card className="shadow-lg border-l-4 border-l-inegi-blue-medium animate-fade-in">
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-inegi-blue-dark">
                          {variableInfo.nombre}
                        </h3>
                        <p className="text-inegi-gray-medium">{variableInfo.definicion}</p>
                        <div className="flex flex-wrap gap-2 mt-4">
                          <Badge className="bg-inegi-blue-dark text-white">{variableInfo.tema}</Badge>
                          <Badge className="bg-inegi-blue-medium text-white">{variableInfo.subtema}</Badge>
                          <Badge className="bg-inegi-green text-white">
                            {variableInfo.totalAnios} años disponibles
                          </Badge>
                          <Badge variant="outline" className="border-inegi-blue-medium text-inegi-blue-dark">
                            {variableInfo.años.join(", ")}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Grid de propuestas */}
                <TooltipProvider>
                  <div className="grid gap-4 md:grid-cols-2">
                    {propuestasAcumuladas.map((propuesta, index) => (
                      <Card
                        key={propuesta.id}
                        className="shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-inegi-blue-medium/10 animate-fade-in"
                        style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-full bg-inegi-blue-medium text-white flex items-center justify-center font-bold">
                                  {propuesta.id}
                                </div>
                                <CardTitle className="text-lg leading-tight text-inegi-blue-dark">
                                  {propuesta.nombre}
                                </CardTitle>
                                {(propuesta.objetivo || propuesta.importancia || propuesta.razon_seleccion) && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="h-4 w-4 text-inegi-blue-medium flex-shrink-0 cursor-pointer" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-md p-4 space-y-3 bg-white border-inegi-blue-medium" side="top">
                                      {propuesta.objetivo && (
                                        <div>
                                          <p className="font-semibold text-sm mb-1 text-inegi-blue-dark">Objetivo:</p>
                                          <p className="text-sm text-inegi-gray-medium">{propuesta.objetivo}</p>
                                        </div>
                                      )}
                                      {propuesta.importancia && (
                                        <div>
                                          <p className="font-semibold text-sm mb-1 text-inegi-blue-dark">Importancia:</p>
                                          <p className="text-sm text-inegi-gray-medium">{propuesta.importancia}</p>
                                        </div>
                                      )}
                                      {propuesta.razon_seleccion && (
                                        <div>
                                          <p className="font-semibold text-sm mb-1 text-inegi-blue-dark">Por qué se seleccionó:</p>
                                          <p className="text-sm text-inegi-gray-medium">{propuesta.razon_seleccion}</p>
                                        </div>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                                  <CardDescription className="mt-2 text-inegi-gray-medium">
                                    {propuesta.descripcion}
                                  </CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {propuesta.viabilidad && (
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                                    <span className="text-xs text-gray-500">Viabilidad</span>
                                    <div className="flex gap-1">
                                      {[1, 2, 3].map(i => (
                                        <div key={i} className={`w-2.5 h-2.5 rounded-full ${
                                          propuesta.viabilidad!.nivel === "Alta" ? "bg-green-600" :
                                          propuesta.viabilidad!.nivel === "Media" && i <= 2 ? "bg-amber-500" :
                                          propuesta.viabilidad!.nivel === "Baja" && i === 1 ? "bg-red-500" : "bg-gray-200"
                                        }`} />
                                      ))}
                                    </div>
                                    <span className={`text-xs font-medium ${
                                      propuesta.viabilidad!.nivel === "Alta" ? "text-green-700" :
                                      propuesta.viabilidad!.nivel === "Media" ? "text-amber-600" : "text-red-600"
                                    }`}>
                                      {propuesta.viabilidad!.nivel}
                                    </span>
                                  </div>
                                  {(propuesta.viabilidad!.nivel === "Media" || propuesta.viabilidad!.nivel === "Baja") && (
                                    <p className={`text-[11px] px-3 py-2 rounded-lg border-l-2 leading-snug ${
                                      propuesta.viabilidad!.nivel === "Media"
                                        ? "bg-amber-50 text-amber-800 border-amber-400"
                                        : "bg-red-50 text-red-800 border-red-400"
                                    }`}>
                                      {propuesta.viabilidad!.nota
                                        ? propuesta.viabilidad!.nota
                                        : propuesta.viabilidad!.nivel === "Media"
                                          ? "Se puede construir con las fuentes disponibles, pero considera las limitaciones antes de continuar."
                                          : "No es posible construirlo con las fuentes actuales disponibles para esta variable."
                                      }
                                    </p>
                                  )}
                                </div>
                              )}
                              <div className="flex gap-2">
                                <Badge className="bg-inegi-blue-dark text-white">{propuesta.enfoque}</Badge>
                                <Badge variant="outline" className="border-inegi-blue-medium text-inegi-blue-medium">{propuesta.tipo}</Badge>
                              </div>
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
                    ))}
                  </div>
                </TooltipProvider>

                {/* Botones de acción */}
                <div className="space-y-4">
                  {/* Ver más opciones */}
                  {!mostrandoTodas ? (
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
                          Generando propuestas adicionales...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-5 h-5 mr-2" />
                          Generar más propuestas
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="p-4 bg-inegi-blue-light border border-inegi-blue-medium/30 rounded-lg text-center">
                      <p className="text-sm text-inegi-blue-dark">✅ 8 propuestas generadas. Selecciona del 1 al 8</p>
                    </div>
                  )}

                  {/* Propuesta Personalizada */}
                  <Card className="border-inegi-green/30 bg-gradient-to-r from-inegi-green/5 to-inegi-blue-light">
                    <CardContent className="pt-4 pb-4">
                      {!mostrarInputPersonalizado ? (
                        <Button
                          onClick={() => setMostrarInputPersonalizado(true)}
                          variant="outline"
                          className="w-full border-inegi-green text-inegi-green hover:bg-inegi-green hover:text-white"
                          size="lg"
                        >
                          <Sparkles className="w-5 h-5 mr-2" />
                          Crear Propuesta Personalizada
                        </Button>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-inegi-green">
                            <PenLine className="w-5 h-5" />
                            <h4 className="font-semibold">Propuesta Personalizada</h4>
                          </div>
                          <p className="text-sm text-inegi-gray-medium">
                            Escribe el nombre del indicador que deseas crear. El sistema generará automáticamente la descripción y ficha metodológica.
                          </p>
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              placeholder="Ej: Tasa de reciclaje de residuos sólidos"
                              value={nombrePersonalizado}
                              onChange={(e) => {
                                setNombrePersonalizado(e.target.value);
                                if (errorValidacion) setErrorValidacion(null);
                              }}
                              disabled={loading}
                              className="flex-1 border-inegi-green/30 focus:border-inegi-green focus:ring-inegi-green"
                            />
                            <Button
                              onClick={handlePersonalizado}
                              disabled={loading || nombrePersonalizado.trim().length < 3}
                              className="bg-inegi-green hover:bg-inegi-green/90 text-white"
                            >
                              {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4 mr-2" />
                                  Generar
                                </>
                              )}
                            </Button>
                          </div>
                          
                          {/* Error de validación */}
                          {errorValidacion && (
                            <Card className="border-red-300 bg-red-50">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-red-700 text-base flex items-center gap-2">
                                  <AlertCircle className="w-5 h-5" />
                                  {errorValidacion.error.codigo.replace(/_/g, ' ')}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3 text-sm">
                                <p className="text-red-700 font-medium">{errorValidacion.error.mensaje}</p>
                                
                                <div className="space-y-1">
                                  <p className="text-inegi-gray-dark"><span className="font-semibold">Nombre recibido:</span> {errorValidacion.error.nombre_recibido}</p>
                                  <p className="text-inegi-gray-medium">{errorValidacion.error.razon}</p>
                                </div>
                                
                                {errorValidacion.error.sugerencias && errorValidacion.error.sugerencias.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="font-semibold text-inegi-gray-dark">Sugerencias:</p>
                                    <ul className="list-none space-y-1 text-inegi-gray-medium">
                                      {errorValidacion.error.sugerencias.map((sugerencia, idx) => (
                                        <li key={idx} className={idx === 0 ? "" : "pl-2"}>{sugerencia}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {errorValidacion.error.ejemplos_contextuales && errorValidacion.error.ejemplos_contextuales.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="font-semibold text-inegi-gray-dark">Ejemplos contextuales:</p>
                                    <ul className="list-disc list-inside space-y-1 text-inegi-gray-medium">
                                      {errorValidacion.error.ejemplos_contextuales.map((ejemplo, idx) => (
                                        <li key={idx}>{ejemplo}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {errorValidacion.variable && (
                                  <div className="pt-2 border-t border-red-200">
                                    <p className="text-xs text-inegi-gray-medium">
                                      Variable: <span className="font-medium">{errorValidacion.variable.nombre}</span> ({errorValidacion.variable.idVar})
                                    </p>
                                    <p className="text-xs text-inegi-gray-medium">
                                      Tema: {errorValidacion.variable.tema} / {errorValidacion.variable.subtema}
                                    </p>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          )}
                          
                          <Button
                            onClick={() => {
                              setMostrarInputPersonalizado(false);
                              setNombrePersonalizado("");
                              setErrorValidacion(null);
                            }}
                            variant="ghost"
                            size="sm"
                            className="text-inegi-gray-medium hover:text-inegi-blue-dark"
                          >
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

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
                <div className="space-y-6">
                  {/* Header de la ficha */}
                  <Card className="border-inegi-blue-medium border-2 bg-inegi-blue-light">
                    <CardHeader>
                      <div>
                        <CardTitle className="text-xl text-inegi-blue-dark">
                          {fichaMetodologica.indicador.nombre}
                        </CardTitle>
                        <Badge className="mt-2 bg-inegi-green text-white">
                          {fichaMetodologica.indicador.siglas}
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Objetivo e importancia */}
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
                      <code className="block p-4 bg-white rounded-lg text-sm font-mono border border-inegi-blue-medium/20">
                        {fichaMetodologica.ficha.formula}
                      </code>
                      {fichaMetodologica.ficha.formula_detalle && Object.keys(fichaMetodologica.ficha.formula_detalle).length > 0 && (
                        <div className="space-y-2 pt-2">
                          <p className="text-sm font-semibold text-inegi-blue-dark">Donde:</p>
                          {Object.entries(fichaMetodologica.ficha.formula_detalle).map(([sigla, descripcion]) => (
                            <div key={sigla} className="text-sm text-inegi-gray-medium pl-2">
                              <span className="font-mono font-semibold text-inegi-blue-medium">{sigla}</span> = {descripcion}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Tabla de datos */}
                  {fichaMetodologica.visualizacion?.tabla_datos && (
                    <Card className="border-inegi-blue-medium/20">
                      <CardHeader className="bg-inegi-blue-light">
                        <CardTitle className="text-inegi-blue-dark">Tabla de Datos</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4 overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-inegi-blue-dark text-white">
                              <th className="p-2 text-left font-semibold">Año</th>
                              {fichaMetodologica.visualizacion!.tabla_datos.series.map((serie) => (
                                <>
                                  <th key={`${serie.nombre}-num`} className="p-2 text-right font-semibold text-xs">
                                    {serie.columnas.numerador.label}
                                  </th>
                                  <th key={`${serie.nombre}-den`} className="p-2 text-right font-semibold text-xs">
                                    {serie.columnas.denominador.label}
                                  </th>
                                  <th key={`${serie.nombre}-res`} className="p-2 text-right font-semibold">
                                    {serie.columnas.resultado.label}
                                  </th>
                                </>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {fichaMetodologica.visualizacion!.tabla_datos.años.map((año, idx) => (
                              <tr key={año} className={idx % 2 === 0 ? "bg-white" : "bg-inegi-blue-light/30"}>
                                <td className="p-2 font-medium text-inegi-blue-dark">{año}</td>
                                {fichaMetodologica.visualizacion!.tabla_datos.series.map((serie) => {
                                  const num = serie.columnas.numerador.datos.find((d) => d.año === año);
                                  const den = serie.columnas.denominador.datos.find((d) => d.año === año);
                                  const res = serie.columnas.resultado.datos.find((d) => d.año === año);
                                  return (
                                    <>
                                      <td key={`${serie.nombre}-${año}-num`} className="p-2 text-right text-inegi-gray-dark">
                                        {num !== undefined ? num.valor.toLocaleString('es-MX') : "—"}
                                      </td>
                                      <td key={`${serie.nombre}-${año}-den`} className="p-2 text-right text-inegi-gray-dark">
                                        {den !== undefined ? den.valor.toLocaleString('es-MX') : "—"}
                                      </td>
                                      <td key={`${serie.nombre}-${año}-res`} className="p-2 text-right font-medium text-inegi-blue-dark">
                                        {res !== undefined ? res.valor.toFixed(2) : "—"}
                                      </td>
                                    </>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {fichaMetodologica.visualizacion.tabla_datos.notas?.map((nota, i) => (
                          <p key={i} className="text-xs text-inegi-gray-medium italic mt-2">{nota}</p>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Gráfico */}
                  {fichaMetodologica.visualizacion?.grafico && (() => {
                    const grafico = fichaMetodologica.visualizacion!.grafico;
                    const chartData = grafico.eje_x.valores.map(año => ({
                      año,
                      ...grafico.series.reduce((acc, s) => ({
                        ...acc,
                        [s.nombre]: s.datos.find(d => d.año === año)?.valor ?? null
                      }), {} as Record<string, number | null>)
                    }));
                    const ChartComponent = grafico.tipo === "barras" ? BarChart : LineChart;
                    return (
                      <Card className="border-inegi-blue-medium/20">
                        <CardHeader className="bg-inegi-blue-light">
                          <CardTitle className="text-inegi-blue-dark">Gráfico</CardTitle>
                          <p className="text-sm text-inegi-gray-medium">{grafico.titulo}</p>
                          {grafico.subtitulo && (
                            <p className="text-xs text-inegi-gray-medium">{grafico.subtitulo}</p>
                          )}
                        </CardHeader>
                        <CardContent className="pt-4">
                          <ResponsiveContainer width="100%" height={300}>
                            <ChartComponent data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="año" />
                              <YAxis domain={[grafico.eje_y.min, grafico.eje_y.max]} />
                              <RechartsTooltip />
                              <Legend />
                              {grafico.series.map((serie) =>
                                grafico.tipo === "barras" ? (
                                  <Bar key={serie.nombre} dataKey={serie.nombre} fill={serie.color} />
                                ) : (
                                  <Line
                                    key={serie.nombre}
                                    type="monotone"
                                    dataKey={serie.nombre}
                                    stroke={serie.color}
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                    connectNulls
                                  />
                                )
                              )}
                            </ChartComponent>
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
                              <div key={idx} className={idx > 0 ? "pt-3 border-t border-inegi-blue-medium/10" : ""}>
                                <Badge className="bg-inegi-blue-medium text-white mb-1">
                                  {ods.objetivo}
                                </Badge>
                                <p className="text-xs text-inegi-gray-medium mt-1">
                                  <span className="font-medium">Meta:</span> {ods.meta}
                                </p>
                                {ods.indicador && ods.indicador !== '-' && (
                                  <p className="text-xs text-inegi-gray-medium mt-1">
                                    <span className="font-medium">Indicador:</span> {ods.indicador}
                                  </p>
                                )}
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
                      {fichaMetodologica.ficha.alineacion.pnd && (
                        <div className="pt-2 border-t border-inegi-blue-medium/20">
                          <p className="text-sm text-inegi-gray-medium mb-2 font-semibold">
                            Plan Nacional de Desarrollo (PND)
                          </p>
                          <div className="pl-2 space-y-1">
                            <p className="text-sm text-inegi-gray-dark">
                              <span className="font-medium text-inegi-blue-dark">Eje:</span> {fichaMetodologica.ficha.alineacion.pnd.eje}
                            </p>
                            <p className="text-sm text-inegi-gray-dark">
                              <span className="font-medium text-inegi-blue-dark">Objetivo:</span> {fichaMetodologica.ficha.alineacion.pnd.objetivo}
                            </p>
                            <p className="text-sm text-inegi-gray-dark">
                              <span className="font-medium text-inegi-blue-dark">Estrategia:</span> {fichaMetodologica.ficha.alineacion.pnd.estrategia}
                            </p>
                          </div>
                        </div>
                      )}

                    </CardContent>
                  </Card>

                  {/* Botones de acción */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    {fichaMetodologica.descarga.disponible && (
                      <Button
                        className="flex-1 bg-inegi-green hover:bg-[#5A8E31] text-white"
                        size="lg"
                        onClick={() => window.open(fichaMetodologica.descarga.url, "_blank")}
                      >
                        <Download className="w-5 h-5 mr-2" />
                        Descargar PDF
                      </Button>
                    )}
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
