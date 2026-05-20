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
import { useLedgerStore, type ProjectProduct, type TransactionItem } from "@/lib/store"
import { aiJsonKeyMapper, type AiJsonKeyMapperOutput } from "@/ai/flows/ai-json-key-mapper"
import { Loader2, Plus, Briefcase, Calculator, ReceiptText, Trash2, Upload, XCircle, Package, ArrowRight, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"

export default function InstitutionalModule() {
  const { entities, projects, transactions, addProject, addTransaction, voidTransaction, addToInventory } = useLedgerStore()
  const { toast } = useToast()
  
  const [mounted, setMounted] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState('projects')
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>('')
  const [isProjectDialogOpen, setIsProjectDialogOpen] = React.useState(false)
  
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

  const getProductProgress = (productCode: string) => {
    if (!selectedProjectId) return 0
    const received = projectTransactions
      .filter(t => t.type === 'purchase')
      .flatMap(t => t.items)
      .filter(i => i.code === productCode)
      .reduce((acc, curr) => acc + curr.quantity, 0)
    
    const expected = currentProject?.expectedProducts.find(p => p.code === productCode)?.quantity || 1
    return Math.min((received / expected) * 100, 100)
  }

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
    toast({ title: "Proyecto Creado", description: "El proyecto se ha registrado exitosamente." })
  }

  const handleProcessData = async (content?: string) => {
    const rawData = content || jsonInput
    if (!rawData.trim()) return
    try {
      setIsProcessing(true)
      const result = await aiJsonKeyMapper({ invoiceJsonString: rawData })
      setMappedData(result)
      
      // If we are in the voided tab, try to find the transaction automatically
      if (activeTab === 'voided' && result.invoiceNumber) {
        const found = transactions.find(t => t.invoiceNumber === result.invoiceNumber || t.id === result.invoiceNumber)
        if (found) setTransactionToVoid(found.id)
      }

      toast({ title: "Documento Analizado", description: "Se han extraído los datos del DTE V3." })
    } catch (error) {
      toast({ title: "Error", description: "No se pudo leer el archivo DTE V3.", variant: "destructive" })
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
        title: "Productos no autorizados",
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
    const total = mappedData.totalAmount || (subtotal + tax)

    addTransaction({
      invoiceNumber: mappedData.invoiceNumber || `DTE-${Date.now()}`,
      issueDate: mappedData.issueDate || new Date().toISOString(),
      entityId: selectedSupplierId,
      entityName: supplier?.name || '',
      projectId: selectedProjectId,
      type: 'purchase',
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

    voidTransaction(transactionToVoid, voidReason)
    setTransactionToVoid('')
    setVoidReason('')
    setMappedData(null)
    toast({ title: "Anulación Registrada", description: "El documento ha sido invalidado." })
  }

  if (!mounted) return null

  return (
    <AppLayout>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-secondary p-1">
          <TabsTrigger value="projects" className="gap-2"><Briefcase className="h-4 w-4" /> Proyectos</TabsTrigger>
          <TabsTrigger value="purchases" className="gap-2"><Upload className="h-4 w-4" /> Compras DTE V3</TabsTrigger>
          <TabsTrigger value="voided" className="gap-2"><XCircle className="h-4 w-4" /> Anulaciones</TabsTrigger>
          <TabsTrigger value="comparison" className="gap-2"><Calculator className="h-4 w-4" /> Conciliación Final</TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold font-headline text-slate-900">Control de Proyectos</h3>
                <p className="text-sm text-muted-foreground">Gestione presupuestos y suministros autorizados por OC.</p>
              </div>
              
              <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4" /> Nuevo Proyecto
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px]">
                  <DialogHeader>
                    <DialogTitle>Configurar Proyecto y OC</DialogTitle>
                    <CardDescription>Defina los productos esperados para el control de inventario.</CardDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div className="space-y-4 border-r pr-6">
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
                      <div className="grid grid-cols-2 gap-2">
                        <Input className="h-8 text-xs" placeholder="Código SV" value={tempProduct.code} onChange={e => setTempProduct({...tempProduct, code: e.target.value})} />
                        <Input className="h-8 text-xs" type="number" placeholder="Cantidad" value={tempProduct.quantity} onChange={e => setTempProduct({...tempProduct, quantity: Number(e.target.value)})} />
                        <Input className="col-span-2 h-8 text-xs" placeholder="Descripción del producto" value={tempProduct.description} onChange={e => setTempProduct({...tempProduct, description: e.target.value})} />
                      </div>
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={handleAddProductToProject}>Añadir Item</Button>
                      <ScrollArea className="h-[120px] rounded border bg-muted/20 p-2">
                        {newProjectProducts.map((p, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[10px] py-1 border-b">
                            <span>{p.code} - {p.description} (x{p.quantity})</span>
                            <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => setNewProjectProducts(newProjectProducts.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button className="w-full bg-blue-600" onClick={handleCreateProject}>Guardar Proyecto</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {projects.map(p => (
                <Card 
                  key={p.id} 
                  className={cn("cursor-pointer border-2 transition-all", selectedProjectId === p.id ? "border-blue-600 bg-blue-50/30" : "hover:border-blue-200")}
                  onClick={() => setSelectedProjectId(p.id)}
                >
                  <CardHeader className="p-4">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-sm font-bold text-slate-800">{p.name}</CardTitle>
                      <Badge variant="outline" className="text-[9px] uppercase font-mono">{p.purchaseOrder}</Badge>
                    </div>
                    <CardDescription className="text-xs">{p.customerName}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
                        <span>Suministros</span>
                        <span>Objetivo: ${p.targetSaleAmount.toLocaleString()}</span>
                      </div>
                      {p.expectedProducts.slice(0, 2).map(ep => (
                        <div key={ep.code} className="space-y-1">
                          <div className="flex justify-between text-[9px]">
                            <span className="truncate max-w-[150px]">{ep.description}</span>
                            <span>{getProductProgress(ep.code).toFixed(0)}%</span>
                          </div>
                          <Progress value={getProductProgress(ep.code)} className="h-1" />
                        </div>
                      ))}
                      {p.expectedProducts.length > 2 && (
                        <p className="text-[9px] text-center text-muted-foreground">+{p.expectedProducts.length - 2} productos más...</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="purchases">
          {!selectedProjectId ? (
            <div className="py-20 text-center border-2 border-dashed rounded-lg opacity-40 flex flex-col items-center gap-4">
               <Package className="h-10 w-10 text-slate-300" />
               <p className="text-slate-500">Seleccione un proyecto para registrar facturas DTE V3 de proveedores.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader><CardTitle>Importar DTE SV V3</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar Proveedor" /></SelectTrigger>
                    <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>

                  <div 
                    className={cn("border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer", isDragging ? "bg-blue-50 border-blue-400" : "border-slate-200")}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileUpload} />
                    <Upload className="h-10 w-10 text-slate-400" />
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-700">Seleccionar o Arrastrar DTE V3</p>
                      <p className="text-[10px] text-muted-foreground uppercase mt-1">Soporta Código de Generación SV</p>
                    </div>
                  </div>
                  <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700" onClick={() => handleProcessData()} disabled={isProcessing || !jsonInput}>
                    {isProcessing ? <Loader2 className="animate-spin" /> : "Validar contra Orden de Compra"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Validación de Suministros</CardTitle></CardHeader>
                <CardContent>
                  {mappedData ? (
                    <div className="space-y-4">
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-[10px]">
                          <thead className="bg-slate-50"><tr><th className="p-2 text-left">Código/Item</th><th className="p-2 text-right">Cant.</th><th className="p-2 text-center">Estado OC</th></tr></thead>
                          <tbody className="divide-y">
                            {mappedData.items?.map((it, idx) => {
                              const isExpected = currentProject?.expectedProducts.some(ep => ep.code === it.code || it.description?.toLowerCase().includes(ep.description.toLowerCase()));
                              return (
                                <tr key={idx} className={!isExpected ? "bg-amber-50" : ""}>
                                  <td className="p-2 truncate max-w-[150px]">
                                    <span className="font-mono text-blue-600">{it.code}</span> - {it.description}
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
                      <div className="space-y-1 bg-slate-50 p-3 rounded-lg border">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">IVA (13%):</span>
                          <span className="font-bold">${mappedData.taxAmount?.toFixed(2)}</span>
                        </div>
                        {mappedData.retentionAmount && mappedData.retentionAmount > 0 && (
                          <div className="flex justify-between text-[10px] text-orange-600">
                            <span>Retención IVA:</span>
                            <span className="font-bold">-${mappedData.retentionAmount.toFixed(2)}</span>
                          </div>
                        )}
                        {mappedData.perceptionAmount && mappedData.perceptionAmount > 0 && (
                          <div className="flex justify-between text-[10px] text-blue-600">
                            <span>Percepción IVA:</span>
                            <span className="font-bold">+${mappedData.perceptionAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-2 mt-2 border-t">
                          <span className="text-xs font-black uppercase">TOTAL DTE:</span>
                          <span className="text-lg font-black text-slate-900">${mappedData.totalAmount?.toFixed(2)}</span>
                        </div>
                      </div>
                      <Button className="w-full bg-blue-600" onClick={handleSavePurchase}>Confirmar Carga en Proyecto</Button>
                    </div>
                  ) : <div className="py-20 text-center text-muted-foreground italic text-xs">Cargue el JSON DTE para validar los ítems de ingreso.</div>}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="voided">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader><CardTitle>Registro de Anulación (DTE)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div 
                  className={cn("border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer", isDragging ? "bg-red-50 border-red-400" : "bg-slate-50/50")}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputVoidRef.current?.click()}
                >
                  <input type="file" ref={fileInputVoidRef} className="hidden" accept=".json" onChange={handleFileUpload} />
                  <XCircle className="h-8 w-8 text-destructive opacity-50" />
                  <p className="text-xs font-bold text-slate-600">Cargar DTE a Anular / Devolución</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Seleccionar transacción a invalidar</Label>
                    <Select value={transactionToVoid} onValueChange={setTransactionToVoid}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar transacción" /></SelectTrigger>
                      <SelectContent>
                        {transactions.filter(t => !t.isVoided).map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.invoiceNumber} - {t.entityName} - ${t.totalAmount.toFixed(2)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {mappedData && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-[10px]">
                      <p className="font-bold text-red-800">DTE Detectado: {mappedData.invoiceNumber}</p>
                      <p>Fecha: {mappedData.issueDate}</p>
                      <p>Monto: ${mappedData.totalAmount?.toFixed(2)}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Motivo de la anulación</Label>
                    <Textarea 
                      placeholder="Indique si es devolución, error en DTE, etc." 
                      value={voidReason} 
                      onChange={e => setVoidReason(e.target.value)} 
                    />
                  </div>
                </div>
                
                <Button variant="destructive" className="w-full" onClick={handleVoidTransaction} disabled={!transactionToVoid}>
                  Anular Movimiento Permanentemente
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Historial de Ajustes Fiscales</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {transactions.filter(t => t.isVoided).map(t => (
                    <div key={t.id} className="p-3 border-b text-[10px] flex justify-between items-start opacity-70 bg-slate-50 mb-2 rounded">
                      <div>
                        <p className="font-bold text-slate-900">{t.invoiceNumber}</p>
                        <p className="text-muted-foreground">{t.entityName}</p>
                        <p className="italic text-destructive font-medium mt-1">Motivo: {t.voidReason}</p>
                        <p className="text-[8px] text-muted-foreground">Fecha: {new Date(t.issueDate).toLocaleDateString()}</p>
                      </div>
                      <span className="font-mono font-bold text-slate-600">${t.totalAmount.toFixed(2)}</span>
                    </div>
                  ))}
                  {transactions.filter(t => t.isVoided).length === 0 && (
                    <div className="py-20 text-center opacity-30 italic text-xs">No hay anulaciones registradas.</div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="comparison">
          {!selectedProjectId ? (
             <div className="py-20 text-center border-2 border-dashed rounded-lg opacity-40">Seleccione un proyecto para conciliar factura emitida.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader><CardTitle>Cargar Factura Emitida (DTE SV)</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div 
                    className={cn("border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer border-blue-100 transition-colors", isDragging ? "bg-blue-50 border-blue-400" : "hover:bg-blue-50/50")}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputEmitRef.current?.click()}
                  >
                    <input type="file" ref={fileInputEmitRef} className="hidden" accept=".json" onChange={handleFileUpload} />
                    <ReceiptText className="h-10 w-10 text-blue-600" />
                    <div className="text-center">
                      <p className="text-sm font-bold">Arrastrar Factura de Venta Emitida</p>
                      <p className="text-[10px] text-muted-foreground">Analizaremos contra la Orden de Compra {currentProject?.purchaseOrder}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs">Aplicar Retención IVA 1% Manual</Label>
                        <p className="text-[9px] text-muted-foreground italic">Usar si el DTE no la incluye automáticamente.</p>
                      </div>
                      <Switch checked={applyRetention} onCheckedChange={setApplyRetention} />
                    </div>
                  </div>
                  
                  <Button className="w-full h-12 bg-blue-600" onClick={() => handleProcessData()} disabled={!jsonInput || isProcessing}>
                    {isProcessing ? <Loader2 className="animate-spin" /> : "Comparar contra OC"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Auditoría de Desviación SV</CardTitle></CardHeader>
                <CardContent>
                  {mappedData ? (
                    <div className="space-y-6">
                      <div className="p-4 bg-slate-900 rounded-xl space-y-3 text-white">
                        <div className="flex justify-between text-xs"><span>Venta Emitida (Bruto):</span><span className="font-bold">${mappedData.totalAmount?.toFixed(2)}</span></div>
                        <div className="flex justify-between text-xs text-slate-400"><span>Monto Objetivo OC:</span><span>${currentProject?.targetSaleAmount.toFixed(2)}</span></div>
                        <div className="flex justify-between text-sm border-t border-slate-700 pt-3 font-black">
                          <span>Diferencia Final:</span>
                          <span className={cn(Math.abs((mappedData.totalAmount || 0) - (currentProject?.targetSaleAmount || 0)) < 1 ? "text-green-400" : "text-amber-400")}>
                            ${((mappedData.totalAmount || 0) - (currentProject?.targetSaleAmount || 0)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-[10px] uppercase font-bold text-muted-foreground">Validación de Ítems OC</h4>
                        {currentProject?.expectedProducts.map(ep => {
                          const found = mappedData.items?.some(it => it.code === ep.code || it.description?.toLowerCase().includes(ep.description.toLowerCase()));
                          return (
                            <div key={ep.code} className="flex items-center justify-between text-[10px] p-2 bg-slate-50 rounded">
                                <div className="flex items-center gap-2">
                                  {found ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-slate-300" />}
                                  <span className="font-mono text-blue-600">{ep.code}</span>
                                  <span>{ep.description}</span>
                                </div>
                                <span className={found ? "font-bold text-green-600" : "italic text-muted-foreground"}>{found ? "Vinculado" : "No detectado"}</span>
                            </div>
                          )
                        })}
                      </div>
                      
                      <Button className="w-full bg-blue-600" onClick={handleSaveFinalInvoice}>Cerrar Proyecto y Guardar en Libro SV</Button>
                    </div>
                  ) : <div className="py-20 text-center opacity-40 italic text-xs">Cargue el DTE de venta para auditar contra la OC pactada.</div>}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  )
}
