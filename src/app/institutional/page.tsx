"use client"

import * as React from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLedgerStore } from "@/lib/store"
import { aiJsonKeyMapper, type AiJsonKeyMapperOutput } from "@/ai/flows/ai-json-key-mapper"
import { Loader2, FileJson, ArrowUpTrayIcon, DollarSign, Plus, Briefcase, Calculator, ReceiptText, Trash2, Upload, FileCode } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export default function InstitutionalModule() {
  const { entities, projects, transactions, addProject, deleteProject, addTransaction } = useLedgerStore()
  const { toast } = useToast()
  
  const [mounted, setMounted] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState('projects')
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>('')
  
  // Project Creation State
  const [newProject, setNewProject] = React.useState({
    name: '',
    purchaseOrder: '',
    targetSaleAmount: 0,
    customerId: ''
  })

  // Data Processor State
  const [jsonInput, setJsonInput] = React.useState('')
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [mappedData, setMappedData] = React.useState<AiJsonKeyMapperOutput | null>(null)
  const [selectedSupplierId, setSelectedSupplierId] = React.useState('')
  const [isDragging, setIsDragging] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const customers = entities.filter(e => e.type === 'customer')
  const suppliers = entities.filter(e => e.type === 'supplier')
  const currentProject = projects.find(p => p.id === selectedProjectId)
  const projectTransactions = transactions.filter(t => t.projectId === selectedProjectId)
  const projectCosts = projectTransactions.filter(t => t.type === 'purchase').reduce((acc, curr) => acc + curr.totalAmount, 0)
  const projectInvoices = projectTransactions.filter(t => t.type === 'sale').reduce((acc, curr) => acc + curr.totalAmount, 0)

  const handleCreateProject = () => {
    if (!newProject.name || !newProject.customerId || !newProject.purchaseOrder) {
      toast({ title: "Datos incompletos", description: "Rellene todos los campos del proyecto.", variant: "destructive" })
      return
    }
    const customer = customers.find(c => c.id === newProject.customerId)
    addProject({
      name: newProject.name,
      purchaseOrder: newProject.purchaseOrder,
      targetSaleAmount: newProject.targetSaleAmount,
      customerId: newProject.customerId,
      customerName: customer?.name || 'Cliente Desconocido',
      status: 'active'
    })
    setNewProject({ name: '', purchaseOrder: '', targetSaleAmount: 0, customerId: '' })
    toast({ title: "Proyecto Creado", description: "El proyecto se ha registrado exitosamente." })
  }

  const handleProcessData = async (content?: string) => {
    const rawData = content || jsonInput
    if (!rawData.trim()) return
    try {
      setIsProcessing(true)
      const result = await aiJsonKeyMapper({ invoiceJsonString: rawData })
      setMappedData(result)
      toast({ title: "Datos Cargados", description: "Documento analizado correctamente." })
    } catch (error) {
      toast({ title: "Error de Formato", description: "No se pudo leer el archivo JSON.", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        setJsonInput(content)
        handleProcessData(content)
      }
      reader.readAsText(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type === "application/json") {
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        setJsonInput(content)
        handleProcessData(content)
      }
      reader.readAsText(file)
    } else {
      toast({ title: "Archivo no válido", description: "Por favor arrastre un archivo .json", variant: "destructive" })
    }
  }

  const handleSavePurchase = () => {
    if (!mappedData || !selectedSupplierId || !selectedProjectId) {
      toast({ title: "Información faltante", description: "Seleccione proveedor y proyecto.", variant: "destructive" })
      return
    }
    const supplier = suppliers.find(s => s.id === selectedSupplierId)
    addTransaction({
      invoiceNumber: mappedData.invoiceNumber || `DTE-${Date.now()}`,
      issueDate: mappedData.issueDate || new Date().toISOString(),
      entityId: selectedSupplierId,
      entityName: supplier?.name || '',
      projectId: selectedProjectId,
      type: 'purchase',
      items: (mappedData.items || []).map(i => ({
        description: i.description || 'Compra institucional',
        quantity: i.quantity || 1,
        unitPrice: i.unitPrice || 0,
        lineTotal: i.lineTotal || 0,
      })),
      subtotal: mappedData.subtotal || 0,
      taxAmount: mappedData.taxAmount || 0,
      totalAmount: mappedData.totalAmount || 0,
      costBasis: mappedData.totalAmount || 0,
      gain: 0
    })
    setMappedData(null)
    setJsonInput('')
    toast({ title: "Gasto Registrado", description: "Se añadió la compra al proyecto." })
  }

  const handleSaveFinalInvoice = () => {
    if (!mappedData || !selectedProjectId || !currentProject) return
    addTransaction({
      invoiceNumber: mappedData.invoiceNumber || `INV-${Date.now()}`,
      issueDate: mappedData.issueDate || new Date().toISOString(),
      entityId: currentProject.customerId,
      entityName: currentProject.customerName,
      projectId: selectedProjectId,
      type: 'sale',
      items: (mappedData.items || []).map(i => ({
        description: i.description || 'Venta final de proyecto',
        quantity: i.quantity || 1,
        unitPrice: i.unitPrice || 0,
        lineTotal: i.lineTotal || 0,
      })),
      subtotal: mappedData.subtotal || 0,
      taxAmount: mappedData.taxAmount || 0,
      totalAmount: mappedData.totalAmount || 0,
      costBasis: projectCosts,
      gain: (mappedData.totalAmount || 0) - projectCosts
    })
    setMappedData(null)
    setJsonInput('')
    toast({ title: "Factura Emitida", description: "La venta se ha vinculado al proyecto." })
  }

  if (!mounted) return null

  return (
    <AppLayout>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-secondary p-1">
          <TabsTrigger value="projects" className="gap-2"><Briefcase className="h-4 w-4" /> Proyectos</TabsTrigger>
          <TabsTrigger value="purchases" className="gap-2"><Plus className="h-4 w-4" /> Importar DTE Proveedor</TabsTrigger>
          <TabsTrigger value="comparison" className="gap-2"><Calculator className="h-4 w-4" /> Conciliación Final</TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle>Configurar Proyecto</CardTitle>
                <CardDescription>Defina el presupuesto y la orden de compra maestra.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre del Proyecto</Label>
                  <Input placeholder="Ej. Licitación Hospital Central" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Orden de Compra (OC)</Label>
                  <Input placeholder="Ej. OC-2024-SV-001" value={newProject.purchaseOrder} onChange={e => setNewProject({...newProject, purchaseOrder: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select value={newProject.customerId} onValueChange={val => setNewProject({...newProject, customerId: val})}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                    <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Monto de Venta Objetivo ($)</Label>
                  <Input type="number" value={newProject.targetSaleAmount} onChange={e => setNewProject({...newProject, targetSaleAmount: Number(e.target.value)})} />
                </div>
                <Button className="w-full bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20" onClick={handleCreateProject}>Crear Proyecto</Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Proyectos SV Activos</CardTitle>
                <CardDescription>Gestión de presupuestos institucionales en ejecución.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projects.length > 0 ? projects.map(p => (
                    <div key={p.id} className={`p-4 rounded-lg border flex items-center justify-between transition-all ${selectedProjectId === p.id ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted/50'}`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-lg">{p.name}</h4>
                          <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">{p.purchaseOrder}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{p.customerName}</p>
                        <div className="text-xs font-semibold flex gap-3 mt-2">
                           <span>Objetivo: <span className="text-primary">${p.targetSaleAmount.toLocaleString()}</span></span>
                           <span className="text-muted-foreground">|</span>
                           <span>Estado: <span className="text-green-500 uppercase">{p.status}</span></span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant={selectedProjectId === p.id ? "default" : "outline"} size="sm" onClick={() => setSelectedProjectId(p.id)}>
                          {selectedProjectId === p.id ? "Activo" : "Seleccionar"}
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteProject(p.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  )) : (
                    <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-2">
                      <Briefcase className="h-12 w-12 opacity-10" />
                      <p>No hay proyectos SV registrados.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="purchases">
          {!selectedProjectId ? (
             <div className="flex flex-col items-center justify-center py-20 bg-secondary/20 rounded-lg border border-dashed">
                <Briefcase className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                <p className="text-muted-foreground">Seleccione un proyecto para comenzar la importación de compras.</p>
                <Button variant="link" onClick={() => setActiveTab('projects')}>Ir a Proyectos</Button>
             </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileCode className="h-5 w-5 text-accent" /> Importación DTE El Salvador</CardTitle>
                    <CardDescription>Suba o arrastre el JSON del proveedor para vincular al proyecto <strong>{currentProject?.name}</strong>.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Proveedor emisor</Label>
                      <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar emisor" /></SelectTrigger>
                        <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    {/* Drag and Drop Zone */}
                    <div 
                      className={cn(
                        "relative border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center gap-4 cursor-pointer",
                        isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted hover:border-primary/50"
                      )}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".json" 
                        onChange={handleFileUpload} 
                      />
                      <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                        <Upload className={cn("h-8 w-8 text-muted-foreground", isDragging && "text-primary animate-bounce")} />
                      </div>
                      <div className="text-center">
                        <p className="font-bold">Buscar o arrastrar archivo JSON</p>
                        <p className="text-xs text-muted-foreground mt-1">Formato DTE SV aceptado</p>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                      <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">O pegar contenido manual</span></div>
                    </div>

                    <Textarea 
                      placeholder="Pegue el contenido JSON aquí..." 
                      className="min-h-[120px] font-code text-xs bg-black/20" 
                      value={jsonInput} 
                      onChange={e => setJsonInput(e.target.value)} 
                    />

                    <Button className="w-full h-12 gap-2" onClick={() => handleProcessData()} disabled={isProcessing || !jsonInput}>
                      {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : "Importar y Analizar Datos"}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card className="h-fit sticky top-24">
                <CardHeader>
                  <CardTitle>Vista Previa del Gasto</CardTitle>
                </CardHeader>
                <CardContent>
                  {mappedData ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-secondary rounded-lg border">
                           <Label className="text-[10px] text-muted-foreground uppercase">Ref. Control</Label>
                           <p className="text-sm font-bold truncate">{mappedData.invoiceNumber || 'Sin Ref'}</p>
                        </div>
                        <div className="p-3 bg-secondary rounded-lg border">
                           <Label className="text-[10px] text-muted-foreground uppercase">Fecha Emisión</Label>
                           <p className="text-sm font-bold">{mappedData.issueDate || 'N/D'}</p>
                        </div>
                      </div>
                      
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-[11px]">
                          <thead className="bg-muted"><tr><th className="p-2 text-left">Concepto</th><th className="p-2 text-right">Monto ($)</th></tr></thead>
                          <tbody className="divide-y">
                            {mappedData.items?.map((it, idx) => (
                              <tr key={idx}><td className="p-2 opacity-80">{it.description}</td><td className="p-2 text-right font-mono">${it.lineTotal?.toFixed(2)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="space-y-1 p-4 bg-primary/5 rounded-lg border border-primary/20">
                         <div className="flex justify-between text-xs"><span>Subtotal SV:</span><span>${mappedData.subtotal?.toFixed(2)}</span></div>
                         <div className="flex justify-between text-xs"><span>Impuestos:</span><span>${mappedData.taxAmount?.toFixed(2)}</span></div>
                         <div className="flex justify-between text-lg font-bold text-primary mt-2"><span>Total a Pagar:</span><span>${mappedData.totalAmount?.toFixed(2)}</span></div>
                      </div>

                      <Button className="w-full bg-primary" onClick={handleSavePurchase}>Confirmar e Inyectar al Proyecto</Button>
                    </div>
                  ) : (
                    <div className="py-24 flex flex-col items-center justify-center text-muted-foreground text-center px-8 border-2 border-dashed rounded-lg opacity-40">
                      <FileJson className="h-10 w-10 mb-2" />
                      <p className="text-sm italic">Cargue un archivo DTE para visualizar el desglose de costos.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="comparison">
          {!selectedProjectId ? (
             <div className="py-20 text-center">Seleccione un proyecto para la conciliación de factura final.</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-destructive/5 border-destructive/20 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Gastos Reales Acumulados</CardTitle></CardHeader>
                  <CardContent><div className="text-3xl font-bold">${projectCosts.toLocaleString()}</div></CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Venta Objetivo SV</CardTitle></CardHeader>
                  <CardContent><div className="text-3xl font-bold">${currentProject?.targetSaleAmount.toLocaleString()}</div></CardContent>
                </Card>
                <Card className={cn("shadow-sm", projectInvoices > 0 ? "bg-accent/10 border-accent/20" : "bg-muted/50")}>
                  <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Facturado Realmente</CardTitle></CardHeader>
                  <CardContent><div className="text-3xl font-bold">${projectInvoices.toLocaleString()}</div></CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" /> Registrar Factura de Venta SV</CardTitle>
                    <CardDescription>Cargue el JSON de la factura que emitió para conciliar contra el presupuesto.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <div 
                      className={cn(
                        "relative border-2 border-dashed rounded-xl p-6 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer",
                        isDragging ? "border-primary bg-primary/5" : "border-muted"
                      )}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <p className="text-sm font-medium">Arrastre la factura emitida</p>
                    </div>
                    <Textarea placeholder="Contenido del DTE emitido..." className="min-h-[120px] font-code" value={jsonInput} onChange={e => setJsonInput(e.target.value)} />
                    <Button className="w-full h-12 gap-2" onClick={() => handleProcessData()} disabled={isProcessing || !jsonInput}>Validar y Analizar</Button>
                  </CardContent>
                </Card>

                <Card className="border-accent/20">
                  <CardHeader>
                    <CardTitle>Analítica de Desviación</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {mappedData ? (
                      <div className="space-y-6">
                        <div className="space-y-4 p-4 bg-accent/5 rounded-xl border border-accent/10">
                           <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Monto Factura Emitida:</span><span className="text-xl font-bold">${mappedData.totalAmount?.toFixed(2)}</span></div>
                           <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Objetivo del Proyecto:</span><span className="text-sm font-medium">${currentProject?.targetSaleAmount.toFixed(2)}</span></div>
                           <div className="border-t pt-3 flex justify-between items-end">
                              <span className="text-sm font-bold">Diferencia Final:</span>
                              <div className="text-right">
                                <span className={cn(
                                  "text-2xl font-black",
                                  Math.abs((mappedData.totalAmount || 0) - (currentProject?.targetSaleAmount || 0)) < 1 ? 'text-green-500' : 'text-orange-500'
                                )}>
                                   ${((mappedData.totalAmount || 0) - (currentProject?.targetSaleAmount || 0)).toFixed(2)}
                                </span>
                                <p className="text-[10px] text-muted-foreground font-mono">DESVIACIÓN PRESUPUESTARIA</p>
                              </div>
                           </div>
                        </div>

                        {Math.abs((mappedData.totalAmount || 0) - (currentProject?.targetSaleAmount || 0)) > 1 && (
                          <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg text-xs text-orange-600 flex gap-3">
                            <Upload className="h-5 w-5 shrink-0" />
                            <p><strong>Atención Fiscal:</strong> La factura cargada no coincide con el monto objetivo definido para este proyecto SV. Revise el DTE antes de finalizar.</p>
                          </div>
                        )}
                        
                        <Button className="w-full h-12 bg-accent hover:bg-accent/90" onClick={handleSaveFinalInvoice}>Finalizar Conciliación y Registrar Venta</Button>
                      </div>
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center text-muted-foreground italic opacity-50">
                        <Calculator className="h-10 w-10 mb-2" />
                        <p>Analice la factura emitida para ver la comparativa de ganancias.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  )
}
