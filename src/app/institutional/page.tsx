"use client"

import * as React from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLedgerStore } from "@/lib/store"
import { aiJsonKeyMapper, type AiJsonKeyMapperOutput } from "@/ai/flows/ai-json-key-mapper"
import { Zap, Loader2, CheckCircle2, AlertCircle, FileJson, ArrowRight, DollarSign } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"

export default function InstitutionalModule() {
  const { entities, addTransaction } = useLedgerStore()
  const { toast } = useToast()
  
  const [mounted, setMounted] = React.useState(false)
  const [jsonInput, setJsonInput] = React.useState('')
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [mappedData, setMappedData] = React.useState<AiJsonKeyMapperOutput | null>(null)
  const [selectedEntityId, setSelectedEntityId] = React.useState('')
  const [transactionType, setTransactionType] = React.useState<'purchase' | 'sale'>('purchase')
  const [costBasis, setCostBasis] = React.useState<number>(0)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const suppliers = entities.filter(e => e.type === 'supplier')
  const customers = entities.filter(e => e.type === 'customer')
  const currentEntityList = transactionType === 'purchase' ? suppliers : customers

  const handleProcess = async () => {
    if (!jsonInput.trim()) {
      toast({
        title: "Entrada requerida",
        description: "Por favor, pegue un payload JSON para procesar.",
        variant: "destructive"
      })
      return
    }

    try {
      JSON.parse(jsonInput)
      
      setIsProcessing(true)
      const result = await aiJsonKeyMapper({ invoiceJsonString: jsonInput })
      setMappedData(result)
      
      if (transactionType === 'sale' && result.totalAmount) {
        setCostBasis(result.totalAmount * 0.7)
      }

      toast({
        title: "Mapeo IA Exitoso",
        description: "Revise los campos de datos extraídos a continuación.",
      })
    } catch (error) {
      toast({
        title: "Fallo en el Procesamiento",
        description: error instanceof Error ? error.message : "JSON inválido o fallo de la IA.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSave = () => {
    if (!mappedData || !selectedEntityId) {
      toast({
        title: "Información Faltante",
        description: "Por favor, seleccione una entidad y verifique los datos mapeados.",
        variant: "destructive"
      })
      return
    }

    const selectedEntity = entities.find(e => e.id === selectedEntityId)
    if (!selectedEntity) return

    addTransaction({
      invoiceNumber: mappedData.invoiceNumber || `TX-${Date.now()}`,
      issueDate: mappedData.issueDate || new Date().toISOString(),
      entityId: selectedEntity.id,
      entityName: selectedEntity.name,
      type: transactionType,
      items: (mappedData.items || []).map(i => ({
        description: i.description || 'Artículo genérico',
        quantity: i.quantity || 1,
        unitPrice: i.unitPrice || 0,
        lineTotal: i.lineTotal || 0,
      })),
      subtotal: mappedData.subtotal || 0,
      taxAmount: mappedData.taxAmount || 0,
      totalAmount: mappedData.totalAmount || 0,
      costBasis: transactionType === 'purchase' ? (mappedData.totalAmount || 0) : costBasis,
      gain: transactionType === 'sale' ? (mappedData.totalAmount || 0) - costBasis : 0,
    })

    toast({
      title: "Libro Mayor Actualizado",
      description: "Los datos se han persistido correctamente.",
    })

    setMappedData(null)
    setJsonInput('')
    setSelectedEntityId('')
  }

  if (!mounted) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-accent/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5 text-accent" />
                Módulo de Entrada
              </CardTitle>
              <CardDescription>Pegue el payload JSON original de su proveedor o cliente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>Tipo de Flujo</Label>
                    <Select 
                      value={transactionType} 
                      onValueChange={(val: any) => {
                        setTransactionType(val)
                        setMappedData(null)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="purchase">Compra Institucional</SelectItem>
                        <SelectItem value="sale">Venta de Factura</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>{transactionType === 'purchase' ? 'Proveedor' : 'Cliente'}</Label>
                    <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar entidad" />
                      </SelectTrigger>
                      <SelectContent>
                        {currentEntityList.map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Payload JSON</Label>
                  <Textarea 
                    placeholder="Pegue el JSON aquí..." 
                    className="min-h-[300px] font-code text-sm bg-black/30 resize-none border-primary/20 focus-visible:ring-primary"
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                  />
                </div>

                <Button 
                  className="w-full h-12 gap-2 text-lg font-headline transition-all hover:scale-[1.01] active:scale-[0.99]" 
                  onClick={handleProcess}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <><Loader2 className="h-5 w-5 animate-spin" /> Procesando Mapeo IA...</>
                  ) : (
                    <><Zap className="h-5 w-5 fill-current" /> Ejecutar Análisis Inteligente</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <Card className="min-h-[600px] border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Espacio de Validación
              </CardTitle>
              <CardDescription>Revise y finalice los campos financieros mapeados antes de confirmar en el libro mayor.</CardDescription>
            </CardHeader>
            <CardContent>
              {mappedData ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-widest">Ref. Factura</Label>
                      <div className="p-3 bg-secondary rounded-md font-mono text-sm border">{mappedData.invoiceNumber || 'N/D'}</div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-widest">Fecha de Emisión</Label>
                      <div className="p-3 bg-secondary rounded-md text-sm border">{mappedData.issueDate || 'N/D'}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-widest">Líneas de Detalle</Label>
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">Descripción</th>
                            <th className="px-4 py-2 text-right font-medium">Cant.</th>
                            <th className="px-4 py-2 text-right font-medium">Unidad</th>
                            <th className="px-4 py-2 text-right font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mappedData.items?.map((item, idx) => (
                            <tr key={idx} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-2">{item.description}</td>
                              <td className="px-4 py-2 text-right">{item.quantity}</td>
                              <td className="px-4 py-2 text-right">${item.unitPrice?.toFixed(2)}</td>
                              <td className="px-4 py-2 text-right font-medium">${item.lineTotal?.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-widest">Subtotal</Label>
                      <div className="text-lg font-bold">${mappedData.subtotal?.toFixed(2)}</div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-widest">Impuestos</Label>
                      <div className="text-lg font-bold">${mappedData.taxAmount?.toFixed(2)}</div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-widest text-primary">Gran Total</Label>
                      <div className="text-2xl font-bold text-primary font-headline">${mappedData.totalAmount?.toFixed(2)}</div>
                    </div>
                  </div>

                  {transactionType === 'sale' && (
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-4">
                       <div className="flex items-center gap-2 text-primary font-medium">
                        <DollarSign className="h-4 w-4" /> Configuración de Margen
                       </div>
                       <div className="flex items-center gap-6">
                          <div className="flex-1 space-y-2">
                            <Label htmlFor="costBasis">Costo de Inventario</Label>
                            <Input 
                              id="costBasis" 
                              type="number" 
                              value={costBasis} 
                              onChange={(e) => setCostBasis(Number(e.target.value))}
                              className="bg-background"
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                             <Label className="text-xs text-muted-foreground uppercase">Ganancia Estimada</Label>
                             <div className="text-xl font-bold text-accent">
                                ${(mappedData.totalAmount! - costBasis).toFixed(2)}
                             </div>
                             <Badge variant="outline" className="border-accent text-accent">
                                {(((mappedData.totalAmount! - costBasis) / mappedData.totalAmount!) * 100).toFixed(1)}% Margen
                             </Badge>
                          </div>
                       </div>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <Button onClick={handleSave} className="w-full gap-2 bg-primary hover:bg-primary/90 h-12 text-lg">
                      <ArrowRight className="h-5 w-5" /> Confirmar en Libro Mayor
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-muted-foreground py-20">
                  <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                    <AlertCircle className="h-8 w-8" />
                  </div>
                  <div className="max-w-[300px]">
                    <p className="font-medium text-foreground">Esperando Flujo de Datos</p>
                    <p className="text-sm">Una vez procesado el JSON, los campos mapeados por IA aparecerán aquí para verificación humana.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
