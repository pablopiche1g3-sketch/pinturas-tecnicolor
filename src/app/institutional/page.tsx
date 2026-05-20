
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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { useLedgerStore, type ProjectProduct } from "@/lib/store"
import { aiJsonKeyMapper, type AiJsonKeyMapperOutput } from "@/ai/flows/ai-json-key-mapper"
import { Loader2, FileJson, DollarSign, Plus, Briefcase, Calculator, ReceiptText, Trash2, Upload, FileCode, CheckCircle2, Box, Info, XCircle, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function InstitutionalModule() {
  const { entities, projects, transactions, addProject, deleteProject, addTransaction, voidTransaction } = useLedgerStore()
  const { toast } = useToast()
  
  const [mounted, setMounted] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState('projects')
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>('')
  const [isProjectDialogOpen, setIsProjectDialogOpen] = React.useState(false)
  
  // Project Creation State
  const [newProject, setNewProject] = React.useState({
    name: '',
    purchaseOrder: '',
    targetSaleAmount: 0,
    customerId: ''
  })
  const [newProjectProducts, setNewProjectProducts] = React.useState<ProjectProduct[]>([])
  const [tempProduct, setTempProduct] = React.useState<ProjectProduct>({
    code: '',
    description: '',
    quantity: 1,
    unitPrice: 0
  })

  // Data Processor State
  const [jsonInput, setJsonInput] = React.useState('')
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [mappedData, setMappedData] = React.useState<AiJsonKeyMapperOutput | null>(null)
  const [selectedSupplierId, setSelectedSupplierId] = React.useState('')
  const [isDragging, setIsDragging] = React.useState(false)

  // Void Logic State
  const [voidReason, setVoidReason] = React.useState('')
  const [transactionToVoid, setTransactionToVoid] = React.useState<string>('')
  
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const fileInputEmitRef = React.useRef<HTMLInputElement>(null)
  const fileInputVoidRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const customers = entities.filter(e => e.type === 'customer')
  const suppliers = entities.filter(e => e.type === 'supplier')
  const currentProject = projects.find(p => p.id === selectedProjectId)
  const projectTransactions = transactions.filter(t => t.projectId === selectedProjectId && !t.isVoided)
  const voidedTransactions = transactions.filter(t => t.projectId === selectedProjectId && t.isVoided)
  
  const projectCosts = projectTransactions.filter(t => t.type === 'purchase').reduce((acc, curr) => acc + curr.totalAmount, 0)
  const projectInvoices = projectTransactions.filter(t => t.type === 'sale').reduce((acc, curr) => acc + curr.totalAmount, 0)

  const handleAddProductToProject = () => {
    if (!tempProduct.code || !tempProduct.description) return
    setNewProjectProducts([...newProjectProducts, tempProduct])
    setTempProduct({ code: '', description: '', quantity: 1, unitPrice: 0 })
  }

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
      expectedProducts: newProjectProducts,
      status: 'active'
    })
    setNewProject({ name: '', purchaseOrder: '', targetSaleAmount: 0, customerId: '' })
    setNewProjectProducts([])
    setIsProjectDialogOpen(false)
    toast({ title: "Proyecto Creado", description: "El proyecto y sus productos se han registrado exitosamente." })
  }

  const handleProcessData = async (content?: string) => {
    const rawData = content || jsonInput
    if (!rawData.trim()) return
    try {
      setIsProcessing(true)
      const result = await aiJsonKeyMapper({ invoiceJsonString: rawData })
      setMappedData(result)
      toast({ title: "Documento Procesado", description: "Se han extraído los datos del DTE correctamente." })
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
    if (file && (file.type === "application/json" || file.name.endsWith('.json'))) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        setJsonInput(content)
        handleProcessData(content)
      }
      reader.readAsText(file)
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
    toast({ title: "Factura Emitida", description: "La venta se ha vinculado al proyecto y registrado en el libro mayor." })
  }

  const handleVoidTransaction = () => {
    if (!transactionToVoid && !mappedData) {
      toast({ title: "Error", description: "Seleccione una factura o cargue un DTE.", variant: "destructive" })
      return
    }
    if (!voidReason) {
      toast({ title: "Error", description: "Proporcione un motivo para la anulación.", variant: "destructive" })
      return
    }

    if (transactionToVoid) {
      voidTransaction(transactionToVoid, voidReason)
    } else if (mappedData) {
      // Si se cargó un DTE nuevo para registrar como anulado
      addTransaction({
        invoiceNumber: mappedData.invoiceNumber || `VOID-${Date.now()}`,
        issueDate: mappedData.issueDate || new Date().toISOString(),
        entityId: 'manual',
        entityName: mappedData.supplierName || mappedData.customerName || 'N/A',
        projectId: selectedProjectId,
        type: 'sale',
        items: [],
        subtotal: mappedData.subtotal || 0,
        taxAmount: mappedData.taxAmount || 0,
        totalAmount: mappedData.totalAmount || 0,
        costBasis: 0,
        gain: 0,
        isVoided: true,
        voidReason: voidReason
      })
    }

    setTransactionToVoid('')
    setVoidReason('')
    setMappedData(null)
    setJsonInput('')
    toast({ title: "Documento Anulado", description: "El registro se ha procesado correctamente." })
  }

  if (!mounted) return null

  return (
    <AppLayout>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-secondary p-1">
          <TabsTrigger value="projects" className="gap-2"><Briefcase className="h-4 w-4" /> Proyectos</TabsTrigger>
          <TabsTrigger value="purchases" className="gap-2"><Plus className="h-4 w-4" /> Importar Compras DTE</TabsTrigger>
          <TabsTrigger value="voided" className="gap-2"><XCircle className="h-4 w-4" /> Facturas Anuladas</TabsTrigger>
          <TabsTrigger value="comparison" className="gap-2"><Calculator className="h-4 w-4" /> Conciliación Final</TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold font-headline">Gestión de Proyectos Institucionales</h3>
                <p className="text-sm text-muted-foreground">Administre sus presupuestos y órdenes de compra maestras.</p>
              </div>
              
              <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20">
                    <Plus className="h-4 w-4" /> Nuevo Proyecto
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px]">
                  <DialogHeader>
                    <DialogTitle>Registrar Nuevo Proyecto</DialogTitle>
                    <CardDescription>Configure los límites financieros y los productos de la OC maestra.</CardDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div className="space-y-4 border-r pr-6">
                      <h4 className="font-bold text-sm uppercase text-muted-foreground border-b pb-2">Datos Generales</h4>
                      <div className="space-y-2">
                        <Label>Nombre del Proyecto</Label>
                        <Input 
                          placeholder="Ej. Licitación Hospital Central" 
                          value={newProject.name} 
                          onChange={e => setNewProject({...newProject, name: e.target.value})} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Orden de Compra (OC)</Label>
                        <Input 
                          placeholder="Ej. OC-2024-SV-001" 
                          value={newProject.purchaseOrder} 
                          onChange={e => setNewProject({...newProject, purchaseOrder: e.target.value})} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cliente Institucional</Label>
                        <Select value={newProject.customerId} onValueChange={val => setNewProject({...newProject, customerId: val})}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                          <SelectContent>
                            {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Monto de Venta Objetivo ($)</Label>
                        <Input 
                          type="number" 
                          value={newProject.targetSaleAmount} 
                          onChange={e => setNewProject({...newProject, targetSaleAmount: Number(e.target.value)})} 
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-bold text-sm uppercase text-muted-foreground border-b pb-2 flex items-center gap-2">
                        <Box className="h-4 w-4" /> Productos de la OC
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Código</Label>
                          <Input className="h-8 text-xs" value={tempProduct.code} onChange={e => setTempProduct({...tempProduct, code: e.target.value})} placeholder="P001" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Cant.</Label>
                          <Input className="h-8 text-xs" type="number" value={tempProduct.quantity} onChange={e => setTempProduct({...tempProduct, quantity: Number(e.target.value)})} />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-[10px]">Descripción</Label>
                          <Input className="h-8 text-xs" value={tempProduct.description} onChange={e => setTempProduct({...tempProduct, description: e.target.value})} placeholder="Suministro de..." />
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={handleAddProductToProject}>
                        <Plus className="h-3 w-3 mr-1" /> Añadir Producto
                      </Button>

                      <ScrollArea className="h-[120px] rounded-md border bg-muted/20 p-2">
                        {newProjectProducts.map((p, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[10px] py-1 border-b last:border-0">
                            <div className="flex flex-col">
                              <span className="font-bold text-accent">{p.code}</span>
                              <span className="truncate w-32">{p.description}</span>
                            </div>
                            <span className="font-mono">x{p.quantity}</span>
                            <Button variant="ghost" size="icon" className="h-4 w-4 text-destructive" onClick={() => setNewProjectProducts(newProjectProducts.filter((_, i) => i !== idx))}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button className="w-full bg-accent hover:bg-accent/90" onClick={handleCreateProject}>Crear Proyecto</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Proyectos Activos</CardTitle>
                <CardDescription>Administre las compras y ventas vinculadas a códigos de productos específicos.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.length > 0 ? projects.map(p => (
                    <div 
                      key={p.id} 
                      className={cn(
                        "relative p-5 rounded-xl border transition-all cursor-pointer group",
                        selectedProjectId === p.id 
                          ? "border-primary bg-primary/5 ring-1 ring-primary shadow-md" 
                          : "hover:border-muted-foreground/30 hover:bg-muted/50 border-border"
                      )}
                      onClick={() => setSelectedProjectId(p.id)}
                    >
                      {selectedProjectId === p.id && (
                        <CheckCircle2 className="absolute top-4 right-4 h-5 w-5 text-primary" />
                      )}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <h4 className="font-bold text-lg pr-6">{p.name}</h4>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-background font-mono text-[10px]">{p.purchaseOrder}</Badge>
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">{p.status}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Box className="h-3 w-3" />
                          <span>{p.expectedProducts?.length || 0} productos registrados</span>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">{p.customerName}</p>
                          <div className="flex justify-between items-end">
                            <div className="space-y-0.5">
                              <p className="text-[10px] uppercase text-muted-foreground font-bold">Venta Objetivo</p>
                              <p className="text-sm font-bold text-primary">${p.targetSaleAmount.toLocaleString()}</p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteProject(p.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {selectedProjectId === p.id && (
                          <div className="pt-2 flex flex-wrap gap-2">
                             <Button size="sm" className="flex-1 text-[10px] h-7 bg-primary/20 text-primary hover:bg-primary/30" onClick={() => setActiveTab('purchases')}>
                               Compras
                             </Button>
                             <Button size="sm" className="flex-1 text-[10px] h-7 bg-destructive/20 text-destructive hover:bg-destructive/30" onClick={() => setActiveTab('voided')}>
                               Anulaciones
                             </Button>
                             <Button size="sm" className="flex-1 text-[10px] h-7 bg-accent/20 text-accent hover:bg-accent/30" onClick={() => setActiveTab('comparison')}>
                               Conciliación
                             </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-full py-20 text-center text-muted-foreground flex flex-col items-center gap-2 border-2 border-dashed rounded-xl opacity-40">
                      <Briefcase className="h-12 w-12" />
                      <p>No hay proyectos registrados. Comience creando uno nuevo.</p>
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
                <p className="text-muted-foreground">Seleccione un proyecto en la pestaña anterior para comenzar la importación de compras.</p>
                <Button variant="link" onClick={() => setActiveTab('projects')}>Ir a Proyectos</Button>
             </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileCode className="h-5 w-5 text-accent" /> Importación DTE de Proveedor</CardTitle>
                    <CardDescription>Cargue el JSON del proveedor para vincular al proyecto <strong>{currentProject?.name}</strong>.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Proveedor emisor</Label>
                      <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar emisor" /></SelectTrigger>
                        <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

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
                        <p className="font-bold">Buscar o arrastrar archivo JSON (DTE)</p>
                        <p className="text-xs text-muted-foreground mt-1">Haga clic para seleccionar o suelte el archivo aquí</p>
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
                         <div className="flex justify-between text-xs"><span>Subtotal:</span><span>${mappedData.subtotal?.toFixed(2)}</span></div>
                         <div className="flex justify-between text-xs"><span>Impuestos:</span><span>${mappedData.taxAmount?.toFixed(2)}</span></div>
                         <div className="flex justify-between lg:text-lg font-bold text-primary mt-2"><span>Total a Pagar:</span><span>${mappedData.totalAmount?.toFixed(2)}</span></div>
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

        <TabsContent value="voided">
          {!selectedProjectId ? (
            <div className="py-20 text-center flex flex-col items-center gap-4 bg-secondary/10 rounded-lg border border-dashed">
              <AlertTriangle className="h-12 w-12 text-muted-foreground opacity-20" />
              <p className="text-muted-foreground">Seleccione un proyecto para gestionar facturas anuladas.</p>
              <Button variant="outline" onClick={() => setActiveTab('projects')}>Ir a Proyectos</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive"><XCircle className="h-5 w-5" /> Gestión de Documentos Anulados</CardTitle>
                    <CardDescription>Marque documentos como inválidos arrastrando el DTE o seleccionando una factura existente.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div 
                      className={cn(
                        "relative border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center gap-4 cursor-pointer",
                        isDragging ? "border-destructive bg-destructive/5" : "border-muted hover:border-destructive/50"
                      )}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputVoidRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        ref={fileInputVoidRef} 
                        className="hidden" 
                        accept=".json" 
                        onChange={handleFileUpload} 
                      />
                      <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                        <Upload className={cn("h-8 w-8 text-muted-foreground", isDragging && "text-destructive animate-bounce")} />
                      </div>
                      <div className="text-center">
                        <p className="font-bold">Arrastrar DTE Anulado</p>
                        <p className="text-xs text-muted-foreground mt-1">Suelte el archivo JSON para registrar la anulación</p>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                      <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">O seleccionar manualmente</span></div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Documento del Proyecto</Label>
                        <Select value={transactionToVoid} onValueChange={setTransactionToVoid}>
                          <SelectTrigger><SelectValue placeholder="Seleccione factura activa" /></SelectTrigger>
                          <SelectContent>
                            {transactions
                              .filter(t => t.projectId === selectedProjectId && !t.isVoided)
                              .map(t => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.invoiceNumber} - ${t.totalAmount.toFixed(2)}
                                </SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Motivo de Anulación</Label>
                        <Textarea 
                          placeholder="Ej. Error en digitación, devolución, etc." 
                          value={voidReason}
                          onChange={e => setVoidReason(e.target.value)}
                        />
                      </div>
                      <Button variant="destructive" className="w-full" onClick={handleVoidTransaction} disabled={(!transactionToVoid && !mappedData) || !voidReason}>
                        Registrar Anulación
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Historial de Anulaciones</CardTitle>
                </CardHeader>
                <CardContent>
                  {mappedData && (
                    <div className="mb-6 p-4 bg-destructive/5 border border-destructive/20 rounded-lg space-y-2">
                       <p className="text-xs font-bold uppercase text-destructive">Vista Previa de Documento Cargado</p>
                       <div className="flex justify-between text-sm font-mono">
                          <span>Factura: {mappedData.invoiceNumber}</span>
                          <span>Monto: ${mappedData.totalAmount?.toFixed(2)}</span>
                       </div>
                    </div>
                  )}
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Factura #</TableHead>
                          <TableHead>Monto</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {voidedTransactions.length > 0 ? (
                          voidedTransactions.map(t => (
                            <TableRow key={t.id} className="opacity-60">
                              <TableCell className="font-mono text-xs">{t.invoiceNumber}</TableCell>
                              <TableCell className="font-bold text-xs">${t.totalAmount.toFixed(2)}</TableCell>
                              <TableCell className="text-[10px] italic">{t.voidReason}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-20 text-muted-foreground italic text-xs">
                              Sin registros de anulaciones para este proyecto.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="comparison">
          {!selectedProjectId ? (
             <div className="py-20 text-center flex flex-col items-center gap-4 bg-secondary/10 rounded-lg border border-dashed">
                <Briefcase className="h-12 w-12 text-muted-foreground opacity-20" />
                <p className="text-muted-foreground">Seleccione un proyecto para la conciliación de factura final.</p>
                <Button variant="outline" onClick={() => setActiveTab('projects')}>Ir a Proyectos</Button>
             </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-muted/30">
                  <CardHeader className="p-3"><CardTitle className="text-[10px] uppercase text-muted-foreground">Productos en OC</CardTitle></CardHeader>
                  <CardContent className="p-3 pt-0"><div className="text-xl font-bold">{currentProject?.expectedProducts?.length || 0}</div></CardContent>
                </Card>
                <Card className="bg-destructive/5 border-destructive/20 shadow-sm">
                  <CardHeader className="p-3"><CardTitle className="text-[10px] uppercase text-muted-foreground">Gastos Totales</CardTitle></CardHeader>
                  <CardContent className="p-3 pt-0"><div className="text-xl font-bold">${projectCosts.toLocaleString()}</div></CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20 shadow-sm">
                  <CardHeader className="p-3"><CardTitle className="text-[10px] uppercase text-muted-foreground">Venta Objetivo</CardTitle></CardHeader>
                  <CardContent className="p-3 pt-0"><div className="text-xl font-bold">${currentProject?.targetSaleAmount.toLocaleString()}</div></CardContent>
                </Card>
                <Card className={cn("shadow-sm", projectInvoices > 0 ? "bg-accent/10 border-accent/20" : "bg-muted/50")}>
                  <CardHeader className="p-3"><CardTitle className="text-[10px] uppercase text-muted-foreground">Facturado Real</CardTitle></CardHeader>
                  <CardContent className="p-3 pt-0"><div className="text-xl font-bold">${projectInvoices.toLocaleString()}</div></CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" /> Validar Factura Emitida (DTE)</CardTitle>
                    <CardDescription>Compare el JSON de su factura final contra los productos y códigos vinculados al proyecto.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div 
                      className={cn(
                        "relative border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center gap-4 cursor-pointer",
                        isDragging ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"
                      )}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputEmitRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        ref={fileInputEmitRef} 
                        className="hidden" 
                        accept=".json" 
                        onChange={handleFileUpload} 
                      />
                      <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                        <Upload className={cn("h-8 w-8 text-muted-foreground", isDragging && "text-primary animate-bounce")} />
                      </div>
                      <div className="text-center">
                        <p className="font-bold">Buscar o arrastrar DTE emitido</p>
                        <p className="text-xs text-muted-foreground mt-1">Seleccione el archivo JSON de su factura final</p>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                      <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">O pegar contenido manual</span></div>
                    </div>

                    <Textarea placeholder="Contenido del DTE emitido..." className="min-h-[120px] font-code text-xs" value={jsonInput} onChange={e => setJsonInput(e.target.value)} />
                    
                    <Button className="w-full h-12 gap-2" onClick={() => handleProcessData()} disabled={isProcessing || !jsonInput}>
                      {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : "Validar y Analizar Factura"}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-accent/20">
                  <CardHeader>
                    <CardTitle>Análisis de Desviación y Margen</CardTitle>
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

                        {/* Comparativa por códigos */}
                        <div className="space-y-2">
                           <h5 className="text-[10px] font-bold uppercase text-muted-foreground">Validación de Productos por Código</h5>
                           <ScrollArea className="h-[150px] border rounded-lg bg-black/20 p-2">
                              <div className="space-y-2">
                                 {currentProject?.expectedProducts?.map((ep, idx) => {
                                    const match = mappedData.items?.find(mi => mi.description?.toLowerCase().includes(ep.description.toLowerCase()));
                                    return (
                                       <div key={idx} className="flex items-center justify-between text-[11px] p-2 bg-secondary/50 rounded border">
                                          <div className="flex flex-col">
                                             <span className="font-bold">{ep.code} - {ep.description}</span>
                                             <span className="text-muted-foreground italic">Esperado: {ep.quantity} unidades</span>
                                          </div>
                                          <div className="text-right">
                                             {match ? (
                                                <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Vinculado</Badge>
                                             ) : (
                                                <Badge variant="outline" className="text-destructive border-destructive/30">Faltante</Badge>
                                             )}
                                             <p className="mt-1 font-mono">${match?.lineTotal?.toFixed(2) || '0.00'}</p>
                                          </div>
                                       </div>
                                    )
                                 })}
                              </div>
                           </ScrollArea>
                        </div>

                        <div className="p-4 bg-secondary/50 rounded-lg border space-y-2">
                           <div className="flex justify-between text-xs"><span>Costos Totales (Compras):</span><span>${projectCosts.toFixed(2)}</span></div>
                           <div className="flex justify-between font-bold text-sm"><span>Ganancia Proyectada:</span><span className="text-primary">${((mappedData.totalAmount || 0) - projectCosts).toFixed(2)}</span></div>
                        </div>

                        {Math.abs((mappedData.totalAmount || 0) - (currentProject?.targetSaleAmount || 0)) > 1 && (
                          <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg text-xs text-orange-600 flex gap-3">
                            <Info className="h-4 w-4 shrink-0" />
                            <p><strong>Alerta:</strong> El monto de la factura no coincide con el objetivo del proyecto o algunos códigos no fueron detectados.</p>
                          </div>
                        )}
                        
                        <Button className="w-full h-12 bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20" onClick={handleSaveFinalInvoice}>Finalizar Conciliación y Registrar Venta</Button>
                      </div>
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center text-muted-foreground italic opacity-50 border-2 border-dashed rounded-lg">
                        <Calculator className="h-10 w-10 mb-2" />
                        <p className="text-center px-6">Analice la factura emitida para visualizar la comparativa de ganancias y validación de productos por código.</p>
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
