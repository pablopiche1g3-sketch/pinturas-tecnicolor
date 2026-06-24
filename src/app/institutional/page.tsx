
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
import { useLedgerStore, type ProjectProduct, type TransactionItem, type Project, type ProjectDocument, type Transaction } from "@/lib/store"
import { aiJsonKeyMapper, type AiJsonKeyMapperOutput, type AiActionResponse } from "@/ai/flows/ai-json-key-mapper"
import { Loader2, Plus, Briefcase, Calculator, ReceiptText, Trash2, Upload, XCircle, Package, Pencil, CheckCircle, FileText, CheckCircle2, FileDown, Eye, Download, Maximize2, Sliders } from "lucide-react"
import * as XLSX from 'xlsx'
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { useFirestore, useStorage } from "@/firebase"
import { ref, uploadString, getDownloadURL } from "firebase/storage"
import { jsPDF } from "jspdf"

export default function InstitutionalModule() {
  const { 
    entities, projects, transactions, addProject, updateProject, deleteProject, 
    addTransaction, updateTransaction, voidTransaction, addToInventory, addDocumentToProject, deleteDocumentFromProject 
  } = useLedgerStore()
  const db = useFirestore()
  const storage = useStorage()
  const { toast } = useToast()
  
  const [mounted, setMounted] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState('projects')
  const [purchaseMode, setPurchaseMode] = React.useState<'ai' | 'manual' | 'internal'>('ai')
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>('')
  const [isProjectDialogOpen, setIsProjectDialogOpen] = React.useState(false)
  const [editingProject, setEditingProject] = React.useState<Project | null>(null)
  const [viewingInvoice, setViewingInvoice] = React.useState<Transaction | null>(null)
  const [editingTransaction, setEditingTransaction] = React.useState<Transaction | null>(null)
  const [isSuppliesDialogOpen, setIsSuppliesDialogOpen] = React.useState(false)

  const handleUpdateProductProperty = (idx: number, key: keyof ProjectProduct, value: any) => {
    setNewProjectProducts(prev => prev.map((p, i) => i === idx ? { ...p, [key]: value } : p))
  }
  
  const [newProject, setNewProject] = React.useState({
    name: '',
    purchaseOrder: '',
    targetSaleAmount: 0,
    customerId: '',
    warrantyStartDate: '',
    warrantyMonths: 0
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

  const getMatchingExpectedProduct = (i: any, expectedProducts: any[]) => {
    if (i.code) {
      const iCode = String(i.code).trim().toLowerCase();
      const byCode = expectedProducts.find(ep => String(ep.code || '').trim().toLowerCase() === iCode);
      if (byCode) return byCode;
    }
    const iDesc = (i.description || '').toLowerCase().trim();
    if (!iDesc) return null;
    const exactDesc = expectedProducts.find(ep => (ep.description || '').toLowerCase().trim() === iDesc);
    if (exactDesc) return exactDesc;

    const matches = expectedProducts.filter(ep => {
      const epDesc = (ep.description || '').toLowerCase();
      if (iDesc.includes(epDesc) || epDesc.includes(iDesc)) return true;
      
      const iWords = iDesc.split(/\s+/);
      const epWords = epDesc.split(/\s+/);
      const allEpInI = epWords.every(w => iWords.includes(w));
      const allIInEp = iWords.every(w => epWords.includes(w));
      
      return allEpInI || allIInEp;
    });
    if (matches.length > 0) {
      return matches.reduce((prev, current) => {
        const diffPrev = Math.abs((prev.description?.length || 0) - iDesc.length);
        const diffCurr = Math.abs((current.description?.length || 0) - iDesc.length);
        return diffPrev < diffCurr ? prev : current;
      });
    }
    return null;
  }

  const getProductProgress = (ep: any, projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    const txs = transactions.filter(t => t.projectId === projectId && !t.isVoided)
    
    const delivered = txs
      .filter(t => t.type === 'remission')
      .flatMap(t => t.items)
      .filter(i => {
        const match = getMatchingExpectedProduct(i, project?.expectedProducts || []);
        return match && match.code === ep.code && match.description === ep.description;
      })
      .reduce((acc, curr) => acc + curr.quantity, 0)

    const invoiced = txs
      .filter(t => t.type === 'sale')
      .flatMap(t => t.items)
      .filter(i => {
        const match = getMatchingExpectedProduct(i, project?.expectedProducts || []);
        return match && match.code === ep.code && match.description === ep.description;
      })
      .reduce((acc, curr) => acc + curr.quantity, 0)
    
    const effectiveProgressAmount = Math.max(delivered, invoiced)
    const expected = ep.quantity || 1
    return Math.min((effectiveProgressAmount / expected) * 100, 100)
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
        warrantyStartDate: newProject.warrantyStartDate || null,
        warrantyMonths: newProject.warrantyMonths || null,
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
        status: 'active',
        warrantyStartDate: newProject.warrantyStartDate || null,
        warrantyMonths: newProject.warrantyMonths || null,
      })
      toast({ title: "Proyecto Creado", description: "El proyecto se ha registrado exitosamente." })
    }

    setNewProject({ name: '', purchaseOrder: '', targetSaleAmount: 0, customerId: '', warrantyStartDate: '', warrantyMonths: 0 })
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
      customerId: project.customerId,
      warrantyStartDate: project.warrantyStartDate || '',
      warrantyMonths: project.warrantyMonths || 0
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

  const handleExportProject = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation()
    // 1. Obtener todas las compras válidas vinculadas al proyecto
    const purchaseTxs = transactions.filter(t => t.projectId === p.id && t.type === 'purchase' && !t.isVoided)
    const allPurchasedItems = purchaseTxs.flatMap(t => t.items)

    // 2. Obtener todas las ventas válidas (facturas de venta DTE o manuales) vinculadas al proyecto
    const saleTxs = transactions.filter(t => t.projectId === p.id && t.type === 'sale' && !t.isVoided)
    const allSoldItems = saleTxs.flatMap(t => t.items)

    let csvContent = "Descripción del producto;Costo de compra;Precio de venta\n"
    
    p.expectedProducts.forEach(ep => {
      // Calcular promedio de costo de compra
      const purchased = allPurchasedItems.filter(i => {
        const match = getMatchingExpectedProduct(i, p.expectedProducts);
        return match && match.code === ep.code && match.description === ep.description;
      })
      const qtyPurchased = purchased.reduce((acc, curr) => acc + curr.quantity, 0)
      const totalCost = purchased.reduce((acc, curr) => acc + curr.lineTotal, 0)
      const avgCost = qtyPurchased > 0 ? totalCost / qtyPurchased : 0
      
      // Calcular precio de venta real a partir de las facturas de venta subidas
      const sold = allSoldItems.filter(i => {
        const match = getMatchingExpectedProduct(i, p.expectedProducts);
        return match && match.code === ep.code && match.description === ep.description;
      })
      const qtySold = sold.reduce((acc, curr) => acc + curr.quantity, 0)
      const totalSalesVal = sold.reduce((acc, curr) => acc + curr.lineTotal, 0)
      
      // Si ya hay facturas de venta subidas, calcula el precio real; si no, usa el precio de venta configurado en el proyecto
      const salePrice = qtySold > 0 ? (totalSalesVal / qtySold) : (ep.unitPrice || 0)
      
      csvContent += `"${ep.description}";${avgCost.toFixed(2).replace('.', ',')};${salePrice.toFixed(2).replace('.', ',')}\n`
    })

    // Procesar ítems que se compraron pero no estaban en la orden de compra original
    const unmatched = allPurchasedItems.filter(i => !getMatchingExpectedProduct(i, p.expectedProducts))
    
    const groupedUnmatched = unmatched.reduce((acc, curr) => {
      const key = curr.code || curr.description || 'unknown'
      if (!acc[key]) acc[key] = { description: curr.description, qty: 0, totalCost: 0, code: curr.code }
      acc[key].qty += curr.quantity
      acc[key].totalCost += curr.lineTotal
      return acc
    }, {} as Record<string, any>)

    Object.values(groupedUnmatched).forEach((u: any) => {
      const avgCost = u.qty > 0 ? u.totalCost / u.qty : 0
      
      // Buscar si este producto extra también se vendió en las facturas de venta
      const sold = allSoldItems.filter(i => 
        (i.code && u.code && i.code === u.code) || 
        (i.description && u.description && (i.description.toLowerCase().includes(u.description.toLowerCase()) || u.description.toLowerCase().includes(i.description.toLowerCase())))
      )
      const qtySold = sold.reduce((acc, curr) => acc + curr.quantity, 0)
      const totalSalesVal = sold.reduce((acc, curr) => acc + curr.lineTotal, 0)
      const salePrice = qtySold > 0 ? (totalSalesVal / qtySold) : 0
      
      csvContent += `"${u.description} (Extra)";${avgCost.toFixed(2).replace('.', ',')};${salePrice.toFixed(2).replace('.', ',')}\n`
    })

    const BOM = "\uFEFF"
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `rentabilidad_${p.name.replace(/\s+/g, '_')}.csv`
    link.click()
    toast({ title: "Excel Exportado", description: "El reporte simplificado de rentabilidad se ha descargado." })
  }

  // Document Management
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editingProject) return

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast({ title: "Formato no válido", description: "Solo se permiten imágenes y archivos PDF.", variant: "destructive" })
      return
    }

    setIsUploading(true)

    try {
      let finalDataUrl = "";
      let finalName = file.name;

      if (file.type.startsWith('image/')) {
        // Comprimir y convertir a PDF
        finalName = file.name.replace(/\.[^/.]+$/, "") + ".pdf";
        const imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const img = new window.Image();
        img.src = imageBase64;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error("No se pudo leer la imagen. Verifique que el formato sea válido (JPG/PNG). Formatos como HEIC de iPhone podrían no estar soportados directamente en el navegador."));
        });

        // Reducir la resolución (max 1200px)
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get canvas context");
        ctx.drawImage(img, 0, 0, width, height);
        
        // Calidad 0.7 para JPEG compresión
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);

        // Crear PDF
        const pdf = new jsPDF({
          orientation: width > height ? "landscape" : "portrait",
          unit: "px",
          format: [width, height]
        });
        pdf.addImage(compressedDataUrl, "JPEG", 0, 0, width, height);
        finalDataUrl = pdf.output("datauristring");
      } else {
        // Es un PDF, leerlo tal cual
        finalDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      // Subir a Firebase Storage
      const storageRef = ref(storage, `projects/${editingProject.id}/documents/${Date.now()}_${finalName}`);
      await uploadString(storageRef, finalDataUrl, 'data_url');
      const downloadURL = await getDownloadURL(storageRef);

      // Guardar en Firestore con la URL (NO el base64 gigante)
      addDocumentToProject(db, editingProject.id, {
        name: finalName,
        type: 'application/pdf',
        size: file.size, 
        data: downloadURL
      })
      
      toast({ title: "Documento Guardado", description: `${finalName} ha sido subido y optimizado.` })
    } catch (err: any) {
      console.error(err);
      toast({ 
        title: "Error al procesar", 
        description: err.message || "No se pudo procesar o subir el archivo.", 
        variant: "destructive" 
      })
    } finally {
      setIsUploading(false)
      // Resetear el input para permitir subir el mismo archivo de nuevo si es necesario
      e.target.value = '';
    }
  }

  const handleDownloadDoc = (doc: ProjectDocument) => {
    if (doc.data.startsWith('http')) {
      window.open(doc.data, '_blank')
    } else {
      const link = document.createElement('a')
      link.href = doc.data
      link.download = doc.name
      link.click()
    }
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
      const ep = currentProject.expectedProducts.find(p => 
        p.code === item.code || 
        item.description?.toLowerCase().includes(p.description.toLowerCase())
      )
      const isExpected = !!ep
      const unitPrice = item.unitPrice || (ep?.unitPrice || 0)
      const txItem = {
        description: item.description || (ep?.description || 'Gasto proveedor'),
        quantity: item.quantity || 1,
        unitPrice: unitPrice,
        lineTotal: item.lineTotal || ((item.quantity || 1) * unitPrice),
        code: item.code || (ep?.code || 'S/C')
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
      const retention = mappedData.retentionAmount || 0
      const perception = mappedData.perceptionAmount || 0
      const total = mappedData.totalAmount || (subtotal + tax - retention + perception)

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
        retentionAmount: retention,
        perceptionAmount: perception,
        totalAmount: total,
        costBasis: total,
        gain: 0
      })
      toast({ title: "Compra Guardada", description: "Movimiento registrado con éxito." })
    }
    setMappedData(null)
    setJsonInput('')
  }

  const handleDeleteUploadedItem = (idx: number) => {
    if (!mappedData || !mappedData.items) return
    const updatedItems = mappedData.items.filter((_, i) => i !== idx)
    
    // Recalculate totals based on remaining items
    const subtotal = updatedItems.reduce((acc, curr) => acc + (curr.lineTotal || 0), 0)
    const tax = subtotal * 0.13
    const total = subtotal + tax

    setMappedData({
      ...mappedData,
      items: updatedItems,
      subtotal,
      taxAmount: tax,
      totalAmount: total
    })
    
    toast({
      title: "Producto Descartado",
      description: "El producto ha sido removido del ingreso de esta factura y no afectará el inventario ni los costos.",
    })
  }

  const handleUpdateUploadedItemQty = (idx: number, newQty: number) => {
    if (!mappedData || !mappedData.items) return
    if (newQty < 0) return

    const updatedItems = mappedData.items.map((it, i) => {
      if (i !== idx) return it
      const qty = newQty
      const price = it.unitPrice || 0
      const total = qty * price
      return {
        ...it,
        quantity: qty,
        lineTotal: total
      }
    })

    // Recalculate totals based on new quantities
    const subtotal = updatedItems.reduce((acc, curr) => acc + (curr.lineTotal || 0), 0)
    const tax = subtotal * 0.13
    const total = subtotal + tax

    setMappedData({
      ...mappedData,
      items: updatedItems,
      subtotal,
      taxAmount: tax,
      totalAmount: total
    })
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
    const isGC = supplier?.isGranContribuyente || false
    const isCCF = manualPurchase.documentType === '03'
    const subtotal = manualItems.reduce((acc, curr) => acc + curr.lineTotal, 0)
    const tax = subtotal * 0.13
    const perception = isGC && isCCF && subtotal >= 100 ? subtotal * 0.01 : 0
    const total = subtotal + tax + perception

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
      retentionAmount: 0,
      perceptionAmount: perception,
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

  const handleSaveRemission = () => {
    if (!selectedProjectId) return
    const subtotal = manualItems.reduce((acc, curr) => acc + curr.lineTotal, 0)
    addTransaction(db, {
      invoiceNumber: manualPurchase.codigoGeneracion || `REM-${Date.now()}`,
      numeroControl: '',
      issueDate: manualPurchase.issueDate || new Date().toISOString(),
      entityId: 'remission',
      entityName: 'Nota de Remisión',
      projectId: selectedProjectId,
      type: 'remission',
      documentType: 'remission',
      items: manualItems,
      subtotal,
      taxAmount: 0,
      totalAmount: subtotal,
      costBasis: subtotal,
      gain: 0
    })
    setManualItems([])
    setManualPurchase({ supplierId: '', documentType: '01', issueDate: new Date().toISOString(), codigoGeneracion: '', numeroControl: '' })
    toast({ title: "Nota de Remisión Guardada", description: "La mercadería se ha marcado como entregada." })
  }

  const handleSaveInvoice = (closeProject: boolean) => {
    if (!mappedData || !selectedProjectId || !currentProject) return

    const customer = entities.find(e => e.id === currentProject.customerId)
    const isGC = customer?.isGranContribuyente || false
    const isCCF = (mappedData.documentType || '01') === '03'
    const subtotal = mappedData.subtotal || 0
    const tax = mappedData.taxAmount || 0
    const parsedRetention = mappedData.retentionAmount || 0
    const calculatedRetention = parsedRetention > 0 
      ? parsedRetention 
      : (isGC && isCCF && subtotal >= 100 ? subtotal * 0.01 : 0)
    const perception = mappedData.perceptionAmount || 0
    const adjustedTotal = mappedData.totalAmount && parsedRetention === calculatedRetention
      ? mappedData.totalAmount 
      : (subtotal + tax - calculatedRetention + perception)

    addTransaction(db, {
      invoiceNumber: mappedData.invoiceNumber || `INV-${Date.now()}`,
      numeroControl: (mappedData as any).numeroControl || '',
      issueDate: mappedData.issueDate || new Date().toISOString(),
      entityId: currentProject.customerId,
      entityName: currentProject.customerName,
      projectId: selectedProjectId,
      type: 'sale',
      documentType: mappedData.documentType || '01',
      items: (mappedData.items || []).map(i => ({ ...i, description: i.description || '', quantity: i.quantity || 1, unitPrice: i.unitPrice || 0, lineTotal: i.lineTotal || 0 })),
      subtotal,
      taxAmount: tax,
      retentionAmount: calculatedRetention,
      perceptionAmount: perception,
      totalAmount: adjustedTotal,
      costBasis: projectCosts,
      gain: adjustedTotal - projectCosts
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

  const handleEditTransactionSave = () => {
    if (!editingTransaction) return
    
    // Recalculate totals based on items
    const items = editingTransaction.items || []
    let subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0)
    let totalAmount = subtotal
    let taxAmount = 0
    let retentionAmount = 0
    let perceptionAmount = 0

    if (editingTransaction.documentType === '03') { // CCF
      taxAmount = subtotal * 0.13
      totalAmount = subtotal + taxAmount
    }

    const updatedTx = {
      ...editingTransaction,
      subtotal,
      taxAmount,
      totalAmount,
      retentionAmount,
      perceptionAmount,
      // costBasis and gain could be recalculated but they are typically only set at creation or handled specifically
    }

    updateTransaction(db, editingTransaction.id, updatedTx)
    setEditingTransaction(null)
    toast({
      title: "Transacción actualizada",
      description: "Los cambios han sido guardados correctamente.",
    })
  }

  const exportKardexExcel = () => {
    if (!currentProject) return
    
    // Flatten transactions into items
    const rows = projectTransactions.flatMap(tx => 
      (tx.items || []).map(item => ({
        "Tipo de DTE": tx.type === 'purchase' ? 'Compra' : tx.type === 'sale' ? 'Venta' : 'Remisión',
        "Número de DTE": tx.invoiceNumber || tx.numeroControl,
        "Fecha": new Date(tx.issueDate).toLocaleDateString(),
        "Entidad": tx.entityName,
        "Proyecto": currentProject.name,
        "Código": item.code || '',
        "Producto": item.description,
        "Cantidad": item.quantity,
        "Precio Unitario": item.unitPrice,
        "Total": item.lineTotal || (item.quantity * item.unitPrice)
      }))
    )

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Kardex")
    XLSX.writeFile(wb, `Kardex_${currentProject.name}_${new Date().toISOString().split('T')[0]}.xlsx`)
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
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                      <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
                      <TabsTrigger value="history" className="text-xs">Historial DTE</TabsTrigger>
                      <TabsTrigger value="documents" className="text-xs">Docs (PDF)</TabsTrigger>
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
                            <Input type="number" step="0.01" value={newProject.targetSaleAmount || ''} onChange={e => setNewProject({...newProject, targetSaleAmount: Number(e.target.value)})} placeholder="Ej. 24320.50" />
                            <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                              Ingresa el monto sin separador de miles. Usa el punto solo para decimales (Ej: 24320.50).
                            </p>
                          </div>
                          
                          <div className="pt-4 border-t space-y-4">
                            <h4 className="font-bold text-xs uppercase text-muted-foreground">Garantía del Proyecto</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Inicio de Garantía</Label>
                                <Input type="date" value={newProject.warrantyStartDate || ''} onChange={e => setNewProject({...newProject, warrantyStartDate: e.target.value})} />
                              </div>
                              <div className="space-y-2">
                                <Label>Duración (Meses)</Label>
                                <Input type="number" placeholder="Ej. 12" value={newProject.warrantyMonths || ''} onChange={e => setNewProject({...newProject, warrantyMonths: Number(e.target.value)})} />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="font-bold text-xs uppercase text-muted-foreground">Productos de la OC</h4>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              type="button"
                              className="h-7 text-[10px] px-2 gap-1 text-primary border-primary/20 hover:bg-primary/5 shrink-0" 
                              onClick={(e) => { e.preventDefault(); setIsSuppliesDialogOpen(true); }}
                            >
                              <Maximize2 className="h-3 w-3" /> Editar en Pantalla Completa
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Input className="h-8 text-xs" placeholder="Código SV" value={tempProduct.code} onChange={e => setTempProduct({...tempProduct, code: e.target.value})} />
                            <Input className="h-8 text-xs" type="number" placeholder="Cantidad" value={tempProduct.quantity} onChange={e => setTempProduct({...tempProduct, quantity: Number(e.target.value)})} />
                            <Input className="h-8 text-xs" type="number" placeholder="Precio Venta ($)" value={tempProduct.unitPrice || ''} onChange={e => setTempProduct({...tempProduct, unitPrice: Number(e.target.value)})} />
                            <Input className="sm:col-span-3 h-8 text-xs" placeholder="Descripción del producto" value={tempProduct.description} onChange={e => setTempProduct({...tempProduct, description: e.target.value})} />
                          </div>
                          <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={handleAddProductToProject}>Añadir Item</Button>
                          <ScrollArea className="h-[200px] rounded-lg border bg-muted/10 p-2 shadow-inner">
                            {newProjectProducts.map((p, idx) => (
                              <div key={idx} className="flex justify-between items-center text-[10px] py-1.5 border-b last:border-0 group hover:bg-muted/30 px-1 rounded transition-colors">
                                <div className="flex flex-col min-w-0 pr-2">
                                  <span className="font-bold text-foreground truncate">{p.code || 'S/C'} - {p.description}</span>
                                  <span className="text-muted-foreground text-[9px] mt-0.5">Cantidad: {p.quantity} • Precio: ${p.unitPrice.toFixed(2)} • Total: ${(p.quantity * p.unitPrice).toFixed(2)}</span>
                                </div>
                                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-destructive hover:bg-destructive/10" onClick={() => setNewProjectProducts(newProjectProducts.filter((_, i) => i !== idx))}><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            ))}
                            {newProjectProducts.length === 0 && (
                              <div className="h-full flex items-center justify-center text-muted-foreground text-[10px] italic py-10">No hay artículos cargados en la OC.</div>
                            )}
                          </ScrollArea>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="history" className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-foreground">Historial de Facturas (JSON)</h4>
                      </div>
                      <ScrollArea className="h-[300px] rounded-lg border bg-muted/30 p-4">
                        {transactions.filter(t => t.projectId === editingProject?.id).length > 0 ? (
                          <div className="space-y-3">
                            {transactions.filter(t => t.projectId === editingProject?.id).map((tx) => (
                              <div 
                                key={tx.id} 
                                className="flex flex-col p-3 bg-card rounded-lg border shadow-sm group hover:border-primary cursor-pointer transition-all active:scale-[0.98]"
                                onClick={() => setViewingInvoice(tx)}
                                title="Haga clic para ver representación gráfica"
                              >
                                <div className="flex justify-between items-center mb-2">
                                  <div className="flex items-center gap-2">
                                    <ReceiptText className={cn("h-4 w-4", tx.type === 'purchase' ? "text-blue-500" : "text-green-500")} />
                                    <span className="text-xs font-bold">{tx.invoiceNumber}</span>
                                    <Badge variant="outline" className="text-[9px]">{tx.documentType === '03' ? 'CCF' : tx.documentType === '01' ? 'FAC' : 'DTE'}</Badge>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-foreground">${tx.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-primary z-10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingTransaction(tx);
                                      }}
                                      title="Editar"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex justify-between text-[10px] text-muted-foreground">
                                  <span className="truncate max-w-[200px]">{tx.entityName}</span>
                                  <span>{new Date(tx.issueDate).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-2 py-10">
                            <ReceiptText className="h-10 w-10" />
                            <p className="text-xs italic">No hay facturas procesadas en este proyecto.</p>
                          </div>
                        )}
                      </ScrollArea>
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
                        <input type="file" ref={docInputRef} className="hidden" accept=".pdf,image/*" onChange={handleDocUpload} />
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

              <Dialog open={isSuppliesDialogOpen} onOpenChange={setIsSuppliesDialogOpen}>
                <DialogContent className="sm:max-w-[900px] w-[95vw] max-h-[85vh] flex flex-col p-6 overflow-hidden">
                  <DialogHeader className="pb-4 border-b">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold font-headline text-foreground"><Sliders className="h-5 w-5 text-primary" /> Control de Suministros Autorizados de la OC</DialogTitle>
                    <CardDescription>
                      Edite libremente los códigos, cantidades, precios y descripciones de los artículos de la Orden de Compra (OC). Los cambios se aplicarán al guardar el proyecto.
                    </CardDescription>
                  </DialogHeader>

                  <div className="flex-1 overflow-y-auto my-4 border rounded-xl bg-card">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="w-[120px]">Código SV</TableHead>
                          <TableHead className="w-[300px]">Descripción</TableHead>
                          <TableHead className="w-[90px] text-right">Cantidad</TableHead>
                          <TableHead className="w-[110px] text-right">Precio Venta ($)</TableHead>
                          <TableHead className="w-[110px] text-right">Total ($)</TableHead>
                          <TableHead className="w-[60px] text-center">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {newProjectProducts.length > 0 ? (
                          newProjectProducts.map((p, idx) => (
                            <TableRow key={idx} className="hover:bg-muted/30">
                              <TableCell className="p-2">
                                <Input 
                                  className="h-8 text-xs font-mono" 
                                  value={p.code} 
                                  onChange={e => handleUpdateProductProperty(idx, 'code', e.target.value)} 
                                  placeholder="CÓDIGO" 
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input 
                                  className="h-8 text-xs" 
                                  value={p.description} 
                                  onChange={e => handleUpdateProductProperty(idx, 'description', e.target.value)} 
                                  placeholder="Descripción del producto" 
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input 
                                  type="number"
                                  className="h-8 text-xs text-right" 
                                  value={p.quantity} 
                                  onChange={e => handleUpdateProductProperty(idx, 'quantity', Number(e.target.value))} 
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input 
                                  type="number"
                                  className="h-8 text-xs text-right" 
                                  value={p.unitPrice} 
                                  onChange={e => handleUpdateProductProperty(idx, 'unitPrice', Number(e.target.value))} 
                                />
                              </TableCell>
                              <TableCell className="p-2 text-right text-xs font-bold text-foreground">
                                ${(p.quantity * p.unitPrice).toFixed(2)}
                              </TableCell>
                              <TableCell className="p-2 text-center">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  type="button"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10" 
                                  onClick={() => setNewProjectProducts(newProjectProducts.filter((_, i) => i !== idx))}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic text-xs">
                              No hay productos en esta Orden de Compra. Agregue uno abajo.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="bg-muted/40 p-4 rounded-xl border space-y-3 shrink-0">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Agregar Nuevo Artículo</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <Input 
                        className="h-9 text-xs" 
                        placeholder="Código" 
                        value={tempProduct.code} 
                        onChange={e => setTempProduct({...tempProduct, code: e.target.value})} 
                      />
                      <Input 
                        className="h-9 text-xs sm:col-span-2" 
                        placeholder="Descripción del producto" 
                        value={tempProduct.description} 
                        onChange={e => setTempProduct({...tempProduct, description: e.target.value})} 
                      />
                      <div className="flex gap-2">
                        <Input 
                          type="number" 
                          className="h-9 text-xs text-right w-1/2" 
                          placeholder="Cant." 
                          value={tempProduct.quantity} 
                          onChange={e => setTempProduct({...tempProduct, quantity: Number(e.target.value)})} 
                        />
                        <Input 
                          type="number" 
                          className="h-9 text-xs text-right w-1/2" 
                          placeholder="Precio ($)" 
                          value={tempProduct.unitPrice || ''} 
                          onChange={e => setTempProduct({...tempProduct, unitPrice: Number(e.target.value)})} 
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center gap-4 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        type="button"
                        className="gap-1.5 h-9 text-xs shrink-0" 
                        onClick={handleAddProductToProject}
                      >
                        <Plus className="h-3.5 w-3.5" /> Añadir Artículo
                      </Button>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block leading-none mb-1">Valor Estimado de la OC</span>
                        <span className="text-lg font-black text-primary">
                          ${newProjectProducts.reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="mt-4 gap-2 pt-4 border-t shrink-0">
                    <Button type="button" className="w-full bg-primary font-bold text-white hover:bg-primary/90" onClick={() => setIsSuppliesDialogOpen(false)}>
                      Confirmar y Regresar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map(p => {
                const getWarrantyStatus = () => {
                  if (!p.warrantyStartDate || !p.warrantyMonths) return null;
                  const start = new Date(p.warrantyStartDate);
                  const end = new Date(start);
                  end.setMonth(end.getMonth() + p.warrantyMonths);
                  const now = new Date();
                  
                  const diffTime = end.getTime() - now.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                  if (diffDays < 0) {
                    return { text: "GARANTÍA VENCIDA", color: "bg-destructive text-white border-destructive" };
                  } else if (diffDays <= 30) {
                    return { text: `GARANTÍA VENCE EN ${diffDays} DÍAS`, color: "bg-red-500 text-white border-red-500" };
                  } else {
                    return { text: `GARANTÍA: ${end.toLocaleDateString()}`, color: "bg-blue-100 text-blue-700 border-blue-200" };
                  }
                };
                const warranty = getWarrantyStatus();

                return (
                <Card 
                  key={p.id} 
                  className={cn(
                    "cursor-pointer border-2 transition-all flex flex-col", 
                    selectedProjectId === p.id ? "border-primary bg-primary/5" : "hover:border-primary/50",
                    p.status === 'completed' && "opacity-80 grayscale-[0.5]"
                  )}
                  onClick={() => setSelectedProjectId(p.id)}
                  onDoubleClick={(e) => openEditProject(e, p)}
                  title="Doble clic para abrir y ver suministros/documentos"
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-sm font-bold text-foreground truncate">{p.name}</CardTitle>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="text-[9px] uppercase font-mono shrink-0">{p.purchaseOrder}</Badge>
                        {p.status === 'completed' && <Badge className="text-[8px] bg-green-500 border-none text-white">ENTREGADO</Badge>}
                        {warranty && <Badge className={cn("text-[8px] border", warranty.color)}>{warranty.text}</Badge>}
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
                            <span className="text-muted-foreground">{getProductProgress(ep, p.id).toFixed(0)}%</span>
                          </div>
                          <Progress value={getProductProgress(ep, p.id)} className="h-1" />
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={(e) => handleExportProject(e, p)} title="Exportar Rentabilidad (Excel)">
                      <FileDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className={cn("h-8 w-8", p.status === 'completed' ? "text-primary" : "text-muted-foreground")} onClick={(e) => toggleProjectStatus(e, p)} title="Cambiar Estado">
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => handleDeleteProject(e, p.id)} title="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
                );
              })}
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
                              <thead className="bg-muted sticky top-0">
                                <tr>
                                  <th className="p-2 text-left">Item</th>
                                  <th className="p-2 text-right">Cant.</th>
                                  <th className="p-2 text-center">Estado</th>
                                  <th className="p-2 text-right">Acción</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {mappedData.items?.map((it, idx) => {
                                  const projectProduct = currentProject?.expectedProducts.find(ep => ep.code === it.code || (it.description && ep.description && it.description.toLowerCase().includes(ep.description.toLowerCase())));
                                  const isExpected = !!projectProduct;
                                  const expectedQty = projectProduct ? projectProduct.quantity : 0;
                                  const hasExcess = isExpected && (it.quantity || 0) > expectedQty;
                                  
                                  return (
                                    <tr key={idx} className={cn(!isExpected && "bg-destructive/5", hasExcess && "bg-amber-500/5")}>
                                      <td className="p-2 font-medium">{it.description}</td>
                                      <td className="p-2 text-right">
                                        <Input
                                          type="number"
                                          value={it.quantity || 0}
                                          onChange={(e) => handleUpdateUploadedItemQty(idx, Number(e.target.value))}
                                          className="h-6 w-16 text-right font-bold text-[10px] p-1 inline-block bg-background"
                                          min={0}
                                        />
                                      </td>
                                      <td className="p-2 text-center">
                                        {!isExpected ? (
                                          <Badge variant="destructive">NO OC</Badge>
                                        ) : hasExcess ? (
                                          <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-bold" title={`La orden de compra solicitaba ${expectedQty} unidades`}>
                                            EXCESO ({expectedQty})
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-green-500 hover:bg-green-600 text-white text-[9px] font-bold" title={`La orden de compra solicitaba ${expectedQty} unidades`}>
                                            OK ({expectedQty})
                                          </Badge>
                                        )}
                                      </td>
                                      <td className="p-2 text-right">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 text-destructive hover:bg-destructive/10"
                                          onClick={() => handleDeleteUploadedItem(idx)}
                                          title="Descartar producto de esta factura"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </td>
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
              ) : purchaseMode === 'manual' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card>
                    <CardHeader><CardTitle className="text-lg">Ingreso Manual</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2"><Label>Código Generación</Label><Input value={manualPurchase.codigoGeneracion} onChange={e => setManualPurchase({...manualPurchase, codigoGeneracion: e.target.value})} /></div>
                          <div className="space-y-2"><Label>Control</Label><Input value={manualPurchase.numeroControl} onChange={e => setManualPurchase({...manualPurchase, numeroControl: e.target.value})} /></div>
                       </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Select value={manualPurchase.supplierId} onValueChange={v => setManualPurchase({...manualPurchase, supplierId: v})}>
                            <SelectTrigger><SelectValue placeholder="Proveedor" /></SelectTrigger>
                            <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <Select value={manualPurchase.documentType} onValueChange={v => setManualPurchase({...manualPurchase, documentType: v})}>
                            <SelectTrigger><SelectValue placeholder="Tipo Documento" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="03">Crédito Fiscal (CCF)</SelectItem>
                              <SelectItem value="01">Factura Consumidor (FAC)</SelectItem>
                            </SelectContent>
                          </Select>
                       </div>
                       <div className="border p-4 rounded-lg bg-muted/20 space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                             <Input placeholder="Código del producto" className="col-span-2" value={tempManualItem.code} onChange={e => {
                               const code = e.target.value;
                               const ep = currentProject?.expectedProducts.find(p => p.code === code);
                               if (ep) {
                                 setTempManualItem({...tempManualItem, code, description: ep.description, unitPrice: ep.unitPrice});
                               } else {
                                 setTempManualItem({...tempManualItem, code});
                               }
                             }} />
                             <Input placeholder="Descripción del producto" className="col-span-2" value={tempManualItem.description} onChange={e => setTempManualItem({...tempManualItem, description: e.target.value})} />
                             <Input type="number" placeholder="Cant." value={tempManualItem.quantity} onChange={e => setTempManualItem({...tempManualItem, quantity: Number(e.target.value)})} />
                             <Input type="number" placeholder="Precio ($)" value={tempManualItem.unitPrice} onChange={e => setTempManualItem({...tempManualItem, unitPrice: Number(e.target.value)})} />
                          </div>
                          <Button variant="outline" size="sm" className="w-full" onClick={handleAddManualItem}>Añadir Item</Button>
                       </div>
                       <Button className="w-full bg-primary" onClick={handleSaveManualPurchase} disabled={manualItems.length === 0}>Guardar Compra</Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-lg">Resumen Manual</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                       <ScrollArea className="h-[180px] border rounded-lg p-2 bg-card">
                          {manualItems.map((it, idx) => (
                            <div key={idx} className="flex justify-between p-2 border-b text-[10px]">
                               <span>{it.code ? `[${it.code}] ` : ''}{it.description} (x{it.quantity})</span>
                               <span className="font-bold text-foreground">${it.lineTotal.toFixed(2)}</span>
                            </div>
                          ))}
                          {manualItems.length === 0 && (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-xs italic py-10">No hay productos agregados.</div>
                          )}
                       </ScrollArea>
                       {(() => {
                         const supplier = suppliers.find(s => s.id === manualPurchase.supplierId)
                         const isGC = supplier?.isGranContribuyente || false
                         const isCCF = manualPurchase.documentType === '03'
                         const subtotal = manualItems.reduce((acc, curr) => acc + curr.lineTotal, 0)
                         const tax = subtotal * 0.13
                         const perception = isGC && isCCF && subtotal >= 100 ? subtotal * 0.01 : 0
                         const total = subtotal + tax + perception

                         return (
                           <div className="p-3 bg-muted rounded-xl space-y-1.5 text-[11px] border border-border/60">
                             <div className="flex justify-between"><span>Subtotal:</span><span>${subtotal.toFixed(2)}</span></div>
                             <div className="flex justify-between"><span>IVA (13%):</span><span>${tax.toFixed(2)}</span></div>
                             {perception > 0 && (
                               <div className="flex justify-between text-green-600 font-bold">
                                 <span>Percepción IVA (1%):</span>
                                 <span>+${perception.toFixed(2)}</span>
                               </div>
                             )}
                             <div className="flex justify-between text-sm font-black border-t mt-2 pt-2 text-foreground">
                               <span>Total Compra:</span>
                               <span>${total.toFixed(2)}</span>
                             </div>
                             {perception > 0 && (
                               <div className="text-[9px] text-muted-foreground italic border-t pt-1.5 mt-1 border-dotted">
                                 * Sujeto a Percepción del 1% IVA (Hacienda El Salvador) porque el proveedor es Gran Contribuyente.
                               </div>
                             )}
                           </div>
                         )
                       })()}
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
                             <Input placeholder="Código del producto" className="col-span-2" value={tempManualItem.code} onChange={e => {
                               const code = e.target.value;
                               const ep = currentProject?.expectedProducts.find(p => p.code === code);
                               if (ep) {
                                 setTempManualItem({...tempManualItem, code, description: ep.description, unitPrice: ep.unitPrice});
                               } else {
                                 setTempManualItem({...tempManualItem, code});
                               }
                             }} />
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
                               <span>{it.code ? `[${it.code}] ` : ''}{it.description} (x{it.quantity})</span>
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
           {!selectedProjectId || !currentProject ? (
             <div className="py-20 text-center border-2 border-dashed rounded-lg opacity-40 px-4">Seleccione un proyecto.</div>
           ) : (
             <div className="space-y-6">
               <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                 <Card className="bg-primary/5 border-primary/20">
                   <CardContent className="p-4 text-center">
                     <p className="text-[10px] uppercase text-muted-foreground font-bold">Monto OC</p>
                     <p className="text-xl font-black text-primary">${currentProject.targetSaleAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                   </CardContent>
                 </Card>
                 <Card className="bg-green-50 border-green-200">
                   <CardContent className="p-4 text-center">
                     <p className="text-[10px] uppercase text-green-600/70 font-bold">Total Facturado</p>
                     <p className="text-xl font-black text-green-600">
                       ${transactions.filter(t => t.projectId === currentProject.id && !t.isVoided && t.type === 'sale').reduce((a, b) => a + b.totalAmount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                     </p>
                   </CardContent>
                 </Card>
                 <Card className="bg-rose-50 border-rose-200">
                   <CardContent className="p-4 text-center">
                     <p className="text-[10px] uppercase text-rose-600/70 font-bold">Total Compras</p>
                     <p className="text-xl font-black text-rose-600">
                       ${transactions.filter(t => t.projectId === currentProject.id && !t.isVoided && t.type === 'purchase').reduce((a, b) => a + b.totalAmount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                     </p>
                   </CardContent>
                 </Card>
                 <Card className="bg-orange-50 border-orange-200">
                   <CardContent className="p-4 text-center">
                     <p className="text-[10px] uppercase text-orange-600/70 font-bold">Saldo Pendiente OC</p>
                     <p className="text-xl font-black text-orange-600">
                       ${(currentProject.targetSaleAmount - transactions.filter(t => t.projectId === currentProject.id && !t.isVoided && t.type === 'sale').reduce((a, b) => a + b.totalAmount, 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                     </p>
                   </CardContent>
                 </Card>
                 <Card className="bg-blue-50 border-blue-200">
                   <CardContent className="p-4 text-center">
                     <p className="text-[10px] uppercase text-blue-600/70 font-bold">Total Remitido</p>
                     <p className="text-xl font-black text-blue-600">
                       ${transactions.filter(t => t.projectId === currentProject.id && !t.isVoided && t.type === 'remission').reduce((a, b) => a + b.totalAmount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                     </p>
                   </CardContent>
                 </Card>
               </div>

               <Card>
                 <CardHeader className="flex flex-row justify-between items-start">
                   <div>
                     <CardTitle className="text-lg">Cantidades: Entregas vs Facturación</CardTitle>
                     <CardDescription className="text-xs">
                       *Nota: Si la factura o DTE fue emitida con un código genérico o descripción agrupada a petición del cliente, las cantidades de abajo podrían no coincidir, pero el Resumen Financiero superior se mantendrá exacto por monto ($).
                     </CardDescription>
                   </div>
                   <Button size="sm" variant="outline" className="gap-2 border-green-600 text-green-700 hover:bg-green-50" onClick={exportKardexExcel}>
                     <FileDown className="h-4 w-4" /> Exportar Kardex (Excel)
                   </Button>
                 </CardHeader>
                 <CardContent>
                   <div className="overflow-x-auto rounded-lg border">
                     <Table>
                       <TableHeader className="bg-muted/50">
                         <TableRow>
                           <TableHead>Producto OC</TableHead>
                           <TableHead className="text-right">Esperado (OC)</TableHead>
                           <TableHead className="text-right">Entregado (Remisión)</TableHead>
                           <TableHead className="text-right">Facturado (DTE)</TableHead>
                           <TableHead className="text-right font-bold text-primary">Pendiente de Facturar</TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                         {currentProject.expectedProducts.map(ep => {
                           const projectTxs = transactions.filter(t => t.projectId === currentProject.id && !t.isVoided);
                           const delivered = projectTxs.filter(t => t.type === 'remission').flatMap(t => t.items || []).filter(i => {
                             if (!i) return false;
                             const match = getMatchingExpectedProduct(i, currentProject.expectedProducts);
                             return match && match.code === ep.code && match.description === ep.description;
                           }).reduce((acc, curr) => acc + (curr?.quantity || 0), 0);
                           
                           const invoiced = projectTxs.filter(t => t.type === 'sale').flatMap(t => t.items || []).filter(i => {
                             if (!i) return false;
                             const match = getMatchingExpectedProduct(i, currentProject.expectedProducts);
                             return match && match.code === ep.code && match.description === ep.description;
                           }).reduce((acc, curr) => acc + (curr?.quantity || 0), 0);

                           const pending = delivered - invoiced;

                           return (
                             <TableRow key={ep.code}>
                               <TableCell className="font-medium text-xs max-w-[200px] truncate" title={ep.description}>{ep.code} - {ep.description}</TableCell>
                               <TableCell className="text-right">{ep.quantity}</TableCell>
                               <TableCell className="text-right text-blue-600 font-bold">{delivered}</TableCell>
                               <TableCell className="text-right text-green-600 font-bold">{invoiced}</TableCell>
                               <TableCell className="text-right font-black text-primary">{pending > 0 ? pending : 0}</TableCell>
                             </TableRow>
                           )
                         })}
                       </TableBody>
                     </Table>
                   </div>
                 </CardContent>
               </Card>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <Card>
                    <CardHeader><CardTitle className="text-lg text-blue-600 font-bold flex items-center gap-2"><Package className="h-5 w-5" /> 1. Ingresar Nota de Remisión</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>N° de Remisión / Envío</Label>
                          <Input placeholder="Ej. REM-001" value={manualPurchase.codigoGeneracion} onChange={e => setManualPurchase({...manualPurchase, codigoGeneracion: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Fecha de Entrega</Label>
                          <Input type="date" value={manualPurchase.issueDate.split('T')[0]} onChange={e => setManualPurchase({...manualPurchase, issueDate: new Date(e.target.value).toISOString()})} />
                        </div>
                      </div>
                      
                      <div className="bg-muted/40 p-4 rounded-xl border space-y-3">
                        <h4 className="text-xs font-bold uppercase text-muted-foreground">Agregar Productos Entregados</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <Input className="h-8 text-xs" placeholder="Código" value={tempManualItem.code} onChange={e => setTempManualItem({...tempManualItem, code: e.target.value})} />
                          <Input className="h-8 text-xs sm:col-span-2" placeholder="Descripción" value={tempManualItem.description} onChange={e => setTempManualItem({...tempManualItem, description: e.target.value})} />
                          <Input type="number" className="h-8 text-xs text-right" placeholder="Cant." value={tempManualItem.quantity} onChange={e => setTempManualItem({...tempManualItem, quantity: Number(e.target.value)})} />
                        </div>
                        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={handleAddManualItem}>Añadir a Remisión</Button>
                      </div>

                      {manualItems.length > 0 && (
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader className="bg-muted"><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Cant.</TableHead></TableRow></TableHeader>
                            <TableBody>
                              {manualItems.map((item, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="text-xs py-1.5">{item.code} - {item.description}</TableCell>
                                  <TableCell className="text-xs py-1.5 text-right">{item.quantity}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <div className="p-3 bg-muted/30">
                            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleSaveRemission}>Guardar Nota de Remisión</Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                 </Card>

                 <Card>
                    <CardHeader><CardTitle className="text-lg text-green-600 font-bold flex items-center gap-2"><ReceiptText className="h-5 w-5" /> 2. Cargar Venta Emitida</CardTitle></CardHeader>
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
                           {(() => {
                             const customer = entities.find(e => e.id === currentProject?.customerId)
                             const isGC = customer?.isGranContribuyente || false
                             const isCCF = (mappedData.documentType || '01') === '03'
                             const subtotal = mappedData.subtotal || 0
                             const tax = mappedData.taxAmount || (subtotal * 0.13)
                             const parsedRetention = mappedData.retentionAmount || 0
                             const calculatedRetention = parsedRetention > 0 
                               ? parsedRetention 
                               : (isGC && isCCF && subtotal >= 100 ? subtotal * 0.01 : 0)
                             const perception = mappedData.perceptionAmount || 0
                             const adjustedTotal = subtotal + tax - calculatedRetention + perception

                             return (
                               <>
                                 <div className="p-4 bg-muted rounded-xl space-y-2 text-xs">
                                    <div className="flex justify-between"><span>Subtotal:</span><span>${subtotal.toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>IVA (13%):</span><span>${tax.toFixed(2)}</span></div>
                                    {calculatedRetention > 0 && (
                                      <div className="flex justify-between text-red-500 font-medium animate-in fade-in duration-300">
                                        <span>Retención IVA (1%):</span>
                                        <span>-${calculatedRetention.toFixed(2)}</span>
                                      </div>
                                    )}
                                    {perception > 0 && (
                                      <div className="flex justify-between text-green-600 font-medium">
                                        <span>Percepción IVA (1%):</span>
                                        <span>+${perception.toFixed(2)}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between text-base font-black border-t mt-2 pt-2 text-foreground">
                                      <span>Total a Recibir:</span>
                                      <span>${adjustedTotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between border-t pt-2 mt-2 text-muted-foreground">
                                      <span>Objetivo OC:</span>
                                      <span>${currentProject?.targetSaleAmount.toFixed(2)}</span>
                                    </div>
                                 </div>

                                 {calculatedRetention > 0 && (
                                    <div className="p-3 bg-red-50/70 dark:bg-red-950/20 text-red-700 dark:text-red-300 rounded-lg border border-red-200/50 dark:border-red-900/30 text-[10px] space-y-1 animate-in zoom-in-95 duration-300">
                                      <p className="font-bold flex items-center gap-1.5 uppercase tracking-wide text-red-800 dark:text-red-200">
                                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shrink-0"></span>
                                        Retención del 1% IVA Aplicada
                                      </p>
                                      <p className="leading-relaxed">
                                        Identificada según normativa de Hacienda (Art. 162 C.T.). El cliente <strong>{currentProject?.customerName}</strong> es <strong>Gran Contribuyente</strong> en un Crédito Fiscal superior a $100.00.
                                      </p>
                                    </div>
                                  )}

                                  {isGC && isCCF && subtotal >= 100 && parsedRetention === 0 && (
                                    <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 rounded-lg border border-amber-200/50 dark:border-amber-900/30 text-[10px] space-y-1 animate-in zoom-in-95 duration-300">
                                      <p className="font-bold flex items-center gap-1.5 uppercase tracking-wide text-amber-800 dark:text-amber-200">
                                        ⚠️ Advertencia de Cumplimiento
                                      </p>
                                      <p className="leading-relaxed">
                                        La operación califica para <strong>Retención del 1% de IVA</strong> (Gran Contribuyente y CCF &gt;= $100.00), pero el archivo subido no la reportaba en <code>ivaRete1</code>. Hemos autocalculado <strong>${(subtotal * 0.01).toFixed(2)}</strong> para conciliar.
                                      </p>
                                    </div>
                                  )}

                                  {!isGC && parsedRetention > 0 && (
                                    <div className="p-3 bg-blue-50/70 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200/50 dark:border-blue-900/30 text-[10px] space-y-1 animate-in zoom-in-95 duration-300">
                                      <p className="font-bold flex items-center gap-1.5 uppercase tracking-wide text-blue-800 dark:text-blue-200">
                                        ℹ️ Ajuste de Cliente
                                      </p>
                                      <p className="leading-relaxed">
                                        La factura de venta contiene <strong>Retención del 1% de IVA</strong> en origen. Hemos aplicado el valor del DTE, aunque el cliente no figuraba como Gran Contribuyente en nuestro catálogo.
                                      </p>
                                    </div>
                                  )}

                                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                   <Button variant="outline" className="w-full" onClick={() => handleSaveInvoice(false)}>Guardar Parcial</Button>
                                   <Button className="w-full bg-primary" onClick={() => handleSaveInvoice(true)}>Cerrar Proyecto y Guardar</Button>
                                 </div>
                               </>
                             )
                           })()}
                        </div>
                      ) : <div className="py-20 text-center opacity-40 italic text-xs">Cargue el DTE de venta.</div>}
                   </CardContent>
                </Card>
             </div>
             </div>
           )}
        </TabsContent>
      </Tabs>

      <Dialog open={viewingInvoice !== null} onOpenChange={(open) => { if (!open) setViewingInvoice(null) }}>
        <DialogContent className="sm:max-w-[700px] w-[95vw] max-h-[90vh] overflow-y-auto bg-background text-foreground font-sans p-6 rounded-xl border border-border shadow-2xl dte-visualizer-modal">
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              /* Collapse the application's screen layout footprint completely during print */
              .no-print-layout {
                display: none !important;
              }
              /* Hide everything else by default as a safety fallback */
              body * {
                visibility: hidden !important;
              }
              /* Explicitly hide any other active dialogs/modals except our DTE modal */
              [role="dialog"]:not(.dte-visualizer-modal) {
                display: none !important;
              }
              /* Hide Radix Portal overlays and sibling elements safely without hiding our DTE positioning wrapper */
              [data-radix-portal] [class*="bg-black"],
              [data-radix-focus-guard], 
              button[aria-label="Close"], 
              .no-print {
                display: none !important;
              }
              /* Show ONLY our specific DTE modal and its content, preserving table/grid/flex displays */
              .dte-visualizer-modal, .dte-visualizer-modal * {
                visibility: visible !important;
              }
              /* Set clean document margins */
              @page {
                size: auto;
                margin: 15mm 10mm 15mm 10mm;
              }
              /* Force html/body to flow naturally without vh boundaries to avoid blank pages */
              html, body {
                height: auto !important;
                min-height: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
              }
              /* Reset only our DTE dialog positioning and force white print styles */
              .dte-visualizer-modal {
                position: relative !important;
                left: 0 !important;
                top: 0 !important;
                transform: none !important;
                max-width: 100% !important;
                width: 100% !important;
                height: auto !important;
                max-height: none !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
                color: black !important;
                display: block !important;
                overflow: visible !important;
              }
              #dte-print-area {
                position: relative !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                color: black !important;
                overflow: visible !important;
              }
              /* Force all nested text and backgrounds to be optimized for white paper */
              #dte-print-area * {
                background: transparent !important;
                color: black !important;
                border-color: #e2e8f0 !important;
              }
            }
          `}} />
          
          <div id="dte-print-area">
            <DialogHeader className="border-b border-border pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <DialogTitle className="text-xl font-bold uppercase tracking-wider text-primary">Representación Gráfica DTE</DialogTitle>
                  <p className="text-xs text-muted-foreground">Documento Tributario Electrónico - El Salvador</p>
                </div>
                <div className="text-right">
                  <Badge className={cn("text-xs border-none font-bold px-2.5 py-1 text-white", viewingInvoice?.type === 'purchase' ? "bg-blue-600" : "bg-green-600")}>
                    {viewingInvoice?.type === 'purchase' ? 'COMPRA (INGRESO)' : 'VENTA (EMITIDO)'}
                  </Badge>
                </div>
              </div>
            </DialogHeader>

            {viewingInvoice && (
              <div className="space-y-6 pt-4 text-xs">
                {/* Emisor y DTE Header */}
                <div className="grid grid-cols-2 gap-4 border border-border p-4 rounded-lg bg-muted/30">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Pinturas Tecnicolor</h3>
                    <p className="text-muted-foreground text-[10px]">San Salvador, El Salvador</p>
                    <p className="text-[10px] text-muted-foreground/80 mt-1">Giro: Venta de pinturas y acabados</p>
                  </div>
                  <div className="border-l border-border pl-4 flex flex-col justify-between">
                    <div>
                      <span className="font-bold uppercase text-[9px] text-muted-foreground block">Tipo Documento</span>
                      <span className="font-bold text-foreground text-[11px] sm:text-xs">
                        {viewingInvoice.documentType === '03' ? 'Comprobante de Crédito Fiscal (CCF)' : viewingInvoice.documentType === '01' ? 'Factura de Consumidor Final (FAC)' : 'Documento DTE'}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <span className="font-bold uppercase text-[9px] text-muted-foreground block">No. Documento</span>
                        <span className="font-mono text-foreground/90 font-bold">{viewingInvoice.invoiceNumber}</span>
                      </div>
                      {viewingInvoice.numeroControl && (
                        <div>
                          <span className="font-bold uppercase text-[9px] text-muted-foreground block">No. Control</span>
                          <span className="font-mono text-foreground/90 font-bold">{viewingInvoice.numeroControl}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Detalles de la Transacción */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-bold uppercase text-[9px] text-muted-foreground block">Entidad Asociada</span>
                    <span className="font-bold text-sm text-foreground">{viewingInvoice.entityName}</span>
                    <span className="text-[10px] text-muted-foreground block">ID: {viewingInvoice.entityId}</span>
                  </div>
                  <div>
                    <span className="font-bold uppercase text-[9px] text-muted-foreground block">Fecha de Emisión</span>
                    <span className="font-semibold text-foreground/90">{new Date(viewingInvoice.issueDate).toLocaleString()}</span>
                  </div>
                </div>

                {/* Tabla de Items */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead className="bg-muted border-b border-border">
                      <tr>
                        <th className="p-2 text-left font-bold text-muted-foreground">Cant.</th>
                        <th className="p-2 text-left font-bold text-muted-foreground">Código</th>
                        <th className="p-2 text-left font-bold text-muted-foreground">Descripción</th>
                        <th className="p-2 text-right font-bold text-muted-foreground">Precio Unit.</th>
                        <th className="p-2 text-right font-bold text-muted-foreground">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                      {viewingInvoice.items && viewingInvoice.items.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-muted/30">
                          <td className="p-2 text-foreground/80">{item.quantity}</td>
                          <td className="p-2 font-mono text-[10px] text-muted-foreground">{item.code || 'S/C'}</td>
                          <td className="p-2 font-medium text-foreground">{item.description}</td>
                          <td className="p-2 text-right text-foreground/80">${item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="p-2 text-right font-bold text-foreground">${item.lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totales */}
                <div className="flex justify-end">
                  <div className="w-[250px] space-y-1.5 border border-border p-3 rounded-lg bg-muted/30 text-[11px]">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal:</span>
                      <span className="text-foreground">${viewingInvoice.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>IVA (13%):</span>
                      <span className="text-foreground">${viewingInvoice.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {viewingInvoice.retentionAmount && viewingInvoice.retentionAmount > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Retención (1%):</span>
                        <span className="text-red-500 text-right">-${viewingInvoice.retentionAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {viewingInvoice.perceptionAmount && viewingInvoice.perceptionAmount > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Percepción (1%):</span>
                        <span className="text-green-600 text-right">+${viewingInvoice.perceptionAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black text-foreground border-t border-border pt-1.5">
                      <span>TOTAL A PAGAR:</span>
                      <span>${viewingInvoice.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="mt-4 border-t border-border pt-4 no-print">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
              <Download className="h-3.5 w-3.5" /> Imprimir / PDF
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => setViewingInvoice(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingTransaction !== null} onOpenChange={(open) => { if (!open) setEditingTransaction(null) }}>
        <DialogContent className="sm:max-w-[800px] w-[95vw] max-h-[85vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-bold font-headline">Editar DTE (Factura/Remisión)</DialogTitle>
            <CardDescription>
              Modifique las cantidades o descripciones de esta transacción para ajustarla al proyecto actual.
            </CardDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {editingTransaction && (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted border-b border-border text-xs">
                    <tr>
                      <th className="p-2 text-left font-bold text-muted-foreground w-20">Cant.</th>
                      <th className="p-2 text-left font-bold text-muted-foreground">Código</th>
                      <th className="p-2 text-left font-bold text-muted-foreground">Descripción</th>
                      <th className="p-2 text-right font-bold text-muted-foreground">P.U.</th>
                      <th className="p-2 text-right font-bold text-muted-foreground">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {(editingTransaction.items || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="p-2">
                          <Input 
                            type="number" 
                            className="h-8 w-20 text-xs" 
                            value={item.quantity} 
                            onChange={(e) => {
                              const newQty = Number(e.target.value);
                              const newItems = [...editingTransaction.items];
                              newItems[idx] = { ...item, quantity: newQty, lineTotal: newQty * item.unitPrice };
                              setEditingTransaction({ ...editingTransaction, items: newItems });
                            }} 
                          />
                        </td>
                        <td className="p-2">
                          <Input 
                            className="h-8 text-xs font-mono" 
                            value={item.code || ''} 
                            onChange={(e) => {
                              const newItems = [...editingTransaction.items];
                              newItems[idx] = { ...item, code: e.target.value };
                              setEditingTransaction({ ...editingTransaction, items: newItems });
                            }} 
                          />
                        </td>
                        <td className="p-2">
                          <Input 
                            className="h-8 text-xs" 
                            value={item.description} 
                            onChange={(e) => {
                              const newItems = [...editingTransaction.items];
                              newItems[idx] = { ...item, description: e.target.value };
                              setEditingTransaction({ ...editingTransaction, items: newItems });
                            }} 
                          />
                        </td>
                        <td className="p-2 text-right text-muted-foreground">
                          ${item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-right font-bold text-foreground">
                          ${(item.quantity * item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {editingTransaction && (
              <div className="flex justify-end mt-4">
                <div className="w-[250px] space-y-1.5 border border-border p-3 rounded-lg bg-muted/30 text-[11px]">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span className="text-foreground">
                      ${(editingTransaction.items || []).reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {editingTransaction.documentType === '03' && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>IVA (13%):</span>
                      <span className="text-foreground">
                        ${((editingTransaction.items || []).reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0) * 0.13).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-foreground border-t border-border pt-1.5 mt-1.5">
                    <span>TOTAL PROYECTADO:</span>
                    <span>
                      ${((editingTransaction.items || []).reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0) * (editingTransaction.documentType === '03' ? 1.13 : 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 border-t border-border pt-4">
            <Button variant="outline" size="sm" onClick={() => setEditingTransaction(null)}>
              Cancelar
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={handleEditTransactionSave}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
