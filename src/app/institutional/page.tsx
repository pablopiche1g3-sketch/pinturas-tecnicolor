"use client"

import * as React from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
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
import { useLedgerStore, type ProjectProduct, type TransactionItem, type Project } from "@/lib/store"
import { aiJsonKeyMapper, type AiJsonKeyMapperOutput } from "@/ai/flows/ai-json-key-mapper"
import { Loader2, Plus, Briefcase, Calculator, ReceiptText, Trash2, Upload, XCircle, Package, ArrowRight, CheckCircle2, FileText, Pencil, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"

export default function InstitutionalModule() {
  const { entities, projects, transactions, addProject, updateProject, deleteProject, addTransaction, voidTransaction, addToInventory } = useLedgerStore()
  const { toast } = useToast()
  
  const [mounted, setMounted] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState('projects')
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>('')
  const [isProjectDialogOpen, setIsProjectDialogOpen] = React.useState(false)
  const [editingProject, setEditingProject] = React.useState<Project | null>(null)
  
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

  const [jsonInput, setJsonInput] = React.useState('')
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [mappedData, setMappedData] = React.useState<AiJsonKeyMapperOutput | null>(null)
  const [selectedSupplierId, setSelectedSupplierId] = React.useState('')
  const [isDragging, setIsDragging] = React.useState(false)
  const [applyRetention, setApplyRetention] = React.useState(false)

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
  
  const projectCosts = projectTransactions.filter(t => t.type === 'purchase').reduce((acc, curr) => acc + curr.totalAmount, 0)

  const getProductProgress = (productCode: string, projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    const txs = transactions.filter(t => t.projectId === projectId && !t.isVoided)
    const received = txs
      .filter(t => t.type === 'purchase')
      .flatMap(t => t.items)
      .filter(i => i.code === productCode)
      .reduce((acc, curr) => acc + curr.quantity, 0)
    
    const expected = project?.expectedProducts.find(p => p.code === productCode)?.quantity || 1
    return Math.min((received / expected) * 100, 100)
  }

  const handleAddProductToProject = () => {
    if (!tempProduct.code || !tempProduct.description) return
    setNewProjectProducts([...newProjectProducts, tempProduct])
    setTempProduct({ code: '', description: '', quantity: 1, unitPrice: 0 })
  }

  const handleCreateOrUpdateProject = () => {
    if (!newProject.name || !newProject.customerId || !newProject.purchaseOrder) {
      toast({ title: "Datos incompletos", description: "Rellene todos los campos del proyecto.", variant: "destructive" })
      return
    }
    const customer = customers.find(c => c.id === newProject.customerId)
    
    if (editingProject) {
      updateProject(editingProject.id, {
        name: newProject.name,
        purchaseOrder: newProject.purchaseOrder,
        targetSaleAmount: newProject.targetSaleAmount,
        customerId: newProject.customerId,
        customerName: customer?.name || 'Cliente Desconocido',
        expectedProducts: newProjectProducts,
      })
      toast({ title: "Proyecto Actualizado", description: "Cambios guardados exitosamente." })
    } else {
      addProject({
        name: newProject.name,
        purchaseOrder: newProject.purchaseOrder,
        targetSaleAmount: newProject.targetSaleAmount,
        customerId: newProject.customerId,
        customerName: customer?.name || 'Cliente Desconocido',
        expectedProducts: newProjectProducts,
        status: 'active'
      })
      toast({ title: "Proyecto Creado", description: "El proyecto se ha registrado exitosamente." })
    }

    setNewProject({ name: '', purchaseOrder: '', targetSaleAmount: 0, customerId: '' })
    setNewProjectProducts([])
    setEditingProject(null)
    setIsProjectDialogOpen(false)
  }

  const openEditProject = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation()
    setEditingProject(project)
    setNewProject({
      name: project.name,
      purchaseOrder: project.purchaseOrder,
      targetSaleAmount: project.targetSaleAmount,
      customerId: project.customerId
    })
    setNewProjectProducts(project.expectedProducts)
    setIsProjectDialogOpen(true)
  }

  const toggleProjectStatus = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation()
    const newStatus = project.status === 'active' ? 'completed' : 'active'
    updateProject(project.id, { status: newStatus })
    toast({ 
      title: newStatus === 'completed' ? "Proyecto Entregado" : "Proyecto Reactivado", 
      description: `El estado del proyecto ha sido actualizado.` 
    })
  }

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm("¿Estás seguro de eliminar este proyecto? Se borrarán todas sus transacciones vinculadas.")) {
      deleteProject(id)
      if (selectedProjectId === id) setSelectedProjectId('')
      toast({ title: "Proyecto Eliminado", variant: "destructive" })
    }
  }

  const handleProcessData = async (content?: string) => {
    const rawData = content || jsonInput
    if (!rawData.trim()) {
       toast({ title: "Sin datos", description: "Por favor cargue un archivo JSON válido.", variant: "destructive" })
       return
    }
    try {
      setIsProcessing(true)
      const result = await aiJsonKeyMapper({ invoiceJsonString: rawData })
      setMappedData(result)
      
      if (activeTab === 'voided') {
        const targetId = result.relatedDocumentNumber || result.invoiceNumber
        const found = transactions.find(t => t.invoiceNumber === targetId || t.id === targetId)
        if (found) {
          setTransactionToVoid(found.id)
          setVoidReason(result.documentType === '07' ? 'Anulación por Nota de Crédito' : 'Ajuste fiscal detectado')
        }
      }

      toast({ title: "Documento Analizado", description: `Tipo de DTE: ${result.documentType || 'Desconocido'}` })
    } catch (error: any) {
      toast({ title: "Error de IA", description: error.message || "No se pudo leer el archivo DTE V3.", variant: "destructive" })
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
      reader.onerror = () => {
        toast({ title: "Error de lectura", description: "No se pudo leer el archivo físico.", variant: "destructive" })
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
    if (!mappedData || !selectedSupplierId || !selectedProjectId || !currentProject) return
    
    const supplier = suppliers.find(s => s.id === selectedSupplierId)
    const rawItems = mappedData.items || []
    
    const validItems: TransactionItem[] = []
    const orphanItems: TransactionItem[] = []
    
    rawItems.forEach(item => {
      const isExpected = currentProject.expectedProducts.some(ep => 
        ep.code === item.code || 
        item.description?.toLowerCase().includes(ep.description.toLowerCase())
      )
      
      const txItem = {
        description: item.description || 'Gasto proveedor',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        lineTotal: item.lineTotal || 0,
        code: item.code || 'S/C'
      }

      if (isExpected) {
        validItems.push(txItem)
      } else {
        orphanItems.push(txItem)
      }
    })

    if (orphanItems.length > 0) {
      toast({
        title: "Productos fuera de OC",
        description: `${orphanItems.length} productos enviados a Inventario Global.`,
        variant: "destructive"
      })
      
      addToInventory(orphanItems.map(oi => ({
        code: oi.code || 'S/C',
        description: oi.description,
        quantity: oi.quantity,
        unitPrice: oi.unitPrice,
        sourceInvoice: mappedData.invoiceNumber || 'Manual'
      })))
    }

    if (validItems.length === 0 && orphanItems.length > 0) {
      setMappedData(null)
      setJsonInput('')
      return
    }

    const subtotal = validItems.reduce((acc, curr) => acc + curr.lineTotal, 0)
    const tax = mappedData.taxAmount || (subtotal * 0.13)
    const total = mappedData.totalAmount || (subtotal + tax + (mappedData.perceptionAmount || 0) - (mappedData.retentionAmount || 0))

    addTransaction({
      invoiceNumber: mappedData.invoiceNumber || `DTE-${Date.now()}`,
      issueDate: mappedData.issueDate || new Date().toISOString(),
      entityId: selectedSupplierId,
      entityName: supplier?.name || '',
      projectId: selectedProjectId,
      type: 'purchase',
      documentType: mappedData.documentType || '03',
      items: validItems,
      subtotal: subtotal,
      taxAmount: tax,
      retentionAmount: mappedData.retentionAmount,
      perceptionAmount: mappedData.perceptionAmount,
      totalAmount: total,
      costBasis: total,
      gain: 0
    })

    setMappedData(null)
    setJsonInput('')
    toast({ title: "Compra Guardada", description: "Movimiento registrado con éxito." })
  }

  const handleSaveFinalInvoice = () => {
    if (!mappedData || !selectedProjectId || !currentProject) return
    
    const subtotal = mappedData.subtotal || 0
    const tax = mappedData.taxAmount || 0
    const retention = applyRetention ? subtotal * 0.01 : (mappedData.retentionAmount || 0)
    const total = (mappedData.totalAmount || (subtotal + tax)) - (applyRetention ? retention : 0)

    const finalItems = (mappedData.items || []).map(i => ({
      code: i.code,
      description: i.description || 'Venta proyecto',
      quantity: i.quantity || 1,
      unitPrice: i.unitPrice || 0,
      lineTotal: i.lineTotal || 0,
    }))

    addTransaction({
      invoiceNumber: mappedData.invoiceNumber || `INV-${Date.now()}`,
      issueDate: mappedData.issueDate || new Date().toISOString(),
      entityId: currentProject.customerId,
      entityName: currentProject.customerName,
      projectId: selectedProjectId,
      type: 'sale',
      documentType: mappedData.documentType || '01',
      items: finalItems,
      subtotal: subtotal,
      taxAmount: tax,
      retentionAmount: retention,
      perceptionAmount: mappedData.perceptionAmount,
      totalAmount: total,
      costBasis: projectCosts,
      gain: total - projectCosts
    })
    setMappedData(null)
    setJsonInput('')
    toast({ title: "Factura Registrada", description: "Venta guardada con éxito." })
  }

  const handleVoidTransaction = () => {
    if (!transactionToVoid) return
    if (!voidReason) {
      toast({ title: "Error", description: "Indique el motivo de anulación.", variant: "destructive" })
      return
    }

    voidTransaction(transactionToVoid, voidReason, mappedData?.invoiceNumber)
    setTransactionToVoid('')
    setVoidReason('')
    setMappedData(null)
    toast({ title: "Anulación Registrada", description: "El documento ha sido invalidado en el sistema." })
  }

  if (!mounted) return null

  return (
    <AppLayout>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <TabsList className="bg-secondary p-1 inline-flex w-auto min-w-full">
            <TabsTrigger value="projects" className="gap-2 whitespace-nowrap"><Briefcase className="h-4 w-4" /> Proyectos</TabsTrigger>
            <TabsTrigger value="purchases" className="gap-2 whitespace-nowrap"><Upload className="h-4 w-4" /> Compras DTE V3</TabsTrigger>
            <TabsTrigger value="voided" className="gap-2 whitespace-nowrap"><XCircle className="h-4 w-4" /> Anulaciones</TabsTrigger>
            <TabsTrigger value="comparison" className="gap-2 whitespace-nowrap"><Calculator className="h-4 w-4" /> Conciliación</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="projects">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold font-headline text-foreground">Control de Proyectos</h3>
                <p className="text-sm text-muted-foreground">Gestione presupuestos y suministros autorizados.</p>
              </div>
              
              <Dialog open={isProjectDialogOpen} onOpenChange={(open) => {
                setIsProjectDialogOpen(open)
                if (!open) {
                  setEditingProject(null)
                  setNewProject({ name: '', purchaseOrder: '', targetSaleAmount: 0, customerId: '' })
                  setNewProjectProducts([])
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-primary hover:bg-primary/90 w-full sm:w-auto">
                    <Plus className="h-4 w-4" /> Nuevo Proyecto
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px] w-[95vw] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingProject ? 'Editar Proyecto' : 'Configurar Proyecto y OC'}</DialogTitle>
                    <CardDescription>Defina los productos esperados para el control de inventario.</CardDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div className="space-y-4 md:border-r md:pr-6">
                      <div className="space-y-2">
                        <Label>Nombre del Proyecto</Label>
                        <Input value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} placeholder="ej. Hospital El Salvador" />
                      </div>
                      <div className="space-y-2">
                        <Label>Orden de Compra</Label>
                        <Input value={newProject.purchaseOrder} onChange={e => setNewProject({...newProject, purchaseOrder: e.target.value})} placeholder="OC-2024-SV" />
                      </div>
                      <div className="space-y-2">
                        <Label>Cliente</Label>
                        <Select value={newProject.customerId} onValueChange={val => setNewProject({...newProject, customerId: val})}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                          <SelectContent>
                            {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Monto Venta Objetivo ($)</Label>
                        <Input type="number" value={newProject.targetSaleAmount} onChange={e => setNewProject({...newProject, targetSaleAmount: Number(e.target.value)})} />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-bold text-xs uppercase text-muted-foreground">Productos de la OC</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input className="h-8 text-xs" placeholder="Código SV" value={tempProduct.code} onChange={e => setTempProduct({...tempProduct, code: e.target.value})} />
                        <Input className="h-8 text-xs" type="number" placeholder="Cantidad" value={tempProduct.quantity} onChange={e => setTempProduct({...tempProduct, quantity: Number(e.target.value)})} />
                        <Input className="sm:col-span-2 h-8 text-xs" placeholder="Descripción del producto" value={tempProduct.description} onChange={e => setTempProduct({...tempProduct, description: e.target.value})} />
                      </div>
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={handleAddProductToProject}>Añadir Item</Button>
                      <ScrollArea className="h-[120px] rounded border bg-muted/20 p-2">
                        {newProjectProducts.map((p, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[10px] py-1 border-b">
                            <span className="truncate pr-2">{p.code} - {p.description} (x{p.quantity})</span>
                            <Button variant="ghost" size="icon" className="h-4 w-4 shrink-0" onClick={() => setNewProjectProducts(newProjectProducts.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button className="w-full bg-primary" onClick={handleCreateOrUpdateProject}>
                      {editingProject ? 'Guardar Cambios' : 'Guardar Proyecto'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map(p => (
                <Card 
                  key={p.id} 
                  className={cn(
                    "cursor-pointer border-2 transition-all flex flex-col", 
                    selectedProjectId === p.id ? "border-primary bg-primary/5" : "hover:border-primary/50",
                    p.status === 'completed' && "opacity-80 grayscale-[0.5]"
                  )}
                  onClick={() => setSelectedProjectId(p.id)}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-sm font-bold text-foreground truncate">{p.name}</CardTitle>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="text-[9px] uppercase font-mono shrink-0">{p.purchaseOrder}</Badge>
                        {p.status === 'completed' && <Badge className="text-[8px] bg-green-500 border-none">ENTREGADO</Badge>}
                      </div>
                    </div>
                    <CardDescription className="text-xs truncate">{p.customerName}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-4 flex-1">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
                        <span>Suministros</span>
                        <span>Obj: ${p.targetSaleAmount.toLocaleString()}</span>
                      </div>
                      {p.expectedProducts.slice(0, 2).map(ep => (
                        <div key={ep.code} className="space-y-1">
                          <div className="flex justify-between text-[9px]">
                            <span className="truncate max-w-[150px]">{ep.description}</span>
                            <span>{getProductProgress(ep.code, p.id).toFixed(0)}%</span>
                          </div>
                          <Progress value={getProductProgress(ep.code, p.id)} className="h-1" />
                        </div>
                      ))}
                      {p.expectedProducts.length > 2 && (
                        <p className="text-[9px] text-center text-muted-foreground">+{p.expectedProducts.length - 2} productos más...</p>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="p-2 pt-0 border-t flex justify-between gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 hover:bg-accent"
                      onClick={(e) => openEditProject(e, p)}
                      title="Editar Proyecto"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn(
                        "h-8 w-8",
                        p.status === 'completed' ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-accent"
                      )}
                      onClick={(e) => toggleProjectStatus(e, p)}
                      title={p.status === 'completed' ? 'Reactivar Proyecto' : 'Entregar Proyecto'}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleDeleteProject(e, p.id)}
                      title="Eliminar Proyecto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="purchases">
          {!selectedProjectId ? (
            <div className="py-20 text-center border-2 border-dashed rounded-lg opacity-40 flex flex-col items-center gap-4 px-4">
               <Package className="h-10 w-10 text-muted-foreground" />
               <p className="text-muted-foreground text-sm">Seleccione un proyecto para registrar facturas o Créditos Fiscales DTE V3.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader><CardTitle className="text-lg">Importar Compra / CCF</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar Proveedor" /></SelectTrigger>
                    <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>

                  <div 
                    className={cn("border-2 border-dashed rounded-xl p-6 md:p-8 flex flex-col items-center justify-center gap-4 cursor-pointer", isDragging ? "bg-primary/5 border-primary" : "border-border")}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileUpload} />
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <div className="text-center px-2">
                      <p className="text-sm font-bold text-foreground">Arrastrar Factura o CCF V3</p>
                      <p className="text-[10px] text-muted-foreground uppercase mt-1">Soporta Códigos 01 y 03 de Hacienda</p>
                    </div>
                  </div>
                  <Button className="w-full h-12 bg-primary hover:bg-primary/90" onClick={() => handleProcessData()} disabled={isProcessing || !jsonInput}>
                    {isProcessing ? <Loader2 className="animate-spin mr-2" /> : null}
                    {isProcessing ? "Procesando..." : "Validar contra OC"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Validación de Suministros</CardTitle></CardHeader>
                <CardContent>
                  {mappedData ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="bg-primary/10 text-primary uppercase text-[10px]">
                           DTE TIPO: {mappedData.documentType === '03' ? 'CRÉDITO FISCAL' : 'FACTURA'}
                        </Badge>
                      </div>
                      <div className="border rounded-lg overflow-x-auto">
                        <table className="w-full text-[10px]">
                          <thead className="bg-muted"><tr><th className="p-2 text-left">Código/Item</th><th className="p-2 text-right">Cant.</th><th className="p-2 text-center">Estado OC</th></tr></thead>
                          <tbody className="divide-y">
                            {mappedData.items?.map((it, idx) => {
                              const isExpected = currentProject?.expectedProducts.some(ep => ep.code === it.code || it.description?.toLowerCase().includes(ep.description.toLowerCase()));
                              return (
                                <tr key={idx} className={!isExpected ? "bg-destructive/5" : ""}>
                                  <td className="p-2 min-w-[120px]">
                                    <span className="font-mono text-primary">{it.code}</span> - {it.description}
                                  </td>
                                  <td className="p-2 text-right font-bold">{it.quantity}</td>
                                  <td className="p-2 text-center">
                                    {isExpected ? <Badge className="text-[8px] bg-green-500 border-none">AUTORIZADO</Badge> : <Badge variant="destructive" className="text-[8px] border-none">FUERA DE OC</Badge>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="space-y-1 bg-muted/50 p-3 rounded-lg border">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">IVA (13%):</span>
                          <span className="font-bold">${mappedData.taxAmount?.toFixed(2)}</span>
                        </div>
                        {mappedData.perceptionAmount && (
                           <div className="flex justify-between text-[10px] text-primary">
                             <span>IVA Percibido (1%):</span>
                             <span className="font-bold">+${mappedData.perceptionAmount.toFixed(2)}</span>
                           </div>
                        )}
                        <div className="flex justify-between items-center pt-2 mt-2 border-t">
                          <span className="text-xs font-black uppercase">TOTAL DTE:</span>
                          <span className="text-lg font-black text-foreground">${mappedData.totalAmount?.toFixed(2)}</span>
                        </div>
                      </div>
                      <Button className="w-full bg-primary" onClick={handleSavePurchase}>Confirmar Carga</Button>
                    </div>
                  ) : <div className="py-20 text-center text-muted-foreground italic text-xs px-4">Cargue el JSON DTE para validar los ítems de ingreso.</div>}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="voided">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader><CardTitle className="text-lg">Anulación / Nota de Crédito (Tipo 07)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div 
                  className={cn("border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer", isDragging ? "bg-destructive/5 border-destructive" : "bg-muted/50")}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputVoidRef.current?.click()}
                >
                  <input type="file" ref={fileInputVoidRef} className="hidden" accept=".json" onChange={handleFileUpload} />
                  <FileText className="h-8 w-8 text-destructive opacity-50" />
                  <p className="text-xs font-bold text-foreground">Cargar Nota de Crédito o DTE a Anular</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Transacción original</Label>
                    <Select value={transactionToVoid} onValueChange={setTransactionToVoid}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar transacción" /></SelectTrigger>
                      <SelectContent>
                        {transactions.filter(t => !t.isVoided).map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            <div className="flex flex-col text-[10px] text-left">
                              <span className="font-bold">{t.invoiceNumber}</span>
                              <span className="text-muted-foreground">${t.totalAmount.toFixed(2)} - {t.entityName}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {mappedData && (
                    <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-[10px]">
                      <p className="font-bold text-destructive">
                        {mappedData.documentType === '07' ? 'Nota de Crédito Detectada' : 'Documento para Anulación'}
                      </p>
                      <p>DTE # {mappedData.invoiceNumber}</p>
                      <p>Monto: ${mappedData.totalAmount?.toFixed(2)}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Motivo</Label>
                    <Textarea 
                      placeholder="Motivo de la anulación..." 
                      value={voidReason} 
                      onChange={e => setVoidReason(e.target.value)} 
                    />
                  </div>
                </div>
                
                <Button variant="destructive" className="w-full" onClick={handleVoidTransaction} disabled={!transactionToVoid}>
                  Invalidar Transacción
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Historial de Anulaciones</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {transactions.filter(t => t.isVoided).length > 0 ? (
                    transactions.filter(t => t.isVoided).map(t => (
                      <div key={t.id} className="p-3 border-b text-[10px] flex justify-between items-start bg-muted/30 mb-2 rounded">
                        <div className="space-y-1 overflow-hidden pr-2">
                          <p className="font-bold truncate">{t.invoiceNumber}</p>
                          <p className="text-muted-foreground truncate">{t.entityName}</p>
                          <p className="italic text-destructive font-medium break-words">Motivo: {t.voidReason}</p>
                        </div>
                        <span className="font-mono font-bold shrink-0">${t.totalAmount.toFixed(2)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center opacity-30 italic text-xs">No hay anulaciones registradas.</div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="comparison">
          {!selectedProjectId ? (
             <div className="py-20 text-center border-2 border-dashed rounded-lg opacity-40 px-4">Seleccione un proyecto para conciliar.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader><CardTitle className="text-lg">Cargar Factura Emitida</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div 
                    className={cn("border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer border-primary/20 transition-colors", isDragging ? "bg-primary/5 border-primary" : "hover:bg-primary/5")}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputEmitRef.current?.click()}
                  >
                    <input type="file" ref={fileInputEmitRef} className="hidden" accept=".json" onChange={handleFileUpload} />
                    <ReceiptText className="h-10 w-10 text-primary" />
                    <div className="text-center px-4">
                      <p className="text-sm font-bold text-foreground">Arrastrar Factura de Venta</p>
                      <p className="text-[10px] text-muted-foreground">Auditoría contra OC {currentProject?.purchaseOrder}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between bg-muted/50 p-4 rounded-xl border border-border">
                    <div className="space-y-0.5">
                      <Label className="text-xs">Aplicar Retención IVA 1%</Label>
                      <p className="text-[9px] text-muted-foreground">Normativa Hacienda (Manual)</p>
                    </div>
                    <Switch checked={applyRetention} onCheckedChange={setApplyRetention} />
                  </div>
                  
                  <Button className="w-full h-12 bg-primary" onClick={() => handleProcessData()} disabled={!jsonInput || isProcessing}>
                    {isProcessing ? <Loader2 className="animate-spin mr-2" /> : null}
                    {isProcessing ? "Analizando..." : "Comparar contra OC"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Auditoría de Desviación SV</CardTitle></CardHeader>
                <CardContent>
                  {mappedData ? (
                    <div className="space-y-6">
                      <div className="p-4 bg-muted rounded-xl space-y-3">
                        <div className="flex justify-between text-xs"><span>Venta Emitida:</span><span className="font-bold">${mappedData.totalAmount?.toFixed(2)}</span></div>
                        <div className="flex justify-between text-xs text-muted-foreground"><span>Objetivo OC:</span><span>${currentProject?.targetSaleAmount.toFixed(2)}</span></div>
                        <div className="flex justify-between text-sm border-t pt-3 font-black">
                          <span>Diferencia:</span>
                          <span className={cn(Math.abs((mappedData.totalAmount || 0) - (currentProject?.targetSaleAmount || 0)) < 1 ? "text-green-500" : "text-amber-500")}>
                            ${((mappedData.totalAmount || 0) - (currentProject?.targetSaleAmount || 0)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-[10px] uppercase font-bold text-muted-foreground">Estado de Ítems OC</h4>
                        <div className="space-y-1">
                          {currentProject?.expectedProducts.map(ep => {
                            const found = mappedData.items?.some(it => it.code === ep.code || it.description?.toLowerCase().includes(ep.description.toLowerCase()));
                            return (
                              <div key={ep.code} className="flex items-center justify-between text-[10px] p-2 bg-muted/50 rounded">
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    {found ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" /> : <XCircle className="h-3 w-3 text-muted-foreground shrink-0" />}
                                    <span className="font-mono text-primary shrink-0">{ep.code}</span>
                                    <span className="truncate">{ep.description}</span>
                                  </div>
                                  <span className={cn("shrink-0 ml-2", found ? "font-bold text-green-600" : "italic text-muted-foreground")}>{found ? "OK" : "NO"}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      
                      <Button className="w-full bg-primary" onClick={handleSaveFinalInvoice}>Cerrar Proyecto y Guardar</Button>
                    </div>
                  ) : <div className="py-20 text-center opacity-40 italic text-xs px-4">Cargue el DTE de venta para auditar contra la OC pactada.</div>}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  )
}
