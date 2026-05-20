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
import { Loader2, FileJson, DollarSign, Plus, Briefcase, Calculator, ReceiptText, Trash2, Upload, FileCode, CheckCircle2, Box, Info, XCircle, AlertTriangle, PackageSearch } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function InstitutionalModule() {
  const { entities, projects, transactions, addProject, deleteProject, addTransaction, voidTransaction, addToInventory } = useLedgerStore()
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
    toast({ title: "Proyecto Creado", description: "El proyecto se ha registrado exitosamente." })
  }

  const handleProcessData = async (content?: string) => {
    const rawData = content || jsonInput
    if (!rawData.trim()) return
    try {
      setIsProcessing(true)
      const result = await aiJsonKeyMapper({ invoiceJsonString: rawData })
      setMappedData(result)
      toast({ title: "Documento Analizado", description: "Se han extraído los datos del DTE." })
    } catch (error) {
      toast({ title: "Error", description: "No se pudo leer el archivo JSON.", variant: "destructive" })
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
    
    // Filtrar productos que no están en la OC
    const validItems: TransactionItem[] = []
    const orphanItems: TransactionItem[] = []
    
    rawItems.forEach(item => {
      // Nota: En un DTE real, buscaríamos por código exacto si está disponible
      // Aquí simulamos la validación por descripción o código si existiera en el mapeo
      const isExpected = currentProject.expectedProducts.some(ep => 
        ep.code === (item as any).code || 
        item.description?.toLowerCase().includes(ep.description.toLowerCase())
      )
      
      const txItem = {
        description: item.description || 'Gasto proveedor',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        lineTotal: item.lineTotal || 0,
        code: (item as any).code
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
        description: `${orphanItems.length} productos no pertenecen a esta OC. Serán enviados a Inventario Global.`,
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

    const subtotal = validItems.reduce((acc, curr) => acc + curr.lineTotal, 0)
    const tax = subtotal * 0.13 // IVA estándar SV

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
      totalAmount: subtotal + tax,
      costBasis: subtotal + tax,
      gain: 0
    })

    setMappedData(null)
    setJsonInput('')
    toast({ title: "Compra Guardada", description: "Solo los productos de la OC fueron cargados al proyecto." })
  }

  const handleSaveFinalInvoice = () => {
    if (!mappedData || !selectedProjectId || !currentProject) return
    
    const subtotal = mappedData.subtotal || 0
    const retention = applyRetention ? subtotal * 0.01 : 0
    const total = (mappedData.totalAmount || 0) - retention

    addTransaction({
      invoiceNumber: mappedData.invoiceNumber || `INV-${Date.now()}`,
      issueDate: mappedData.issueDate || new Date().toISOString(),
      entityId: currentProject.customerId,
      entityName: currentProject.customerName,
      projectId: selectedProjectId,
      type: 'sale',
      items: (mappedData.items || []).map(i => ({
        description: i.description || 'Venta proyecto',
        quantity: i.quantity || 1,
        unitPrice: i.unitPrice || 0,
        lineTotal: i.lineTotal || 0,
      })),
      subtotal: subtotal,
      taxAmount: mappedData.taxAmount || 0,
      retentionAmount: retention,
      totalAmount: total,
      costBasis: projectCosts,
      gain: total - projectCosts
    })
    setMappedData(null)
    setJsonInput('')
    toast({ title: "Factura Registrada", description: "Venta guardada con éxito." })
  }

  const handleVoidTransaction = () => {
    if (!transactionToVoid && !mappedData) return
    if (!voidReason) {
      toast({ title: "Error", description: "Indique el motivo de anulación.", variant: "destructive" })
      return
    }

    if (transactionToVoid) {
      voidTransaction(transactionToVoid, voidReason)
    } else if (mappedData) {
      addTransaction({
        invoiceNumber: mappedData.invoiceNumber || `VOID-${Date.now()}`,
        issueDate: mappedData.issueDate || new Date().toISOString(),
        entityId: 'manual',
        entityName: mappedData.supplierName || 'Proveedor',
        projectId: selectedProjectId,
        type: 'purchase', // Soporte para anular compras
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
    toast({ title: "Anulación Registrada", description: "El documento ha sido invalidado." })
  }

  if (!mounted) return null

  return (
    <AppLayout>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-secondary p-1">
          <TabsTrigger value="projects" className="gap-2"><Briefcase className="h-4 w-4" /> Proyectos</TabsTrigger>
          <TabsTrigger value="purchases" className="gap-2"><Plus className="h-4 w-4" /> Compras DTE</TabsTrigger>
          <TabsTrigger value="voided" className="gap-2"><XCircle className="h-4 w-4" /> Anulaciones</TabsTrigger>
          <TabsTrigger value="comparison" className="gap-2"><Calculator className="h-4 w-4" /> Conciliación</TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold font-headline">Control de Proyectos</h3>
                <p className="text-sm text-muted-foreground">Gestión de presupuestos y Orden de Compra.</p>
              </div>
              
              <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-accent hover:bg-accent/90">
                    <Plus className="h-4 w-4" /> Nuevo Proyecto
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px]">
                  <DialogHeader>
                    <DialogTitle>Configurar OC Maestra</DialogTitle>
                    <CardDescription>Defina los productos y montos autorizados para el proyecto.</CardDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div className="space-y-4 border-r pr-6">
                      <div className="space-y-2">
                        <Label>Nombre</Label>
                        <Input value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Orden de Compra</Label>
                        <Input value={newProject.purchaseOrder} onChange={e => setNewProject({...newProject, purchaseOrder: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Cliente</Label>
                        <Select value={newProject.customerId} onValueChange={val => setNewProject({...newProject, customerId: val})}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                          <SelectContent>
                            {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Monto Objetivo ($)</Label>
                        <Input type="number" value={newProject.targetSaleAmount} onChange={e => setNewProject({...newProject, targetSaleAmount: Number(e.target.value)})} />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-bold text-xs uppercase text-muted-foreground">Productos Autorizados</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <Input className="h-8 text-xs" placeholder="Código" value={tempProduct.code} onChange={e => setTempProduct({...tempProduct, code: e.target.value})} />
                        <Input className="h-8 text-xs" type="number" placeholder="Cant" value={tempProduct.quantity} onChange={e => setTempProduct({...tempProduct, quantity: Number(e.target.value)})} />
                        <Input className="col-span-2 h-8 text-xs" placeholder="Descripción" value={tempProduct.description} onChange={e => setTempProduct({...tempProduct, description: e.target.value})} />
                      </div>
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={handleAddProductToProject}>Añadir</Button>
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
                    <Button className="w-full bg-accent" onClick={handleCreateProject}>Crear Proyecto</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {projects.map(p => (
                <Card 
                  key={p.id} 
                  className={cn("cursor-pointer border-2 transition-all", selectedProjectId === p.id ? "border-primary bg-primary/5" : "hover:border-primary/30")}
                  onClick={() => setSelectedProjectId(p.id)}
                >
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">{p.name}</CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold">{p.purchaseOrder}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{p.customerName}</span>
                      <span className="font-bold text-primary">${p.targetSaleAmount.toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="purchases">
          {!selectedProjectId ? (
            <div className="py-20 text-center border-2 border-dashed rounded-lg opacity-40">Seleccione un proyecto para cargar compras.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader><CardTitle>Importar Compra Proveedor (DTE)</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                    <SelectTrigger><SelectValue placeholder="Proveedor" /></SelectTrigger>
                    <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>

                  <div 
                    className={cn("border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer", isDragging ? "bg-primary/5 border-primary" : "border-muted")}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileUpload} />
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-bold">Arrastrar DTE de Proveedor</p>
                  </div>
                  <Textarea placeholder="Pegar JSON..." className="min-h-[100px] text-[10px]" value={jsonInput} onChange={e => setJsonInput(e.target.value)} />
                  <Button className="w-full h-12" onClick={() => handleProcessData()} disabled={isProcessing || !jsonInput}>
                    {isProcessing ? <Loader2 className="animate-spin" /> : "Validar contra OC"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Vista Previa y Filtro de OC</CardTitle></CardHeader>
                <CardContent>
                  {mappedData ? (
                    <div className="space-y-4">
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-[10px]">
                          <thead className="bg-muted"><tr><th className="p-2 text-left">Producto</th><th className="p-2 text-right">Monto</th><th className="p-2">Estado</th></tr></thead>
                          <tbody className="divide-y">
                            {mappedData.items?.map((it, idx) => {
                              const isExpected = currentProject?.expectedProducts.some(ep => it.description?.toLowerCase().includes(ep.description.toLowerCase()));
                              return (
                                <tr key={idx} className={!isExpected ? "bg-orange-50" : ""}>
                                  <td className="p-2">{it.description}</td>
                                  <td className="p-2 text-right">${it.lineTotal?.toFixed(2)}</td>
                                  <td className="p-2 text-center">
                                    {isExpected ? <Badge className="text-[8px] bg-green-500">OC OK</Badge> : <Badge variant="destructive" className="text-[8px]">DESVÍO</Badge>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      <Button className="w-full" onClick={handleSavePurchase}>Confirmar e Inyectar</Button>
                    </div>
                  ) : <div className="py-20 text-center text-muted-foreground italic">Analice un DTE para validar productos.</div>}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="voided">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader><CardTitle>Anular Documento</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div 
                  className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer"
                  onClick={() => fileInputVoidRef.current?.click()}
                >
                  <input type="file" ref={fileInputVoidRef} className="hidden" accept=".json" onChange={handleFileUpload} />
                  <XCircle className="h-8 w-8 text-destructive" />
                  <span className="text-xs">Cargar DTE a Anular</span>
                </div>
                <Select value={transactionToVoid} onValueChange={setTransactionToVoid}>
                  <SelectTrigger><SelectValue placeholder="O seleccionar de lista" /></SelectTrigger>
                  <SelectContent>
                    {transactions.filter(t => t.projectId === selectedProjectId && !t.isVoided).map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.invoiceNumber} - ${t.totalAmount}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea placeholder="Motivo (Requerido)" value={voidReason} onChange={e => setVoidReason(e.target.value)} />
                <Button variant="destructive" className="w-full" onClick={handleVoidTransaction}>Anular Registro</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Historial de Anulaciones</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {transactions.filter(t => t.projectId === selectedProjectId && t.isVoided).map(t => (
                    <div key={t.id} className="p-3 border-b text-xs flex justify-between items-start opacity-60">
                      <div>
                        <p className="font-bold">{t.invoiceNumber}</p>
                        <p className="italic text-destructive">Motivo: {t.voidReason}</p>
                      </div>
                      <span className="font-mono">${t.totalAmount.toFixed(2)}</span>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="comparison">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader><CardTitle>Validar Factura Emitida</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div 
                  className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer"
                  onClick={() => fileInputEmitRef.current?.click()}
                >
                  <input type="file" ref={fileInputEmitRef} className="hidden" accept=".json" onChange={handleFileUpload} />
                  <ReceiptText className="h-10 w-10 text-primary" />
                  <p className="text-sm font-bold">Arrastrar Factura de Venta</p>
                </div>
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                   <input type="checkbox" checked={applyRetention} onChange={e => setApplyRetention(e.target.checked)} />
                   <Label className="text-xs">Aplicar Retención 1% (Grandes Contribuyentes)</Label>
                </div>
                <Button className="w-full h-12" onClick={() => handleProcessData()} disabled={!jsonInput}>Analizar Factura Final</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Conciliación y Margen</CardTitle></CardHeader>
              <CardContent>
                {mappedData ? (
                  <div className="space-y-6">
                    <div className="p-4 bg-muted rounded-xl space-y-2">
                      <div className="flex justify-between text-xs"><span>Venta Emitida:</span><span className="font-bold">${mappedData.totalAmount?.toFixed(2)}</span></div>
                      <div className="flex justify-between text-xs"><span>Objetivo OC:</span><span>${currentProject?.targetSaleAmount.toFixed(2)}</span></div>
                      <div className="flex justify-between text-xs border-t pt-2 font-black">
                        <span>Diferencia:</span>
                        <span className={Math.abs((mappedData.totalAmount || 0) - (currentProject?.targetSaleAmount || 0)) < 1 ? "text-green-600" : "text-orange-600"}>
                          ${((mappedData.totalAmount || 0) - (currentProject?.targetSaleAmount || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <Button className="w-full bg-accent" onClick={handleSaveFinalInvoice}>Finalizar y Registrar</Button>
                  </div>
                ) : <div className="py-20 text-center opacity-40 italic">Cargue la factura emitida para ver resultados.</div>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  )
}