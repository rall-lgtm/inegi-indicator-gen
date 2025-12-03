import { useState, useEffect } from "react";
import { Search, AlertCircle, CheckCircle, Download, RefreshCw, Loader2, TrendingUp, FileText, Info } from "lucide-react";
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
        tema: string;
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
  const [idVar, setIdVar] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [fichaMetodologica, setFichaMetodologica] = useState<FichaMetodologica | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sessionId] = useState(`session-${Date.now()}`);
  const [propuestasAcumuladas, setPropuestasAcumuladas] = useState<PropuestaIndicador[]>([]);
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
      
      // Si son propuestas adicionales, acumular
      if (data.tipo === 'propuestas_adicionales') {
        setPropuestasAcumuladas(prev => [...prev, ...(data.propuestas || [])]);
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
  };

  return (
    <div className="min-h-screen bg-gradient-primary">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">Generador de Indicadores Ambientales</h1>
              <p className="text-sm opacity-90">Instituto Nacional de Estadística y Geografía</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Formulario de búsqueda */}
        <Card className="shadow-xl border-0">
          <CardHeader>
            <CardTitle className="text-2xl">Consultar Variable</CardTitle>
            <CardDescription>
              Ingresa el ID de la variable para generar propuestas de indicadores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInicio} className="flex gap-3">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Ej: CPV-005"
                  value={idVar}
                  onChange={(e) => setIdVar(e.target.value.toUpperCase())}
                  disabled={loading}
                  className="text-lg h-12"
                />
              </div>
              <Button
                type="submit"
                disabled={loading || idVar.trim().length < 3}
                className="h-12 px-6"
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
                    Generar
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Resultados */}
        {response && (
          <div id="result-section" className="mt-8 space-y-6">
            {/* Error de temporalidad */}
            {response.tipo === "error_temporalidad" && (
              <Card className="border-warning border-2 shadow-xl">
                <CardHeader className="bg-warning/10">
                  <div className="flex items-start gap-4">
                    <AlertCircle className="w-8 h-8 text-warning flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <CardTitle className="text-warning-foreground text-xl">
                        {response.error.mensaje}
                      </CardTitle>
                      <CardDescription className="text-foreground/80 mt-2">
                        {response.error.razon}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {/* Información de la variable */}
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <h3 className="font-semibold text-base">Variable consultada</h3>
                    <div className="space-y-1">
                      <p className="text-sm">
                        <span className="font-semibold text-primary">{response.variable.idVar}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {response.variable.nombre}
                      </p>
                    </div>
                    
                    {/* Años disponibles vs requeridos */}
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Badge variant="outline" className="bg-amber-100 border-amber-500 text-amber-900 font-semibold">
                        Disponibles: {response.error.detalles.anios_disponibles} año(s)
                      </Badge>
                      <span className="text-muted-foreground">·</span>
                      <Badge variant="outline" className="bg-green-100 border-green-600 text-green-800 font-semibold">
                        Requeridos: {response.error.detalles.anios_requeridos} años
                      </Badge>
                    </div>

                    {/* Lista de años */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Años con información:</p>
                      <div className="flex flex-wrap gap-2">
                        {response.variable.años.map((año) => (
                          <Badge key={año} variant="secondary" className="text-xs bg-slate-200 text-slate-800 font-medium">
                            {año}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Sugerencia */}
                  <div className="bg-accent/20 border border-accent/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">💡</span>
                      <div>
                        <p className="font-medium text-sm mb-1">Sugerencia</p>
                        <p className="text-sm text-muted-foreground">
                          Intenta con otra variable que tenga al menos <span className="font-semibold text-foreground">{response.error.detalles.anios_requeridos} años</span> de datos históricos para generar indicadores válidos según el Catálogo Nacional de Indicadores de INEGI.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleNuevaVariable} className="w-full" variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Probar otra variable
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Propuestas */}
            {(response.tipo === "propuestas_iniciales" || response.tipo === "propuestas_adicionales") && (
              <div className="space-y-6">
                {/* Info de la variable */}
                {response.tipo === "propuestas_iniciales" && (
                  <Card className="shadow-lg border-primary/20">
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-primary">
                          {response.variable.nombre}
                        </h3>
                        <p className="text-muted-foreground">{response.variable.definicion}</p>
                        <div className="flex flex-wrap gap-2 mt-4">
                          <Badge variant="outline">{response.variable.tema}</Badge>
                          <Badge variant="outline">{response.variable.subtema}</Badge>
                          <Badge variant="secondary">
                            {response.variable.totalAnios} años disponibles
                          </Badge>
                          <Badge variant="secondary">
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
                    {propuestasAcumuladas.map((propuesta) => (
                      <Tooltip key={propuesta.id}>
                        <TooltipTrigger asChild>
                          <Card
                            className="shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-primary/10 cursor-help"
                          >
                            <CardHeader>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                                      {propuesta.id}
                                    </div>
                                    <CardTitle className="text-lg leading-tight">
                                      {propuesta.nombre}
                                    </CardTitle>
                                    {(propuesta.objetivo || propuesta.importancia) && (
                                      <Info className="h-4 w-4 text-primary flex-shrink-0" />
                                    )}
                                  </div>
                                  <CardDescription className="mt-2">
                                    {propuesta.descripcion}
                                  </CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex gap-2">
                                <Badge className="bg-accent">{propuesta.enfoque}</Badge>
                                <Badge variant="outline">{propuesta.tipo}</Badge>
                              </div>
                              <Button
                                onClick={() => handleSeleccionar(propuesta)}
                                disabled={loading}
                                className="w-full bg-warning hover:bg-warning/90"
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
                          <TooltipContent className="max-w-md p-4 space-y-3" side="top">
                            {propuesta.objetivo && (
                              <div>
                                <p className="font-semibold text-sm mb-1 text-primary">Objetivo:</p>
                                <p className="text-sm">{propuesta.objetivo}</p>
                              </div>
                            )}
                            {propuesta.importancia && (
                              <div>
                                <p className="font-semibold text-sm mb-1 text-primary">Importancia:</p>
                                <p className="text-sm">{propuesta.importancia}</p>
                              </div>
                            )}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    ))}
                  </div>
                </TooltipProvider>

                {/* Botón más opciones */}
                <Button
                  onClick={handleMasOpciones}
                  disabled={loading}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-5 h-5 mr-2" />
                  )}
                  Ver más opciones
                </Button>
              </div>
            )}

          </div>
        )}

        {/* Modal de Ficha Metodológica */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-2xl">
                <FileText className="w-8 h-8 text-success" />
                Ficha Metodológica
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[calc(90vh-8rem)] pr-4">
              {fichaMetodologica && (
                <div className="space-y-6">
                  {/* Header de la ficha */}
                  <Card className="border-success border-2">
                    <CardHeader className="bg-success/10">
                      <div>
                        <CardTitle className="text-xl text-success">
                          {fichaMetodologica.indicador.nombre}
                        </CardTitle>
                        <Badge className="mt-2 bg-success" variant="secondary">
                          {fichaMetodologica.indicador.siglas}
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Objetivo e importancia */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Objetivo del Indicador</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{fichaMetodologica.ficha.objetivo}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Importancia y/o Utilidad del Indicador</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{fichaMetodologica.ficha.importancia}</p>
                    </CardContent>
                  </Card>

                  {/* Definición de las Variables */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Definición de las Variables</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {fichaMetodologica.ficha.definicion_variables && Object.entries(fichaMetodologica.ficha.definicion_variables).map(([variable, definicion]) => (
                        <div key={variable}>
                          <p className="font-semibold text-sm mb-1">{variable}</p>
                          <p className="text-muted-foreground text-sm">{definicion}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Fórmula */}
                  <Card className="bg-muted/50">
                    <CardHeader>
                      <CardTitle>Fórmula de Cálculo</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <code className="block p-4 bg-card rounded-lg text-sm font-mono">
                        {fichaMetodologica.ficha.formula}
                      </code>
                      {fichaMetodologica.ficha.formula_detalle && Object.keys(fichaMetodologica.ficha.formula_detalle).length > 0 && (
                        <div className="space-y-2 pt-2">
                          <p className="text-sm font-semibold">Donde:</p>
                          {Object.entries(fichaMetodologica.ficha.formula_detalle).map(([sigla, descripcion]) => (
                            <div key={sigla} className="text-sm text-muted-foreground pl-2">
                              <span className="font-mono font-semibold">{sigla}</span> = {descripcion}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Tabla de Datos */}
                  {fichaMetodologica.ficha.tabla_datos && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Tabla de Datos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {typeof fichaMetodologica.ficha.tabla_datos === 'object' 
                            ? JSON.stringify(fichaMetodologica.ficha.tabla_datos, null, 2)
                            : fichaMetodologica.ficha.tabla_datos}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Gráfico */}
                  {fichaMetodologica.ficha.grafico && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Gráfico</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-muted-foreground">
                          {typeof fichaMetodologica.ficha.grafico === 'object' 
                            ? JSON.stringify(fichaMetodologica.ficha.grafico, null, 2)
                            : fichaMetodologica.ficha.grafico}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Características técnicas */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Unidad de Medida</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm font-semibold">{fichaMetodologica.ficha.unidad}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Cobertura Geográfica</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm font-semibold">{fichaMetodologica.ficha.cobertura}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Desagregación</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm font-semibold">{fichaMetodologica.ficha.desagregacion}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Frecuencia de Actualización del Indicador</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm font-semibold">{fichaMetodologica.ficha.frecuencia}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Temporal y Fuente */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Información Temporal y Fuente de Datos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Cobertura Temporal del Indicador:</p>
                        <p className="font-semibold">{fichaMetodologica.ficha.temporal}</p>
                      </div>
                      {fichaMetodologica.ficha.periodicidad && (
                        <div>
                          <p className="text-sm text-muted-foreground">Periodicidad:</p>
                          <p className="font-semibold">{fichaMetodologica.ficha.periodicidad}</p>
                        </div>
                      )}
                      {fichaMetodologica.ficha.temporal_fuente && (
                        <div>
                          <p className="text-sm text-muted-foreground">Cobertura Temporal de la Fuente de Datos:</p>
                          <p className="font-semibold">{fichaMetodologica.ficha.temporal_fuente}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-muted-foreground">Fuente de Datos:</p>
                        <p className="font-semibold">
                          {fichaMetodologica.ficha.fuente.nombre} - {fichaMetodologica.ficha.fuente.institucion}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Programa: {fichaMetodologica.ficha.fuente.programa}
                        </p>
                        {fichaMetodologica.ficha.fuente.url && (
                          <a 
                            href={fichaMetodologica.ficha.fuente.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline mt-1 inline-block"
                          >
                            Ver fuente →
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Limitaciones */}
                  {fichaMetodologica.ficha.limitaciones && fichaMetodologica.ficha.limitaciones.length > 0 && (
                    <Card className="border-warning/30 bg-warning/5">
                      <CardHeader>
                        <CardTitle className="text-warning-foreground">Limitaciones</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {fichaMetodologica.ficha.limitaciones.map((limitacion, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground flex gap-2">
                              <span className="text-warning">•</span>
                              <span>{limitacion}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Alineación ODS, MDEA y PND */}
                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader>
                      <CardTitle>Alineación con Marcos Internacionales</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2 font-semibold">
                          Objetivos de Desarrollo Sostenible (ODS)
                        </p>
                        <div className="pl-2 space-y-1">
                          <Badge className="bg-primary">
                            ODS {fichaMetodologica.ficha.alineacion.ods.numero} - {fichaMetodologica.ficha.alineacion.ods.nombre}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-2">
                            Meta: {fichaMetodologica.ficha.alineacion.ods.meta}
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 border-t">
                        <p className="text-sm text-muted-foreground mb-2 font-semibold">
                          Marco de Desarrollo Estadístico Ambiental (MDEA)
                        </p>
                        <div className="pl-2 space-y-1">
                          <p className="text-sm">
                            <span className="font-medium">Componente:</span> {fichaMetodologica.ficha.alineacion.mdea.componente}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Subcomponente:</span> {fichaMetodologica.ficha.alineacion.mdea.subcomponente}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Tema:</span> {fichaMetodologica.ficha.alineacion.mdea.tema}
                          </p>
                        </div>
                      </div>
                      {fichaMetodologica.ficha.alineacion.pnd && (
                        <div className="pt-2 border-t">
                          <p className="text-sm text-muted-foreground mb-2 font-semibold">
                            Plan Nacional de Desarrollo (PND)
                          </p>
                          <div className="pl-2 space-y-1">
                            <p className="text-sm">
                              <span className="font-medium">Eje:</span> {fichaMetodologica.ficha.alineacion.pnd.eje}
                            </p>
                            <p className="text-sm">
                              <span className="font-medium">Objetivo:</span> {fichaMetodologica.ficha.alineacion.pnd.objetivo}
                            </p>
                            <p className="text-sm">
                              <span className="font-medium">Estrategia:</span> {fichaMetodologica.ficha.alineacion.pnd.estrategia}
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
                        className="flex-1 bg-success hover:bg-success/90"
                        size="lg"
                        onClick={() => window.open(fichaMetodologica.descarga.url, "_blank")}
                      >
                        <Download className="w-5 h-5 mr-2" />
                        Descargar PDF
                      </Button>
                    )}
                    <Button
                      onClick={() => setIsModalOpen(false)}
                      variant="outline"
                      size="lg"
                      className="flex-1"
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

      {/* Footer */}
      <footer className="mt-16 py-8 border-t bg-card/50">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Instituto Nacional de Estadística y Geografía (INEGI)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Generador de Indicadores Ambientales
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
