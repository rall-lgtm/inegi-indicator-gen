import { useState } from "react";
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
type ErrorTemporalidad = {
  tipo: "error_temporalidad";
  error: {
    codigo: string;
    mensaje: string;
    razon: string;
    detalles: {
      anios_requeridos: number;
      anios_disponibles: number;
      años: number[];
    };
  };
  variable: {
    idVar: string;
    nombre: string;
    totalAnios: number;
  };
  recomendacion: string;
  alternativas: string[];
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
    numerador: string;
    denominador: string;
    unidad: string;
    formula: string;
    cobertura: string;
    temporal: string;
    frecuencia: string;
    fuente: {
      nombre: string;
      institucion: string;
    };
    limitaciones: string[];
    alineacion: {
      ods: { numero: string; nombre: string };
      mdea: { componente: string };
    };
    pnd?: {
      eje: string;
      objetivo: string;
      estrategia: string;
    };
  };
  descarga: {
    disponible: boolean;
    url: string;
  };
};

type ApiResponse = ErrorTemporalidad | PropuestasIniciales | PropuestasAdicionales | FichaMetodologica;

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
      if (data.tipo === "ficha_metodologica") {
        setFichaMetodologica(data);
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
              <Card className="border-destructive border-2 shadow-xl">
                <CardHeader className="bg-destructive/10">
                  <div className="flex items-start gap-4">
                    <AlertCircle className="w-8 h-8 text-destructive flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <CardTitle className="text-destructive text-xl">
                        {response.error.mensaje}
                      </CardTitle>
                      <CardDescription className="text-destructive/80 mt-2">
                        {response.error.razon}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Variable consultada:</h3>
                    <p className="text-muted-foreground">
                      <span className="font-medium">{response.variable.idVar}</span> -{" "}
                      {response.variable.nombre}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Años disponibles</p>
                      <p className="text-2xl font-bold text-destructive">
                        {response.error.detalles.anios_disponibles}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Años requeridos</p>
                      <p className="text-2xl font-bold text-success">
                        {response.error.detalles.anios_requeridos}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Años con información:</h4>
                    <div className="flex gap-2">
                      {response.error.detalles.años.map((año) => (
                        <Badge key={año} variant="outline">
                          {año}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
                    <h4 className="font-semibold text-warning-foreground mb-2">
                      Recomendaciones:
                    </h4>
                    <ul className="space-y-1">
                      {response.alternativas.map((alt, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground">
                          • {alt}
                        </li>
                      ))}
                    </ul>
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
                      <CardTitle>Objetivo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{fichaMetodologica.ficha.objetivo}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Importancia</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{fichaMetodologica.ficha.importancia}</p>
                    </CardContent>
                  </Card>

                  {/* Numerador y Denominador */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Numerador</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{fichaMetodologica.ficha.numerador}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Denominador</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {fichaMetodologica.ficha.denominador}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Fórmula */}
                  <Card className="bg-muted/50">
                    <CardHeader>
                      <CardTitle>Fórmula</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <code className="block p-4 bg-card rounded-lg text-sm font-mono">
                        {fichaMetodologica.ficha.formula}
                      </code>
                    </CardContent>
                  </Card>

                  {/* Características técnicas */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Unidad</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm font-semibold">{fichaMetodologica.ficha.unidad}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Cobertura</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm font-semibold">{fichaMetodologica.ficha.cobertura}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Frecuencia</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm font-semibold">{fichaMetodologica.ficha.frecuencia}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Temporal y Fuente */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Información Temporal</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Años disponibles:</p>
                        <p className="font-semibold">{fichaMetodologica.ficha.temporal}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Fuente:</p>
                        <p className="font-semibold">
                          {fichaMetodologica.ficha.fuente.nombre} - {fichaMetodologica.ficha.fuente.institucion}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Limitaciones */}
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

                  {/* Alineación ODS y MDEA */}
                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader>
                      <CardTitle>Alineación con Marcos Internacionales</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Objetivos de Desarrollo Sostenible (ODS)
                        </p>
                        <Badge className="bg-primary">
                          ODS {fichaMetodologica.ficha.alineacion.ods.numero} -{" "}
                          {fichaMetodologica.ficha.alineacion.ods.nombre}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Marco de Desarrollo Estadístico Ambiental (MDEA)
                        </p>
                        <Badge variant="outline">{fichaMetodologica.ficha.alineacion.mdea.componente}</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Plan Nacional de Desarrollo (PND) */}
                  {fichaMetodologica.ficha.pnd && (
                    <Card className="border-accent/30 bg-accent/5">
                      <CardHeader>
                        <CardTitle>Plan Nacional de Desarrollo (PND)</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Eje</p>
                          <p className="font-semibold">{fichaMetodologica.ficha.pnd.eje}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Objetivo</p>
                          <p className="font-semibold">{fichaMetodologica.ficha.pnd.objetivo}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Estrategia</p>
                          <p className="font-semibold">{fichaMetodologica.ficha.pnd.estrategia}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

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
