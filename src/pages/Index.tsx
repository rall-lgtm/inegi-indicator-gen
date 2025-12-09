import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, AlertCircle, CheckCircle, Download, RefreshCw, Loader2, TrendingUp, FileText, Info, AlertTriangle, Maximize2, Minimize2, FileDown, Sparkles, PenLine } from "lucide-react";
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
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
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
};

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
      ods: { 
        numero: string; 
        nombre: string;
        meta: string;
      };
      mdea: { 
        componente: string;
        subcomponente: string;
        topico: string;
      };
      pnd?: {
        eje: string;
        objetivo: string;
        estrategia: string;
      };
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
    await enviarConsulta("mas_opciones");
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
    setLoading(true);
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
      setLoading(false);
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
            new Paragraph({
              children: [
                new TextRun({ text: "ODS: ", bold: true }),
                new TextRun({ text: `${ficha.alineacion?.ods?.numero} - ${ficha.alineacion?.ods?.nombre}` }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Meta ODS: ", bold: true }),
                new TextRun({ text: ficha.alineacion?.ods?.meta || "" }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "MDEA Componente: ", bold: true }),
                new TextRun({ text: ficha.alineacion?.mdea?.componente || "" }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Subcomponente: ", bold: true }),
                new TextRun({ text: ficha.alineacion?.mdea?.subcomponente || "" }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Tópico: ", bold: true }),
                new TextRun({ text: ficha.alineacion?.mdea?.topico || "" }),
              ],
              spacing: { after: 200 },
            }),
            ...(ficha.alineacion?.pnd ? [
              new Paragraph({
                children: [
                  new TextRun({ text: "PND Eje: ", bold: true }),
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
                  <p className="text-lg font-semibold text-inegi-blue-medium">{idFromUrl.toUpperCase()}</p>
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
              <Card className="border-inegi-gold border-2 shadow-xl">
                <CardHeader className="bg-amber-50">
                  <div className="flex items-start gap-4">
                    <AlertCircle className="w-8 h-8 text-inegi-gold flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <CardTitle className="text-inegi-blue-dark text-xl">
                        {response.error.mensaje}
                      </CardTitle>
                      <CardDescription className="text-inegi-gray-medium mt-2">
                        {response.error.razon}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {/* Información de la variable */}
                  <div className="bg-inegi-blue-light rounded-lg p-4 space-y-3">
                    <h3 className="font-semibold text-base text-inegi-blue-dark">Variable consultada</h3>
                    <div className="space-y-1">
                      <p className="text-sm">
                        <span className="font-semibold text-inegi-blue-medium">{response.variable.idVar}</span>
                      </p>
                      <p className="text-sm text-inegi-gray-medium">
                        {response.variable.nombre}
                      </p>
                    </div>
                    
                    {/* Años disponibles vs requeridos */}
                    <div className="flex items-center gap-2 pt-2 border-t border-inegi-blue-medium/20">
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
                          Intenta con otra variable que tenga al menos <span className="font-semibold text-inegi-blue-dark">{response.error.detalles.anios_requeridos} años</span> de datos históricos para generar indicadores válidos según el Catálogo Nacional de Indicadores de INEGI.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleNuevaVariable} className="w-full bg-inegi-blue-medium hover:bg-inegi-blue-dark" variant="default">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Probar otra variable
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Propuestas */}
            {(response.tipo === "propuestas_iniciales" || response.tipo === "propuestas_adicionales") && (
              <div className="space-y-6 animate-fade-in">
                {/* Info de la variable */}
                {response.tipo === "propuestas_iniciales" && (
                  <Card className="shadow-lg border-l-4 border-l-inegi-blue-medium animate-fade-in">
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-inegi-blue-dark">
                          {response.variable.nombre}
                        </h3>
                        <p className="text-inegi-gray-medium">{response.variable.definicion}</p>
                        <div className="flex flex-wrap gap-2 mt-4">
                          <Badge className="bg-inegi-blue-dark text-white">{response.variable.tema}</Badge>
                          <Badge className="bg-inegi-blue-medium text-white">{response.variable.subtema}</Badge>
                          <Badge className="bg-inegi-green text-white">
                            {response.variable.totalAnios} años disponibles
                          </Badge>
                          <Badge variant="outline" className="border-inegi-blue-medium text-inegi-blue-dark">
                            {response.variable.años.join(", ")}
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
                      <Tooltip key={propuesta.id}>
                        <TooltipTrigger asChild>
                          <Card
                            className="shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-inegi-blue-medium/10 cursor-help animate-fade-in"
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
                                    {(propuesta.objetivo || propuesta.importancia) && (
                                      <Info className="h-4 w-4 text-inegi-blue-medium flex-shrink-0" />
                                    )}
                                  </div>
                                  <CardDescription className="mt-2 text-inegi-gray-medium">
                                    {propuesta.descripcion}
                                  </CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex gap-2">
                                <Badge className="bg-inegi-blue-dark text-white">{propuesta.enfoque}</Badge>
                                <Badge variant="outline" className="border-inegi-blue-medium text-inegi-blue-medium">{propuesta.tipo}</Badge>
                              </div>
                              <Button
                                onClick={() => handleSeleccionar(propuesta)}
                                disabled={loading}
                                className="w-full bg-inegi-gold hover:bg-[#D4A004] text-inegi-gray-dark font-semibold"
                              >
                                {loading ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Elegir esta propuesta
                                  </>
                                )}
                              </Button>
                            </CardContent>
                          </Card>
                        </TooltipTrigger>
                        {(propuesta.objetivo || propuesta.importancia) && (
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
                          </TooltipContent>
                        )}
                      </Tooltip>
                    ))}
                  </div>
                </TooltipProvider>

                {/* Botones de acción */}
                <div className="space-y-4">
                  {/* Ver más opciones */}
                  {!mostrandoTodas ? (
                    <Button
                      onClick={handleMasOpciones}
                      disabled={loading}
                      variant="outline"
                      className="w-full border-inegi-blue-medium text-inegi-blue-medium hover:bg-inegi-blue-light hover:text-inegi-blue-dark"
                      size="lg"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-5 h-5 mr-2" />
                      )}
                      Ver más opciones
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

                  {/* Tabla de Datos */}
                  {fichaMetodologica.ficha.tabla_datos && (
                    <Card className="border-inegi-blue-medium/20">
                      <CardHeader className="bg-inegi-blue-light">
                        <CardTitle className="text-inegi-blue-dark">Tabla de Datos</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="text-sm text-inegi-gray-medium whitespace-pre-wrap">
                          {typeof fichaMetodologica.ficha.tabla_datos === 'object' 
                            ? JSON.stringify(fichaMetodologica.ficha.tabla_datos, null, 2)
                            : fichaMetodologica.ficha.tabla_datos}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Gráfico */}
                  {fichaMetodologica.ficha.grafico && (
                    <Card className="border-inegi-blue-medium/20">
                      <CardHeader className="bg-inegi-blue-light">
                        <CardTitle className="text-inegi-blue-dark">Gráfico</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="text-sm text-inegi-gray-medium">
                          {typeof fichaMetodologica.ficha.grafico === 'object' 
                            ? JSON.stringify(fichaMetodologica.ficha.grafico, null, 2)
                            : fichaMetodologica.ficha.grafico}
                        </div>
                      </CardContent>
                    </Card>
                  )}

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
                      <div>
                        <p className="text-sm text-inegi-gray-medium mb-2 font-semibold">
                          Objetivos de Desarrollo Sostenible (ODS)
                        </p>
                        <div className="pl-2 space-y-1">
                          <Badge className="bg-inegi-blue-medium text-white">
                            ODS {fichaMetodologica.ficha.alineacion.ods.numero} - {fichaMetodologica.ficha.alineacion.ods.nombre}
                          </Badge>
                          <p className="text-xs text-inegi-gray-medium mt-2">
                            Meta: {fichaMetodologica.ficha.alineacion.ods.meta}
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-inegi-blue-medium/20">
                        <p className="text-sm text-inegi-gray-medium mb-2 font-semibold">
                          Marco de Desarrollo Estadístico Ambiental (MDEA)
                        </p>
                        <div className="pl-2 space-y-1">
                          <p className="text-sm text-inegi-gray-dark">
                            <span className="font-medium text-inegi-blue-dark">Componente:</span> {fichaMetodologica.ficha.alineacion.mdea.componente}
                          </p>
                          <p className="text-sm text-inegi-gray-dark">
                            <span className="font-medium text-inegi-blue-dark">Subcomponente:</span> {fichaMetodologica.ficha.alineacion.mdea.subcomponente}
                          </p>
                          <p className="text-sm text-inegi-gray-dark">
                            <span className="font-medium text-inegi-blue-dark">Tópico:</span> {fichaMetodologica.ficha.alineacion.mdea.topico}
                          </p>
                        </div>
                      </div>
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
