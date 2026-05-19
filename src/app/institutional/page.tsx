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
import { useLedgerStore, type Project } from "@/lib/store"
import { aiJsonKeyMapper, type AiJsonKeyMapperOutput } from "@/ai/flows/ai-json-key-mapper"
import { Zap, Loader2, CheckCircle2, AlertCircle, FileJson, ArrowRight, DollarSign, Plus, Briefcase, Calculator, ReceiptText, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"

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

  // AI Processor State
  const [jsonInput, setJsonInput] = React.useState('')
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [mappedData, setMappedData] = React.useState<AiJsonKeyMapperOutput | null>(null)
  const [selectedSupplierId, setSelectedSupplierId] = React.useState('')

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

  const handleProcessAI = async () => {
    if (!jsonInput.trim()) return
    try {
      setIsProcessing(true)
      const result = await aiJsonKeyMapper({ invoiceJsonString: jsonInput })
      setMappedData(result)
      toast({ title: "Mapeo IA Exitoso", description: "Datos extraídos correctamente." })
    } catch (error) {
      toast({ title: "Error", description: "No se pudo procesar el JSON.", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSavePurchase = () => {
    if (!mappedData || !selectedSupplierId || !selectedProjectId) {
      toast({ title: "Información faltante", description: "Seleccione proveedor y proyecto.", variant: "destructive" })
      return
    }
    const supplier = suppliers.find(s => s.id === selectedSupplierId)
    addTransaction({
      invoiceNumber: mappedData.invoiceNumber || `PUR-${Date.now()}`,
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
          <TabsTrigger value="purchases" className="gap-2"><Plus className="h-4 w-4" /> Registrar Compras</TabsTrigger>
          <TabsTrigger value="comparison" className="gap-2"><Calculator className="h-4 w-4" /> Comparación y Factura</TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Nuevo Proyecto</CardTitle>
                <CardDescription>Defina el presupuesto y la orden de compra.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre del Proyecto</Label>
                  <Input placeholder="Ej. Licitación Hospital Central" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Orden de Compra (OC)</Label>
                  <Input placeholder="Ej. OC-2024-001" value={newProject.purchaseOrder} onChange={e => setNewProject({...newProject, purchaseOrder: e.target.value})} />
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
                <Button className="w-full bg-accent hover:bg-accent/90" onClick={handleCreateProject}>Crear Proyecto</Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Listado de Proyectos</CardTitle>
                <CardDescription>Gestión de presupuestos institucionales activos.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projects.length > 0 ? projects.map(p => (
                    <div key={p.id} className={`p-4 rounded-lg border flex items-center justify-between transition-all ${selectedProjectId === p.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold">{p.name}</h4>
                          <Badge variant="outline" className="text-[10px]">{p.purchaseOrder}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{p.customerName}</p>
                        <div className="text-xs font-medium">Objetivo: <span className="text-primary">${p.targetSaleAmount.toLocaleString()}</span></div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant={selectedProjectId === p.id ? "default" : "outline"} size="sm" onClick={() => setSelectedProjectId(p.id)}>
                          {selectedProjectId === p.id ? "Seleccionado" : "Seleccionar"}
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteProject(p.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  )) : (
                    <div className="py-12 text-center text-muted-foreground">No hay proyectos registrados.</div>
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
                <p>Seleccione un proyecto en la pestaña "Proyectos" para añadir compras.</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FileJson className="h-5 w-5 text-accent" /> Importar Factura de Proveedor</CardTitle>
                  <CardDescription>Pegue el JSON del proveedor para mapear costos al proyecto <strong>{currentProject?.name}</strong>.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Proveedor</Label>
                    <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger>
                      <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Payload JSON</Label>
                    <Textarea placeholder="Pegue el JSON aquí..." className="min-h-[200px] font-code text-sm bg-black/30" value={jsonInput} onChange={e => setJsonInput(e.target.value)} />
                  </div>
                  <Button className="w-full h-12 gap-2" onClick={handleProcessAI} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <><Zap className="h-5 w-5 fill-current" /> Procesar con IA</>}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Previsualización de Costos</CardTitle>
                </CardHeader>
                <CardContent>
                  {mappedData ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-3 bg-secondary rounded-md">Ref: {mappedData.invoiceNumber || 'N/D'}</div>
                        <div className="p-3 bg-secondary rounded-md">Fecha: {mappedData.issueDate || 'N/D'}</div>
                      </div>
                      <div className="border rounded-md max-h-[200px] overflow-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted sticky top-0"><tr><th className="p-2 text-left">Item</th><th className="p-2 text-right">Total</th></tr></thead>
                          <tbody>{mappedData.items?.map((it, idx) => (<tr key={idx} className="border-t"><td className="p-2">{it.description}</td><td className="p-2 text-right">${it.lineTotal?.toFixed(2)}</td></tr>))}</tbody>
                        </table>
                      </div>
                      <div className="text-xl font-bold text-right text-primary">Total Compra: ${mappedData.totalAmount?.toFixed(2)}</div>
                      <Button className="w-full bg-primary" onClick={handleSavePurchase}>Confirmar Gasto en Proyecto</Button>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground text-center px-8">Mapee un JSON para ver los costos antes de cargarlos.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="comparison">
          {!selectedProjectId ? (
             <div className="py-20 text-center">Seleccione un proyecto para ver la comparación.</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-destructive/5 border-destructive/20">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Costos Acumulados</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">${projectCosts.toLocaleString()}</div></CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Objetivo de Venta</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">${currentProject?.targetSaleAmount.toLocaleString()}</div></CardContent>
                </Card>
                <Card className="bg-accent/5 border-accent/20">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Facturado Real</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">${projectInvoices.toLocaleString()}</div></CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" /> Cargar Factura Emitida</CardTitle>
                    <CardDescription>Valide que lo facturado coincida con el objetivo para evitar desvíos.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea placeholder="Pegue el JSON de la factura que emitió..." className="min-h-[150px] font-code" value={jsonInput} onChange={e => setJsonInput(e.target.value)} />
                    <Button className="w-full gap-2" onClick={handleProcessAI} disabled={isProcessing}>Procesar Factura Emitida</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Análisis de Desviación</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {mappedData ? (
                      <div className="space-y-6">
                        <div className="space-y-2">
                           <div className="flex justify-between text-sm"><span>Monto Factura IA:</span><span className="font-bold">${mappedData.totalAmount?.toFixed(2)}</span></div>
                           <div className="flex justify-between text-sm"><span>Objetivo Proyecto:</span><span>${currentProject?.targetSaleAmount.toFixed(2)}</span></div>
                           <hr />
                           <div className="flex justify-between text-lg font-headline">
                              <span>Diferencia:</span>
                              <span className={Math.abs((mappedData.totalAmount || 0) - (currentProject?.targetSaleAmount || 0)) < 1 ? 'text-green-500' : 'text-orange-500'}>
                                 ${((mappedData.totalAmount || 0) - (currentProject?.targetSaleAmount || 0)).toFixed(2)}
                              </span>
                           </div>
                        </div>
                        {Math.abs((mappedData.totalAmount || 0) - (currentProject?.targetSaleAmount || 0)) > 1 && (
                          <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded text-xs text-orange-500 flex gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            Atención: La factura no coincide exactamente con el monto de venta objetivo.
                          </div>
                        )}
                        <Button className="w-full bg-accent" onClick={handleSaveFinalInvoice}>Finalizar y Registrar Venta</Button>
                      </div>
                    ) : (
                      <div className="h-48 flex items-center justify-center text-muted-foreground italic">Procese su factura final para comparar contra el presupuesto.</div>
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
