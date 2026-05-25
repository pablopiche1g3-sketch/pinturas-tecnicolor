
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
import { useLedgerStore, type ProjectProduct, type TransactionItem, type Project, type ProjectDocument } from "@/lib/store"
import { aiJsonKeyMapper, type AiJsonKeyMapperOutput, type AiActionResponse } from "@/ai/flows/ai-json-key-mapper"
import { Loader2, Plus, Briefcase, Calculator, ReceiptText, Trash2, Upload, XCircle, Package, Pencil, CheckCircle, FileText, CheckCircle2, FileDown, Eye, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { useFirestore } from "@/firebase"

export default function InstitutionalModule() {
  const { 
    entities, projects, transactions, addProject, updateProject, deleteProject, 
    addTransaction, voidTransaction, addToInventory, addDocumentToProject, deleteDocumentFromProject 
  } = useLedgerStore()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [mounted, setMounted] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState('projects')
  const [purchaseMode, setPurchaseMode] = React.useState<'ai' | 'manual' | 'internal'>('ai')
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

  // Document Upload State
  const [isUploading, setIsUploading] = React.useState(false)
  const docInputRef = React.useRef<HTMLInputElement>(null)

  // Manual Purchase Form State
  const [manualPurchase, setManualPurchase] = React.useState({
    codigoGeneracion: '',
    numeroControl: '',
    issueDate: new Date().toISOString().split('T')[0],
    documentType: '03',
    supplierId: ''
  })
  const [manualItems, setManualItems] = React.useState<TransactionItem[]>([])
  const [tempManualItem, setTempManualItem] = React.useState<TransactionItem>({
    code: '',
    description: '',
    quantity: 1,
    unitPrice: 0,
    lineTotal: 0
  })

  const [jsonInput, setJsonInput] = React.useState('')
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [mappedData, setMappedData] = React.useState<AiJsonKeyMapperOutput | null>(null)
  const [selectedSupplierId, setSelectedSupplierId] = React.useState('')
  const [isDragging, setIsDragging] = React.useState(false)

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
      updateProject(db, editingProject.id, {
        name: newProject.name,
        purchaseOrder: newProject.purchaseOrder,
        targetSaleAmount: newProject.targetSaleAmount,
        customerId: newProject.customerId,
        customerName: customer?.name || 'Cliente Desconocido',
        expectedProducts: newProjectProducts,
      })
      toast({ title: "Proyecto Actualizado", description: "Cambios guardados exitosamente." })
    } else {
      addProject(db, {
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
    updateProject(db, project.id, { status: newStatus })
    toast({ 
      title: newStatus === 'completed' ? "Proyecto Entregado" : "Proyecto Reactivado", 
      description: `El estado del proyecto ha sido actualizado.` 
    })
  }

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm("¿Estás seguro de eliminar este proyecto? Se borrarán todas sus transacciones vinculadas.")) {
      deleteProject(db, id)
      if (selectedProjectId === id) setSelectedProjectId('')
      toast({ title: "Proyecto Eliminado", variant: "destructive" })
    }
  }

  // Document Management
  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editingProject) return

    if (file.type !== 'application/pdf') {
      toast({ title: "Formato no válido", description: "Solo se permiten archivos PDF.", variant: "destructive" })
      return
    }

    setIsUploading(true)
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64Data = event.target?.result as string
      addDocumentToProject(db, editingProject.id, {
        name: file.name,
        type: file.type,
        size: file.size,
        data: base64Data
      })
      setIsUploading(false)
      toast({ title: "Documento Guardado", description: `${file.name} ha sido adjuntado.` })
    }
    reader.onerror = () => {
      setIsUploading(false)
      toast({ title: "Error", description: "No se pudo procesar el archivo.", variant: "destructive" })
    }
    reader.readAsDataURL(file)
  }

  const handleDownloadDoc = (doc: ProjectDocument) => {
    const link = document.createElement('a')
    link.href = doc.data
    link.download = doc.name
    link.click()
  }

  // AI & Manual Processing Logic...
  const handleProcessData = async (content?: string) => {
    const rawData = content || jsonInput
    if (!rawData.trim()) {
       toast({ title: "Sin datos", description: "Por favor cargue un archivo JSON válido.", variant: "destructive" })
       return
    }
    try {
      setIsProcessing(true)
      const response: AiActionResponse = await aiJsonKeyMapper({ invoiceJsonString: rawData })
      
      if (!response.success) {
        throw new Error(response.error || "Error desconocido en el servicio de IA.");
      }
      
      const result = response.data!;
      setMappedData(result)
      
      if (activeTab === 'voided') {
        const targetId = result.relatedDocumentNumber || result.invoiceNumber
        const found = transactions.find(t => t.invoiceNumber === targetId || t.id === targetId)
        if (found) {
          setTransactionToVoid(found.id)
          setVoidReason(result.documentType === '07' ? 'Anulación por Nota de Crédito' : 'Ajuste fiscal detectado')
        }
      }

      toast({ title: "Documento Analizado", description: `Tipo de DTE: ${result.documentType || 'Detectado'}` })
    } catch (error: any) {
      console.error("Client Process Error:", error)
      toast({ 
        title: "Error de IA", 
        description: error.message || "Error al procesar el DTE. Verifique su API Key.", 
        variant: "destructive" 
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type !== "application/json" && !file.name.endsWith('.json')) {
        toast({ title: "Formato no válido", description: "Solo se permiten archivos JSON.", variant: "destructive" })
        return
      }
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
    if (!file) return
    if (file.type !== "application/json" && !file.name.endsWith('.json')) {
      toast({ title: "Formato no válido", description: "Solo se permiten archivos JSON.", variant: "destructive" })
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setJsonInput(content)
      handleProcessData(content)
    }
    reader.readAsText(file)
  }

  const handleSavePurchase = () => {
    if (!mappedData || !selectedProjectId || !currentProject) return
    if (!selectedSupplierId) {
      toast({ title: "Falta proveedor", description: "Por favor, seleccione el proveedor antes de confirmar el ingreso.", variant: "destructive" })
      return
    }

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
      if (isExpected) validItems.push(txItem)
      else orphanItems.push(txItem)
    })

    if (orphanItems.length > 0) {
      addToInventory(db, orphanItems.map(oi => ({
        code: oi.code || 'S/C',
        description: oi.description,
        quantity: oi.quantity,
        unitPrice: oi.unitPrice,
        sourceInvoice: mappedData.invoiceNumber || 'Manual'
      })))
      toast({ title: "Excedentes detectados", description: "Se enviaron productos al Inventario Global.", variant: "destructive" })
    }

    if (validItems.length > 0) {
      const subtotal = validItems.reduce((acc, curr) => acc + curr.lineTotal, 0)
      const tax = mappedData.taxAmount || (subtotal * 0.13)
      const total = mappedData.totalAmount || (subtotal + tax)

      addTransaction(db, {
        invoiceNumber: mappedData.invoiceNumber || `DTE-${Date.now()}`,
        numeroControl: (mappedData as any).numeroControl || '',
        issueDate: mappedData.issueDate || new Date().toISOString(),
        entityId: selectedSupplierId,
        entityName: supplier?.name || '',
        projectId: selectedProjectId,
        type: 'purchase',
        documentType: mappedData.documentType || '03',
        items: validItems,
        subtotal,
        taxAmount: tax,
        totalAmount: total,
        costBasis: total,
        gain: 0
      })
      toast({ title: "Compra Guardada", description: "Movimiento registrado con éxito." })
    }
    setMappedData(null)
    setJsonInput('')
  }

  const handleAddManualItem = () => {
    if (!tempManualItem.description || tempManualItem.quantity <= 0) return
    const lineTotal = tempManualItem.quantity * tempManualItem.unitPrice
    setManualItems([...manualItems, { ...tempManualItem, lineTotal }])
    setTempManualItem({ code: '', description: '', quantity: 1, unitPrice: 0, lineTotal: 0 })
  }

  const handleSaveManualPurchase = () => {
    if (!manualPurchase.codigoGeneracion || !manualPurchase.supplierId || !selectedProjectId) {
      toast({ title: "Faltan datos", description: "Complete los campos obligatorios.", variant: "destructive" })
      return
    }
    const supplier = suppliers.find(s => s.id === manualPurchase.supplierId)
    const subtotal = manualItems.reduce((acc, curr) => acc + curr.lineTotal, 0)
    const tax = subtotal * 0.13
    const total = subtotal + tax

    addTransaction(db, {
      invoiceNumber: manualPurchase.codigoGeneracion,
      numeroControl: manualPurchase.numeroControl,
      issueDate: manualPurchase.issueDate,
      entityId: manualPurchase.supplierId,
      entityName: supplier?.name || '',
      projectId: selectedProjectId,
      type: 'purchase',
      documentType: manualPurchase.documentType,
      items: manualItems,
      subtotal,
      taxAmount: tax,
      totalAmount: total,
      costBasis: total,
      gain: 0
    })
    setManualItems([])
    toast({ title: "Compra Manual Guardada" })
  }

  const handleSaveInternalTransfer = () => {
    if (!selectedProjectId) return
    const subtotal = manualItems.reduce((acc, curr) => acc + curr.lineTotal, 0)
    // Para traslados internos puede que no aplique el IVA extra, pero si quieren cargarlo como costo real del inventario, lo mantenemos sin IVA extra o lo incluimos. Lo dejaremos como costo directo.
    // Usaremos el subtotal como costo final para simplificar (o si quieren 13%, se puede dejar, pero usualmente traslados son costo directo).
    const total = subtotal

    addTransaction(db, {
      invoiceNumber: `TRASLADO-${Date.now()}`,
      numeroControl: '',
      issueDate: new Date().toISOString(),
      entityId: 'internal_transfer',
      entityName: 'Traslado Tienda Matriz',
      projectId: selectedProjectId,
      type: 'purchase',
      documentType: 'internal', // Marcador especial
      items: manualItems,
      subtotal,
      taxAmount: 0, // Sin IVA extra contable
      totalAmount: total,
      costBasis: total,
      gain: 0
    })
    setManualItems([])
    toast({ title: "Traslado Interno Registrado", description: "Costo añadido al proyecto." })
  }

  const handleSaveInvoice = (closeProject: boolean) => {
    if (!mappedData || !selectedProjectId || !currentProject) return
    addTransaction(db, {
      invoiceNumber: mappedData.invoiceNumber || `INV-${Date.now()}`,
      issueDate: mappedData.issueDate || new Date().toISOString(),
      entityId: currentProject.customerId,
      entityName: currentProject.customerName,
      projectId: selectedProjectId,
      type: 'sale',
      documentType: mappedData.documentType || '01',
      items: (mappedData.items || []).map(i => ({ ...i, description: i.description || '', quantity: i.quantity || 1, unitPrice: i.unitPrice || 0, lineTotal: i.lineTotal || 0 })),
      subtotal: mappedData.subtotal || 0,
      taxAmount: mappedData.taxAmount || 0,
      totalAmount: mappedData.totalAmount || 0,
      costBasis: projectCosts,
      gain: (mappedData.totalAmount || 0) - projectCosts
    })
    
    if (closeProject) {
      updateProject(db, selectedProjectId, { status: 'completed' })
    }
    
    setMappedData(null)
    toast({ title: closeProject ? "Proyecto Cerrado y Factura Registrada" : "Factura Parcial Registrada" })
  }

  const handleVoidTransaction = () => {
    if (!transactionToVoid) return
    voidTransaction(db, transactionToVoid, voidReason, mappedData?.invoiceNumber)
    setTransactionToVoid(''); setVoidReason(''); setMappedData(null)
    toast({ title: "Anulación Registrada" })
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
                <DialogContent className="sm:max-w-[800px] w-[95vw] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingProject ? 'Configuración de Proyecto' : 'Nuevo Proyecto'}</DialogTitle>
                    <CardDescription>Defina los parámetros generales y documentos de respaldo.</CardDescription>
                  </DialogHeader>
                  
                  <Tabs defaultValue="general" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="general">Información General</TabsTrigger>
                      <TabsTrigger value="documents">Documentos (PDF)</TabsTrigger>
                    </TabsList>

                    <TabsContent value="general" className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                              <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Monto Venta Objetivo ($)</Label>
                            <Input type="number" value={newProject.targetSaleAmount} onChange={e => setNewProject({...newProject, targetSaleAmount: Number(e.target.value)})} />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-bold text-xs uppercase text-muted-foreground">Productos de la OC</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Input className="h-8 text-xs" placeholder="Código SV" value={tempProduct.code} onChange={e => setTempProduct({...tempProduct, code: e.target.value})} />
                            <Input className="h-8 text-xs" type="number" placeholder="Cantidad" value={tempProduct.quantity} onChange={e => setTempProduct({...tempProduct, quantity: Number(e.target.value)})} />
                            <Input className="h-8 text-xs" type="number" placeholder="Precio Venta ($)" value={tempProduct.unitPrice || ''} onChange={e => setTempProduct({...tempProduct, unitPrice: Number(e.target.value)})} />
                            <Input className="sm:col-span-3 h-8 text-xs" placeholder="Descripción del producto" value={tempProduct.description} onChange={e => setTempProduct({...tempProduct, description: e.target.value})} />
                          </div>
                          <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={handleAddProductToProject}>Añadir Item</Button>
                          <ScrollArea className="h-[120px] rounded border bg-muted/20 p-2">
                            {newProjectProducts.map((p, idx) => (
                              <div key={idx} className="flex justify-between items-center text-[10px] py-1 border-b">
                                <span className="truncate pr-2">{p.code} - {p.description} (x{p.quantity} @ ${p.unitPrice})</span>
                                <Button variant="ghost" size="icon" className="h-4 w-4 shrink-0" onClick={() => setNewProjectProducts(newProjectProducts.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            ))}
                          </ScrollArea>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="documents" className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-foreground">Archivos Adjuntos</h4>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="gap-2" 
                          disabled={!editingProject || isUploading}
                          onClick={() => docInputRef.current?.click()}
                        >
                          {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                          Subir PDF
                        </Button>
                        <input type="file" ref={docInputRef} className="hidden" accept=".pdf" onChange={handleDocUpload} />
                      </div>

                      <ScrollArea className="h-[300px] rounded-lg border bg-muted/30 p-4">
                        {editingProject?.documents && editingProject.documents.length > 0 ? (
                          <div className="space-y-3">
                            {editingProject.documents.map((doc) => (
                              <div key={doc.id} className="flex items-center justify-between p-3 bg-card rounded-lg border shadow-sm group">
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <div className="h-8 w-8 rounded bg-red-100 flex items-center justify-center shrink-0">
                                    <FileText className="h-4 w-4 text-red-600" />
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold text-foreground truncate">{doc.name}</span>
                                    <span className="text-[10px] text-muted-foreground">{(doc.size / 1024).toFixed(1)} KB • {new Date(doc.createdAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownloadDoc(doc)}>
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteDocumentFromProject(db, editingProject.id, doc.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-2 py-10">
                            <FileDown className="h-10 w-10" />
                            <p className="text-xs italic">No hay documentos cargados.</p>
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>

                  <DialogFooter className="mt-6">
                    <Button className="w-full bg-primary" onClick={handleCreateOrUpdateProject}>
                      {editingProject ? 'Guardar Cambios' : 'Crear Proyecto'}
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
                        {p.status === 'completed' && <Badge className="text-[8px] bg-green-500 border-none text-white">ENTREGADO</Badge>}
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
                            <span className="truncate max-w-[150px] font-medium text-foreground">{ep.description}</span>
                            <span className="text-muted-foreground">{getProductProgress(ep.code, p.id).toFixed(0)}%</span>
                          </div>
                          <Progress value={getProductProgress(ep.code, p.id)} className="h-1" />
                        </div>
                      ))}
                      {p.documents.length > 0 && (
                        <div className="flex items-center gap-1 pt-2">
                          <Badge variant="secondary" className="text-[8px] gap-1 px-1.5 h-4">
                            <FileText className="h-2 w-2" /> {p.documents.length} Docs
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="p-2 pt-0 border-t flex justify-between gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => openEditProject(e, p)} title="Configuración / Documentos">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className={cn("h-8 w-8", p.status === 'completed' ? "text-primary" : "text-muted-foreground")} onClick={(e) => toggleProjectStatus(e, p)} title="Cambiar Estado">
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => handleDeleteProject(e, p.id)} title="Eliminar">
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
            <div className="space-y-6">
              <div className="flex justify-center">
                <Tabs value={purchaseMode} onValueChange={(v: any) => setPurchaseMode(v)} className="w-full max-w-md">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="ai" className="gap-2"><Upload className="h-3 w-3" /> Carga JSON</TabsTrigger>
                    <TabsTrigger value="manual" className="gap-2"><Pencil className="h-3 w-3" /> Manual</TabsTrigger>
                    <TabsTrigger value="internal" className="gap-2"><Package className="h-3 w-3" /> Tienda Matriz</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {purchaseMode === 'ai' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card>
                    <CardHeader><CardTitle className="text-lg">Importar DTE</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar Proveedor" /></SelectTrigger>
                        <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <div 
                        className={cn("border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer", isDragging ? "bg-primary/5 border-primary" : "border-border")}
                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileUpload} />
                        <Upload className="h-10 w-10 text-muted-foreground" />
                        <div className="text-center px-2">
                          <p className="text-sm font-bold text-foreground">Arrastrar DTE V3</p>
                          <p className="text-[10px] text-muted-foreground uppercase mt-1">Soporta Códigos 01 y 03 de Hacienda</p>
                        </div>
                      </div>
                      <Button className="w-full h-12 bg-primary" onClick={() => handleProcessData()} disabled={isProcessing || !jsonInput}>
                        {isProcessing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "Validar contra OC"}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-lg">Validación de Items</CardTitle></CardHeader>
                    <CardContent>
                      {mappedData ? (
                        <div className="space-y-4">
                          <Badge variant="secondary" className="bg-primary/10 text-primary uppercase text-[10px]">
                               DTE: {mappedData.documentType === '03' ? 'CRÉDITO FISCAL' : 'FACTURA'}
                          </Badge>
                          <ScrollArea className="h-[200px] border rounded-lg">
                            <table className="w-full text-[10px]">
                              <thead className="bg-muted sticky top-0"><tr><th className="p-2 text-left">Item</th><th className="p-2 text-right">Cant.</th><th className="p-2 text-center">Estado</th></tr></thead>
                              <tbody className="divide-y">
                                {mappedData.items?.map((it, idx) => {
                                  const isExpected = currentProject?.expectedProducts.some(ep => ep.code === it.code || it.description?.toLowerCase().includes(ep.description.toLowerCase()));
                                  return (
                                    <tr key={idx} className={cn(!isExpected && "bg-destructive/5")}>
                                      <td className="p-2">{it.description}</td>
                                      <td className="p-2 text-right">{it.quantity}</td>
                                      <td className="p-2 text-center">{isExpected ? <Badge className="bg-green-500">OK</Badge> : <Badge variant="destructive">NO OC</Badge>}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </ScrollArea>
                          <div className="bg-muted p-3 rounded-lg border text-xs">
                            <div className="flex justify-between"><span>IVA (13%):</span><span className="font-bold">${mappedData.taxAmount?.toFixed(2)}</span></div>
                            <div className="flex justify-between text-base font-black border-t mt-2 pt-2"><span>TOTAL:</span><span>${mappedData.totalAmount?.toFixed(2)}</span></div>
                          </div>
                          <Button className="w-full bg-primary" onClick={handleSavePurchase}>Confirmar Ingreso</Button>
                        </div>
                      ) : <div className="py-20 text-center text-muted-foreground italic text-xs">Cargue el JSON para validar suministros.</div>}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card>
                    <CardHeader><CardTitle className="text-lg">Ingreso Manual</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2"><Label>Código Generación</Label><Input value={manualPurchase.codigoGeneracion} onChange={e => setManualPurchase({...manualPurchase, codigoGeneracion: e.target.value})} /></div>
                          <div className="space-y-2"><Label>Control</Label><Input value={manualPurchase.numeroControl} onChange={e => setManualPurchase({...manualPurchase, numeroControl: e.target.value})} /></div>
                       </div>
                       <Select value={manualPurchase.supplierId} onValueChange={v => setManualPurchase({...manualPurchase, supplierId: v})}>
                         <SelectTrigger><SelectValue placeholder="Proveedor" /></SelectTrigger>
                         <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                       </Select>
                       <div className="border p-4 rounded-lg bg-muted/20 space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                             <Input placeholder="Descripción" className="col-span-2" value={tempManualItem.description} onChange={e => setTempManualItem({...tempManualItem, description: e.target.value})} />
                             <Input type="number" placeholder="Cant." value={tempManualItem.quantity} onChange={e => setTempManualItem({...tempManualItem, quantity: Number(e.target.value)})} />
                             <Input type="number" placeholder="Precio" value={tempManualItem.unitPrice} onChange={e => setTempManualItem({...tempManualItem, unitPrice: Number(e.target.value)})} />
                          </div>
                          <Button variant="outline" size="sm" className="w-full" onClick={handleAddManualItem}>Añadir Item</Button>
                       </div>
                       <Button className="w-full bg-primary" onClick={handleSaveManualPurchase} disabled={manualItems.length === 0}>Guardar Compra</Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-lg">Resumen Manual</CardTitle></CardHeader>
                    <CardContent>
                       <ScrollArea className="h-[250px] border rounded-lg p-2">
                          {manualItems.map((it, idx) => (
                            <div key={idx} className="flex justify-between p-2 border-b text-[10px]">
                               <span>{it.description} (x{it.quantity})</span>
                               <span className="font-bold">${it.lineTotal.toFixed(2)}</span>
                            </div>
                          ))}
                       </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              ) : purchaseMode === 'internal' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2"><Package className="h-5 w-5 text-primary"/> Traslado desde Tienda Matriz</CardTitle>
                      <CardDescription>Añada productos que se tomaron del inventario de la tienda matriz sin necesidad de orden de compra o proveedor.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       <div className="border p-4 rounded-lg bg-muted/20 space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                             <Input placeholder="Descripción del producto" className="col-span-2" value={tempManualItem.description} onChange={e => setTempManualItem({...tempManualItem, description: e.target.value})} />
                             <Input type="number" placeholder="Cant." value={tempManualItem.quantity} onChange={e => setTempManualItem({...tempManualItem, quantity: Number(e.target.value)})} />
                             <Input type="number" placeholder="Costo Unitario ($)" value={tempManualItem.unitPrice} onChange={e => setTempManualItem({...tempManualItem, unitPrice: Number(e.target.value)})} />
                          </div>
                          <Button variant="outline" size="sm" className="w-full" onClick={handleAddManualItem}>Añadir al Traslado</Button>
                       </div>
                       <Button className="w-full bg-primary" onClick={handleSaveInternalTransfer} disabled={manualItems.length === 0}>Confirmar Ingreso al Proyecto</Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-lg">Resumen del Traslado</CardTitle></CardHeader>
                    <CardContent>
                       <ScrollArea className="h-[250px] border rounded-lg p-2">
                          {manualItems.map((it, idx) => (
                            <div key={idx} className="flex justify-between p-2 border-b text-[10px]">
                               <span>{it.description} (x{it.quantity})</span>
                               <span className="font-bold">${it.lineTotal.toFixed(2)}</span>
                            </div>
                          ))}
                       </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </div>
          )}
        </TabsContent>

        <TabsContent value="voided">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader><CardTitle className="text-lg">Anular Transacción</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div 
                    className={cn("border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer", isDragging ? "bg-primary/5 border-primary" : "bg-muted/50")}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputVoidRef.current?.click()}
                  >
                    <input type="file" ref={fileInputVoidRef} className="hidden" accept=".json" onChange={handleFileUpload} />
                    <FileText className="h-8 w-8 text-destructive opacity-50" />
                    <p className="text-xs font-bold">Cargar Nota de Crédito (Tipo 07)</p>
                  </div>
                  <Select value={transactionToVoid} onValueChange={setTransactionToVoid}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar transacción" /></SelectTrigger>
                    <SelectContent>
                      {transactions.filter(t => !t.isVoided).map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.invoiceNumber} - ${t.totalAmount.toFixed(2)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea placeholder="Motivo..." value={voidReason} onChange={e => setVoidReason(e.target.value)} />
                  <Button variant="destructive" className="w-full" onClick={handleVoidTransaction} disabled={!transactionToVoid}>Confirmar Anulación</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-lg">Historial</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {transactions.filter(t => t.isVoided).map(t => (
                      <div key={t.id} className="p-3 border-b text-[10px] bg-muted/30 mb-2 rounded flex justify-between">
                        <div>
                          <p className="font-bold">{t.invoiceNumber}</p>
                          <p className="text-destructive italic">{t.voidReason}</p>
                        </div>
                        <span className="font-bold">${t.totalAmount.toFixed(2)}</span>
                      </div>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>
           </div>
        </TabsContent>

        <TabsContent value="comparison">
           {!selectedProjectId ? (
             <div className="py-20 text-center border-2 border-dashed rounded-lg opacity-40 px-4">Seleccione un proyecto.</div>
           ) : (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                   <CardHeader><CardTitle className="text-lg">Cargar Venta Emitida</CardTitle></CardHeader>
                   <CardContent className="space-y-6">
                      <div 
                        className={cn("border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-4 cursor-pointer", isDragging ? "bg-primary/5 border-primary" : "border-border")}
                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputEmitRef.current?.click()}
                      >
                        <input type="file" ref={fileInputEmitRef} className="hidden" accept=".json" onChange={handleFileUpload} />
                        <ReceiptText className="h-10 w-10 text-primary" />
                        <p className="text-sm font-bold">Arrastrar Factura de Venta</p>
                      </div>
                      <Button className="w-full h-12" onClick={() => handleProcessData()} disabled={!jsonInput}>Analizar Contra OC</Button>
                   </CardContent>
                </Card>
                <Card>
                   <CardHeader><CardTitle className="text-lg">Resultado de Auditoría</CardTitle></CardHeader>
                   <CardContent>
                      {mappedData ? (
                        <div className="space-y-4">
                           <div className="p-4 bg-muted rounded-xl space-y-2">
                              <div className="flex justify-between"><span>Venta Emitida:</span><span className="font-bold">${mappedData.totalAmount?.toFixed(2)}</span></div>
                              <div className="flex justify-between"><span>Objetivo OC:</span><span>${currentProject?.targetSaleAmount.toFixed(2)}</span></div>
                           </div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <Button variant="outline" className="w-full" onClick={() => handleSaveInvoice(false)}>Guardar Parcial</Button>
                             <Button className="w-full bg-primary" onClick={() => handleSaveInvoice(true)}>Cerrar Proyecto y Guardar</Button>
                           </div>
                        </div>
                      ) : <div className="py-20 text-center opacity-40 italic text-xs">Cargue el DTE de venta.</div>}
                   </CardContent>
                </Card>
             </div>
           )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  )
}
