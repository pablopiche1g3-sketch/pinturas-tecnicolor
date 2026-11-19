
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
import { aiTenderParser, aiTenderAuditor, aiInvoiceProjectMatcher, type AiTenderParserOutput, type TenderAuditorOutput } from "@/ai/flows/ai-tender-parser"
import { calculateProductMatches } from "@/lib/tender-utils"
import { Loader2, Plus, Briefcase, Calculator, ReceiptText, Trash2, Upload, XCircle, Package, Pencil, CheckCircle, FileText, CheckCircle2, FileDown, Eye, Download, Maximize2, Sliders, Edit2, GitMerge, Layers, TrendingUp, Info, PlayCircle, Archive, Search, Sparkles, Link2, Bot, FileSearch, Check, AlertCircle, HelpCircle, ChevronDown, ChevronUp, ChevronRight, Boxes } from "lucide-react"
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
    entities, projects, transactions, addEntity, addProject, updateProject, deleteProject, mergeProjects,
    addTransaction, updateTransaction, voidTransaction, deleteTransaction, addToInventory, addDocumentToProject, deleteDocumentFromProject 
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
  const [projectFilterTab, setProjectFilterTab] = React.useState<'active' | 'completed' | 'all'>('active')
  const [projectSearchQuery, setProjectSearchQuery] = React.useState<string>('')

  // Kits y Componentes de Bodega
  const [expandedKitCodes, setExpandedKitCodes] = React.useState<Record<string, boolean>>({})
  const [isKitConfigOpen, setIsKitConfigOpen] = React.useState(false)
  const [kitTargetParentCode, setKitTargetParentCode] = React.useState<string>('')
  const [kitSelectedChildCodes, setKitSelectedChildCodes] = React.useState<string[]>([])

  const handleUpdateProductProperty = (idx: number, key: keyof ProjectProduct, value: any) => {
    setNewProjectProducts(prev => prev.map((p, i) => i === idx ? { ...p, [key]: value } : p))
  }
  
  const [newProject, setNewProject] = React.useState({
    name: '',
    purchaseOrder: '',
    targetSaleAmount: 0,
    customerId: '',
    warrantyStartDate: '',
    warrantyMonths: 0,
    deliveryDeadline: '',
    deliveryAddress: '',
    paymentTerms: '',
    orderRequirements: ''
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
  const fileInputExcelRef = React.useRef<HTMLInputElement>(null)

  const [viewingProductDetail, setViewingProductDetail] = React.useState<{
    code: string;
    description: string;
    expectedQty: number;
    expectedPrice: number;
  } | null>(null)

  const [isMergeDialogOpen, setIsMergeDialogOpen] = React.useState(false)
  const [sourceProjectToMerge, setSourceProjectToMerge] = React.useState<Project | null>(null)
  const [targetProjectIdToMerge, setTargetProjectIdToMerge] = React.useState<string>('')
  const [isMerging, setIsMerging] = React.useState(false)

  // Mapeo interactivo e interpretación con IA de productos entre Facturas/DTEs y Orden de Compra
  const [itemMappings, setItemMappings] = React.useState<Record<number, string>>({})
  const [isMatchingInvoiceAI, setIsMatchingInvoiceAI] = React.useState(false)
  const [aiMatchReasons, setAiMatchReasons] = React.useState<Record<number, string>>({})
  const [aiUnificationSummary, setAiUnificationSummary] = React.useState<string>('')
  const [isBatchUnifyingProject, setIsBatchUnifyingProject] = React.useState(false)

  // Licitación / Orden de Compra (Word o PDF) con IA
  const [isTenderModalOpen, setIsTenderModalOpen] = React.useState(false)
  const [isAnalyzingTender, setIsAnalyzingTender] = React.useState(false)
  const [isSavingTenderProject, setIsSavingTenderProject] = React.useState(false)
  const [isDraggingTender, setIsDraggingTender] = React.useState(false)
  const [tenderFile, setTenderFile] = React.useState<{ name: string; dataUri: string; size: number } | null>(null)
  const [tenderParsedData, setTenderParsedData] = React.useState<AiTenderParserOutput | null>(null)
  const [tenderTargetProjectId, setTenderTargetProjectId] = React.useState<string>('new')
  const tenderFileInputRef = React.useRef<HTMLInputElement>(null)

  // Auditoría IA de Licitación
  const [isAuditModalOpen, setIsAuditModalOpen] = React.useState(false)
  const [isAuditingTender, setIsAuditingTender] = React.useState(false)
  const [auditResult, setAuditResult] = React.useState<TenderAuditorOutput | null>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const customers = entities.filter(e => e.type === 'customer')
  const suppliers = entities.filter(e => e.type === 'supplier')
  const currentProject = projects.find(p => p.id === selectedProjectId)
  const projectTransactions = transactions.filter(t => t.projectId === selectedProjectId && !t.isVoided)
  
  const projectCosts = projectTransactions.filter(t => t.type === 'purchase').reduce((acc, curr) => acc + curr.totalAmount, 0)

  const toggleExpandKit = (code: string) => {
    setExpandedKitCodes(prev => ({ ...prev, [code]: !prev[code] }))
  }

  const handleLinkItemsToParent = async (childCodes: string[], parentCode: string, autoAdjustBudget = false) => {
    if (!currentProject) return
    const updatedProducts = (currentProject.expectedProducts || []).map(p => {
      if (childCodes.includes(p.code) || childCodes.includes(p.description)) {
        return { ...p, parentCode }
      }
      if (p.code === parentCode) {
        return { ...p, isKit: true }
      }
      return p
    })

    const officialTotal = updatedProducts
      .filter(p => !p.parentCode)
      .reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0)

    const updatePayload: any = { expectedProducts: updatedProducts }
    if (autoAdjustBudget && officialTotal > 0) {
      updatePayload.targetSaleAmount = officialTotal
    }

    try {
      await updateProject(db, currentProject.id, updatePayload)
      toast({
        title: "Kits e Insumos Actualizados",
        description: `Se vincularon ${childCodes.length} insumos de bodega al Renglón Principal [${parentCode}].`
      })
      setIsKitConfigOpen(false)
    } catch (err: any) {
      toast({
        title: "Error al actualizar",
        description: err.message || "No se pudo actualizar el proyecto.",
        variant: "destructive"
      })
    }
  }

  const handleUnlinkItem = async (childCodeOrDesc: string) => {
    if (!currentProject) return
    const updatedProducts = (currentProject.expectedProducts || []).map(p => {
      if (p.code === childCodeOrDesc || p.description === childCodeOrDesc) {
        const { parentCode, quantityPerParent, ...rest } = p
        return rest
      }
      return p
    })
    try {
      await updateProject(db, currentProject.id, { expectedProducts: updatedProducts })
      toast({
        title: "Insumo Desvinculado",
        description: "El producto ahora es un renglón independiente de la licitación."
      })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const cleanString = (str: any) => {
    if (!str) return '';
    return String(str)
      .replace(/[\r\n\t\u200B-\u200D\uFEFF]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const cleanStringLower = (str: any) => {
    return cleanString(str).toLowerCase();
  };

  const getMatchingExpectedProduct = (i: any, expectedProducts: any[]) => {
    if (!expectedProducts || expectedProducts.length === 0) return null;

    // 1. Vinculación explícita (Mapeo seleccionado manualmente o asignado por IA)
    if (i?.matchedProductCode) {
      if (i.matchedProductCode === '__UNMATCHED__') return null;
      const byMatched = expectedProducts.find(ep => cleanStringLower(ep.code) === cleanStringLower(i.matchedProductCode));
      if (byMatched) return byMatched;
    }

    // 2. Si la Orden de Compra tiene UN SOLO ÍTEM (donde se agrupan varios productos de facturas de proveedores),
    // todo producto del proyecto se unifica en ese único ítem de la OC salvo que haya sido marcado explícitamente como excedente.
    if (expectedProducts.length === 1) {
      return expectedProducts[0];
    }

    const iCode = cleanStringLower(i.code);
    if (iCode) {
      const byCode = expectedProducts.find(ep => cleanStringLower(ep.code) === iCode);
      if (byCode) return byCode;
    }

    const iDesc = cleanStringLower(i.description);
    if (!iDesc) return expectedProducts[0];

    const exactDesc = expectedProducts.find(ep => cleanStringLower(ep.description) === iDesc);
    if (exactDesc) return exactDesc;

    const matches = expectedProducts.filter(ep => {
      const epDesc = cleanStringLower(ep.description);
      if (!epDesc) return false;
      if (iDesc.includes(epDesc) || epDesc.includes(iDesc)) return true;
      
      const iWords = iDesc.split(' ').filter(Boolean);
      const epWords = epDesc.split(' ').filter(Boolean);
      if (iWords.length === 0 || epWords.length === 0) return false;

      const allEpInI = epWords.every((w: string) => iWords.includes(w));
      const allIInEp = iWords.every((w: string) => epWords.includes(w));
      
      return allEpInI || allIInEp;
    });

    if (matches.length > 0) {
      return matches.reduce((prev, current) => {
        const diffPrev = Math.abs(cleanStringLower(prev.description).length - iDesc.length);
        const diffCurr = Math.abs(cleanStringLower(current.description).length - iDesc.length);
        return diffPrev < diffCurr ? prev : current;
      });
    }

    // 3. Fallback semántico por sinónimos de pinturas (látex, esmalte, epóxico, thinner, etc.)
    const semanticMatch = calculateProductMatches(
      [{ code: i.code, description: i.description || '', quantity: i.quantity || 1 }],
      expectedProducts
    );
    if (semanticMatch[0]) {
      const bySemantic = expectedProducts.find(ep => cleanStringLower(ep.code) === cleanStringLower(semanticMatch[0]));
      if (bySemantic) return bySemantic;
    }

    return null;
  }

  const getProductProgress = (ep: any, projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    const txs = transactions.filter(t => t.projectId === projectId && !t.isVoided)
    
    const delivered = txs
      .filter(t => t.type === 'remission')
      .flatMap(t => t.items || [])
      .filter(i => {
        const match = getMatchingExpectedProduct(i, project?.expectedProducts || []);
        return match && match.code === ep.code && match.description === ep.description;
      })
      .reduce((acc, curr) => acc + (curr?.quantity || 0), 0)

    const invoiced = txs
      .filter(t => t.type === 'sale')
      .flatMap(t => t.items || [])
      .filter(i => {
        const match = getMatchingExpectedProduct(i, project?.expectedProducts || []);
        return match && match.code === ep.code && match.description === ep.description;
      })
      .reduce((acc, curr) => acc + (curr?.quantity || 0), 0)
    
    const effectiveProgressAmount = Math.max(delivered, invoiced)
    const expected = ep.quantity || 1
    return Math.min((effectiveProgressAmount / expected) * 100, 100)
  }

  const handleAddProductToProject = () => {
    const cleanCode = cleanString(tempProduct.code);
    const cleanDesc = cleanString(tempProduct.description);
    if (!cleanCode || !cleanDesc) return;
    setNewProjectProducts([...newProjectProducts, { ...tempProduct, code: cleanCode, description: cleanDesc }]);
    setTempProduct({ code: '', description: '', quantity: 1, unitPrice: 0 })
  }

  const handleCreateOrUpdateProject = async () => {
    if (!newProject.name.trim()) {
      toast({ title: "Falta Nombre del Proyecto", description: "Por favor ingrese el nombre del proyecto.", variant: "destructive" })
      return
    }
    const finalPO = newProject.purchaseOrder.trim() || `OC-${new Date().getFullYear()}`
    const customer = customers.find(c => c.id === newProject.customerId) || customers[0]
    const finalCustomerId = customer?.id || newProject.customerId || 'institucional'
    const finalCustomerName = customer?.name || 'Cliente Institucional'
    
    if (editingProject) {
      updateProject(db, editingProject.id, {
        name: newProject.name.trim(),
        purchaseOrder: finalPO,
        targetSaleAmount: Number(newProject.targetSaleAmount) || 0,
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        expectedProducts: newProjectProducts,
        warrantyStartDate: newProject.warrantyStartDate || null,
        warrantyMonths: newProject.warrantyMonths || null,
        deliveryDeadline: newProject.deliveryDeadline || null,
        deliveryAddress: newProject.deliveryAddress || null,
        paymentTerms: newProject.paymentTerms || null,
        orderRequirements: newProject.orderRequirements || null,
      })
      toast({ title: "Proyecto Actualizado", description: "Cambios guardados exitosamente." })
    } else {
      const createdId = await addProject(db, {
        name: newProject.name.trim(),
        purchaseOrder: finalPO,
        targetSaleAmount: Number(newProject.targetSaleAmount) || newProjectProducts.reduce((acc, p) => acc + (p.quantity * p.unitPrice), 0),
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        expectedProducts: newProjectProducts,
        status: 'active',
        warrantyStartDate: newProject.warrantyStartDate || null,
        warrantyMonths: newProject.warrantyMonths || null,
        deliveryDeadline: newProject.deliveryDeadline || null,
        deliveryAddress: newProject.deliveryAddress || null,
        paymentTerms: newProject.paymentTerms || null,
        orderRequirements: newProject.orderRequirements || null,
      })
      if (createdId) {
        setSelectedProjectId(createdId)
        setProjectFilterTab('active')
      }
      toast({ title: "Proyecto Creado", description: "El proyecto se ha registrado exitosamente." })
    }

    setNewProject({ name: '', purchaseOrder: '', targetSaleAmount: 0, customerId: '', warrantyStartDate: '', warrantyMonths: 0, deliveryDeadline: '', deliveryAddress: '', paymentTerms: '', orderRequirements: '' })
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
      warrantyMonths: project.warrantyMonths || 0,
      deliveryDeadline: project.deliveryDeadline || '',
      deliveryAddress: project.deliveryAddress || '',
      paymentTerms: project.paymentTerms || '',
      orderRequirements: project.orderRequirements || '',
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

    const fileNameLower = file.name.toLowerCase();
    const isWordDoc = fileNameLower.endsWith('.docx') || fileNameLower.endsWith('.doc') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'application/msword';

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf' && !isWordDoc) {
      toast({ title: "Formato no válido", description: "Solo se permiten documentos Word (.docx/.doc), PDF e imágenes.", variant: "destructive" })
      return
    }

    setIsUploading(true)

    try {
      let finalDataUrl = "";
      let finalName = file.name;
      let finalMimeType = isWordDoc
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf';

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
        // Es un Word o PDF, leerlo tal cual
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
        type: finalMimeType,
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

  const handleDownloadTemplate = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet([
        { CODIGO: "PT-001", CANTIDAD: 10, "PRECIO VENTA": 15.50, "DESCRIPCION DEL PRODUCTO": "Pintura Acrílica Blanca" }
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
      XLSX.writeFile(wb, "Plantilla_Carga_Productos.xlsx");
      toast({ title: "Plantilla descargada", description: "Llena el archivo Excel y súbelo para cargar los productos." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo generar la plantilla.", variant: "destructive" });
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc') || lowerName.endsWith('.pdf')) {
      e.target.value = '';
      await processTenderFile(file, true);
      return;
    }
    
    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          
          let importedCount = 0;
          const newProducts = [...newProjectProducts];
          
          data.forEach((row: any) => {
            const rawCode = row['CODIGO'] || row['codigo'] || row['Codigo'] || '';
            const qty = Number(row['CANTIDAD'] || row['cantidad'] || row['Cantidad']) || 0;
            const price = Number(row['PRECIO VENTA'] || row['precio'] || row['Precio'] || row['PRECIO']) || 0;
            const rawDesc = row['DESCRIPCION DEL PRODUCTO'] || row['descripcion'] || row['Descripcion'] || row['DESCRIPCION'] || '';
            
            const code = cleanString(rawCode);
            const desc = cleanString(rawDesc);

            if (desc && qty > 0) {
              newProducts.push({
                code: String(code),
                description: String(desc),
                quantity: qty,
                unitPrice: price,
              });
              importedCount++;
            }
          });
          
          setNewProjectProducts(newProducts);
          toast({ title: "Importación exitosa", description: `Se importaron ${importedCount} productos del archivo Excel.` });
        } catch (err) {
           toast({ title: "Error de lectura", description: "El archivo Excel no tiene el formato correcto.", variant: "destructive" });
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo procesar el archivo Excel.", variant: "destructive" });
    }
    e.target.value = '';
  };

  const handleConfirmMerge = async () => {
    if (!sourceProjectToMerge || !targetProjectIdToMerge) return;
    const targetProject = projects.find(p => p.id === targetProjectIdToMerge);
    if (!targetProject) return;

    setIsMerging(true);
    try {
      await mergeProjects(db, sourceProjectToMerge.id, targetProjectIdToMerge, sourceProjectToMerge, targetProject, transactions);
      toast({
        title: "Proyectos Unificados",
        description: `El proyecto "${sourceProjectToMerge.name}" se fusionó exitosamente con "${targetProject.name}".`
      });
      setIsMergeDialogOpen(false);
      const newSelectedId = targetProjectIdToMerge;
      setSourceProjectToMerge(null);
      setTargetProjectIdToMerge('');
      if (selectedProjectId === sourceProjectToMerge.id) {
        setSelectedProjectId(newSelectedId);
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error al unificar",
        description: err.message || "No se pudieron fusionar los proyectos.",
        variant: "destructive"
      });
    } finally {
      setIsMerging(false);
    }
  };

  const getDuplicateTransactionsForProject = (projectId?: string) => {
    if (!projectId) return [];
    const projectTxs = transactions.filter(t => t.projectId === projectId && !t.isVoided);
    const seen = new Set<string>();
    const duplicates: typeof transactions = [];

    projectTxs.forEach(tx => {
      const numKey = (tx.numeroControl || tx.invoiceNumber || '').trim().toLowerCase();
      if (!numKey) return;
      const key = `${tx.type}:${numKey}`;
      
      if (seen.has(key)) {
        duplicates.push(tx);
      } else {
        seen.add(key);
      }
    });

    return duplicates;
  };

  const handlePurgeDuplicates = (projectId?: string) => {
    if (!projectId) return;
    const projectTxs = transactions.filter(t => t.projectId === projectId && !t.isVoided);
    
    // Group transactions by type and invoiceNumber
    const groups = new Map<string, Transaction[]>();

    projectTxs.forEach(tx => {
      const numKey = (tx.numeroControl || tx.invoiceNumber || '').trim().toLowerCase();
      if (!numKey) return;
      const key = `${tx.type}:${numKey}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(tx);
    });

    const duplicateGroups = Array.from(groups.values()).filter(g => g.length > 1);

    if (duplicateGroups.length === 0) {
      toast({ title: "Sin Facturas Repetidas", description: "No se encontraron facturas duplicadas en este proyecto." });
      return;
    }

    const totalDuplicatesCount = duplicateGroups.reduce((acc, g) => acc + (g.length - 1), 0);

    if (confirm(`Se encontraron ${duplicateGroups.length} factura(s) con registros divididos/repetidos (${totalDuplicatesCount} duplicados).\n\n¿Desea UNIFICAR todos los productos y montos en la factura principal y eliminar los registros repetidos?`)) {
      duplicateGroups.forEach(group => {
        // Sort: main entity first (not global_inventory transfer), oldest date first
        group.sort((a, b) => {
          const aIsTransfer = a.entityId === 'global_inventory' || a.entityName?.toLowerCase().includes('traslado');
          const bIsTransfer = b.entityId === 'global_inventory' || b.entityName?.toLowerCase().includes('traslado');
          if (aIsTransfer && !bIsTransfer) return 1;
          if (!aIsTransfer && bIsTransfer) return -1;
          return new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime();
        });

        const primaryTx = group[0];
        const extraTxs = group.slice(1);

        let mergedItems = [...(primaryTx.items || [])];

        extraTxs.forEach(tx => {
          (tx.items || []).forEach(item => {
            const cleanCode = (item.code || '').trim().toLowerCase();
            const cleanDesc = (item.description || '').trim().toLowerCase();

            const existingIdx = mergedItems.findIndex(mi => 
              (cleanCode && cleanCode !== 's/c' && (mi.code || '').trim().toLowerCase() === cleanCode) ||
              ((mi.description || '').trim().toLowerCase() === cleanDesc)
            );

            if (existingIdx >= 0) {
              const old = mergedItems[existingIdx];
              const newQty = (old.quantity || 0) + (item.quantity || 0);
              mergedItems[existingIdx] = {
                ...old,
                quantity: newQty,
                lineTotal: newQty * (old.unitPrice || item.unitPrice || 0)
              };
            } else {
              mergedItems.push({ ...item });
            }
          });
        });

        const newSubtotal = mergedItems.reduce((sum, i) => sum + (i.lineTotal || 0), 0);
        const newTotal = newSubtotal + (primaryTx.taxAmount || 0) - (primaryTx.retentionAmount || 0) + (primaryTx.perceptionAmount || 0);

        updateTransaction(db, primaryTx.id, {
          items: mergedItems,
          subtotal: newSubtotal,
          totalAmount: newTotal,
          costBasis: newTotal
        });

        extraTxs.forEach(tx => {
          deleteTransaction(db, tx.id);
        });
      });

      toast({
        title: "Facturas Unificadas Exitosamente",
        description: `Los productos y montos fueron integrados en la factura principal y se eliminaron ${totalDuplicatesCount} registro(s) repetidos.`,
      });
    }
  };

  // Licitación / Orden de Compra (Word o PDF) con IA - Handlers
  const populateFormFromTenderData = async (data: AiTenderParserOutput) => {
    const tenderItems: ProjectProduct[] = (data.items || []).map((it, idx) => {
      const qty = Number(it.quantity) || 1
      let up = Number(it.unitPrice) || 0
      if (up === 0 && Number(it.lineTotal) > 0) {
        up = Number((Number(it.lineTotal) / qty).toFixed(4))
      }
      return {
        code: cleanString(it.code) || `Renglón ${idx + 1}`,
        description: cleanString(it.description) || `Producto Renglón ${idx + 1}`,
        quantity: qty,
        unitPrice: up,
        unit: it.unit || 'Unidad',
      }
    })

    const itemsSum = Number(tenderItems.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0).toFixed(2))
    const calculatedBudget = Number(data.totalBudget) > 0 ? Number(data.totalBudget) : itemsSum

    let matchedCustId = newProject.customerId || ''
    if (data.customerName) {
      const cust = entities.find(e => e.type === 'customer' && 
        (cleanStringLower(e.name).includes(cleanStringLower(data.customerName)) ||
         cleanStringLower(data.customerName).includes(cleanStringLower(e.name)))
      )
      if (cust) {
        matchedCustId = cust.id
      } else {
        try {
          matchedCustId = await addEntity(db, {
            name: data.customerName.trim(),
            type: 'customer',
            isGranContribuyente: true,
          })
        } catch (err) {
          console.warn('No se pudo crear cliente automáticamente:', err)
        }
      }
    }
    if (!matchedCustId) {
      const fallbackCust = entities.find(e => e.type === 'customer')
      if (fallbackCust) matchedCustId = fallbackCust.id
    }

    setNewProject(prev => ({
      ...prev,
      name: data.projectName || prev.name || `Orden de Compra ${data.purchaseOrder || ''}`.trim() || 'Nuevo Proyecto OC',
      purchaseOrder: data.purchaseOrder || prev.purchaseOrder || `OC-${new Date().getFullYear()}`,
      targetSaleAmount: calculatedBudget || prev.targetSaleAmount || 0,
      customerId: matchedCustId,
      warrantyStartDate: prev.warrantyStartDate || new Date().toISOString().split('T')[0],
      warrantyMonths: Number(data.warrantyMonths) || prev.warrantyMonths || 12,
      deliveryDeadline: data.deliveryDeadline || prev.deliveryDeadline || '',
      deliveryAddress: data.deliveryAddress || prev.deliveryAddress || '',
      paymentTerms: data.paymentTerms || prev.paymentTerms || '',
      orderRequirements: data.orderRequirements || data.summary || prev.orderRequirements || '',
    }))
    if (tenderItems.length > 0) {
      setNewProjectProducts(tenderItems)
    }
  }

  const processTenderFile = async (file: File, autoFillForm = false) => {
    const fileNameLower = file.name.toLowerCase()
    const isWord = fileNameLower.endsWith('.docx') || fileNameLower.endsWith('.doc') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'application/msword'
    const isPdf = file.type === 'application/pdf' || fileNameLower.endsWith('.pdf')

    if (!isWord && !isPdf) {
      toast({
        title: 'Formato no válido',
        description: 'Por favor suba un archivo en formato Word (.docx / .doc) [Prioridad] o PDF.',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsAnalyzingTender(true)
      let dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (ev) => resolve(ev.target?.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Normalizar el encabezado MIME si Windows devuelve application/octet-stream o vacío para .docx/.doc
      if (isWord && dataUri.includes('base64,')) {
        const base64Part = dataUri.split('base64,')[1]
        const mime = fileNameLower.endsWith('.doc')
          ? 'application/msword'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        dataUri = `data:${mime};base64,${base64Part}`
      } else if (isPdf && dataUri.includes('base64,')) {
        const base64Part = dataUri.split('base64,')[1]
        dataUri = `data:application/pdf;base64,${base64Part}`
      }

      setTenderFile({ name: file.name, dataUri, size: file.size })

      const resp = await aiTenderParser({
        pdfDataUri: dataUri,
        documentName: file.name,
      })

      if (!resp.success || !resp.data) {
        throw new Error(resp.error || 'No se pudieron extraer los datos de la Orden de Compra.')
      }

      setTenderParsedData(resp.data)

      // Si el modal de Nuevo Proyecto está abierto o se pidió autoFillForm, sincronizar el formulario de inmediato
      if (isProjectDialogOpen || autoFillForm) {
        await populateFormFromTenderData(resp.data)
      }

      toast({
        title: isWord ? 'Orden de Compra (Word) Analizada con Éxito' : 'Orden de Compra (PDF) Analizada con Éxito',
        description: `Se extrajeron ${resp.data.items?.length || 0} renglones y los requisitos de "${resp.data.projectName || file.name}".`,
      })
    } catch (err: any) {
      console.error('Error analizando licitación/OC:', err)
      toast({
        title: 'Error al Procesar el Archivo Word / PDF',
        description: err.message || 'No se pudo leer el archivo Word o PDF de la Orden de Compra.',
        variant: 'destructive',
      })
    } finally {
      setIsAnalyzingTender(false)
    }
  }

  const handleTenderPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await processTenderFile(file)
    if (e.target) e.target.value = ''
  }

  const handleTenderDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingTender(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    await processTenderFile(file)
  }

  const uploadTenderDocInBackground = (projectId: string, fileObj: { name: string; dataUri: string; size: number }) => {
    if (!storage || !projectId || !fileObj) return
    ;(async () => {
      try {
        const finalName = fileObj.name || `Orden_Compra_${Date.now()}.docx`
        const isWordFile = finalName.toLowerCase().endsWith('.docx') || finalName.toLowerCase().endsWith('.doc')
        const storageRef = ref(storage, `projects/${projectId}/documents/${Date.now()}_${finalName}`)
        await uploadString(storageRef, fileObj.dataUri, 'data_url')
        const downloadURL = await getDownloadURL(storageRef)
        addDocumentToProject(db, projectId, {
          name: finalName,
          type: isWordFile ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf',
          size: fileObj.size,
          data: downloadURL,
        })
      } catch (stErr) {
        console.warn('No se pudo subir documento adjunto en segundo plano:', stErr)
      }
    })()
  }

  const handleApplyTenderToProject = async (mode: 'direct' | 'form' = 'direct') => {
    if (!tenderParsedData) return

    const tenderItems: ProjectProduct[] = (tenderParsedData.items || []).map((it, idx) => {
      const qty = Number(it.quantity) || 1
      let up = Number(it.unitPrice) || 0
      if (up === 0 && Number(it.lineTotal) > 0) {
        up = Number((Number(it.lineTotal) / qty).toFixed(4))
      }
      return {
        code: cleanString(it.code) || `Renglón ${idx + 1}`,
        description: cleanString(it.description) || `Producto Renglón ${idx + 1}`,
        quantity: qty,
        unitPrice: up,
        unit: it.unit || 'Unidad',
      }
    })

    const itemsSum = Number(tenderItems.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0).toFixed(2))
    const calculatedBudget = Number(tenderParsedData.totalBudget) > 0 ? Number(tenderParsedData.totalBudget) : itemsSum

    if (mode === 'form') {
      setIsSavingTenderProject(true)
      try {
        await populateFormFromTenderData(tenderParsedData)
        setEditingProject(null)
        setIsTenderModalOpen(false)
        setIsProjectDialogOpen(true)
        toast({
          title: 'Requisitos cargados en el formulario',
          description: 'Revise los datos extraídos del Word/PDF y presione "Crear Proyecto".',
        })
      } finally {
        setIsSavingTenderProject(false)
      }
      return
    }

    setIsSavingTenderProject(true)
    try {
      if (tenderTargetProjectId === 'new' || !tenderTargetProjectId) {
        let matchedCustId = ''
        let matchedCustName = tenderParsedData.customerName?.trim() || 'Institución / Cliente OC'

        if (tenderParsedData.customerName) {
          const cust = entities.find(e => e.type === 'customer' && 
            (cleanStringLower(e.name).includes(cleanStringLower(tenderParsedData.customerName)) ||
             cleanStringLower(tenderParsedData.customerName).includes(cleanStringLower(e.name)))
          )
          if (cust) {
            matchedCustId = cust.id
            matchedCustName = cust.name
          } else {
            try {
              matchedCustId = await addEntity(db, {
                name: matchedCustName,
                type: 'customer',
                isGranContribuyente: true,
              })
            } catch (e) {
              console.warn('No se pudo crear entidad cliente automáticamente:', e)
            }
          }
        }

        if (!matchedCustId) {
          const fallbackCust = entities.find(e => e.type === 'customer')
          if (fallbackCust) {
            matchedCustId = fallbackCust.id
            matchedCustName = fallbackCust.name
          }
        }

        const projectTitle = (tenderParsedData.projectName || `Orden de Compra ${tenderParsedData.purchaseOrder || ''}`).trim() || 'Nuevo Proyecto OC'
        const poNumber = (tenderParsedData.purchaseOrder || `OC-${new Date().getFullYear()}`).trim()

        const createdProjectId = await addProject(db, {
          name: projectTitle,
          purchaseOrder: poNumber,
          targetSaleAmount: Number(calculatedBudget) || 0,
          customerId: matchedCustId || 'institucional',
          customerName: matchedCustName,
          expectedProducts: tenderItems,
          status: 'active',
          warrantyStartDate: new Date().toISOString().split('T')[0],
          warrantyMonths: Number(tenderParsedData.warrantyMonths) || 12,
          deliveryDeadline: tenderParsedData.deliveryDeadline || null,
          deliveryAddress: tenderParsedData.deliveryAddress || null,
          paymentTerms: tenderParsedData.paymentTerms || null,
          orderRequirements: tenderParsedData.orderRequirements || tenderParsedData.summary || null,
        })

        // Cerrar ambos modales de inmediato y seleccionar el proyecto recién creado (sin bloquear por Storage)
        if (createdProjectId) {
          setSelectedProjectId(createdProjectId)
          setProjectFilterTab('active')
          if (tenderFile) {
            uploadTenderDocInBackground(createdProjectId, tenderFile)
          }
        }

        setNewProject({ name: '', purchaseOrder: '', targetSaleAmount: 0, customerId: '', warrantyStartDate: '', warrantyMonths: 0, deliveryDeadline: '', deliveryAddress: '', paymentTerms: '', orderRequirements: '' })
        setNewProjectProducts([])
        setEditingProject(null)
        setIsTenderModalOpen(false)
        setIsProjectDialogOpen(false)

        toast({
          title: '✅ Proyecto Creado Exitosamente',
          description: `Se creó "${projectTitle}" (${poNumber}) con ${tenderItems.length} renglones y sus requisitos de la OC.`,
        })
      } else {
        const targetProj = projects.find(p => p.id === tenderTargetProjectId)
        if (!targetProj) return

        const updatedProducts = [...(targetProj.expectedProducts || [])]
        tenderItems.forEach(newItem => {
          const existingIdx = updatedProducts.findIndex(ep => cleanStringLower(ep.code) === cleanStringLower(newItem.code))
          if (existingIdx >= 0) {
            updatedProducts[existingIdx] = newItem
          } else {
            updatedProducts.push(newItem)
          }
        })

        updateProject(db, targetProj.id, {
          expectedProducts: updatedProducts,
          targetSaleAmount: Number(tenderParsedData.totalBudget) || targetProj.targetSaleAmount,
          deliveryDeadline: tenderParsedData.deliveryDeadline || targetProj.deliveryDeadline || null,
          deliveryAddress: tenderParsedData.deliveryAddress || targetProj.deliveryAddress || null,
          paymentTerms: tenderParsedData.paymentTerms || targetProj.paymentTerms || null,
          orderRequirements: tenderParsedData.orderRequirements || targetProj.orderRequirements || null,
        })

        if (tenderFile) {
          uploadTenderDocInBackground(targetProj.id, tenderFile)
        }

        setSelectedProjectId(targetProj.id)
        setIsTenderModalOpen(false)
        setIsProjectDialogOpen(false)
        toast({
          title: 'Orden de Compra vinculada al proyecto',
          description: `Se actualizaron ${updatedProducts.length} renglones y requisitos en ${targetProj.name}.`,
        })
      }
    } catch (err: any) {
      console.error('Error aplicando Orden de Compra al proyecto:', err)
      toast({
        title: 'Error al crear o actualizar proyecto',
        description: err.message || 'No se pudo guardar el proyecto en la base de datos.',
        variant: 'destructive',
      })
    } finally {
      setIsSavingTenderProject(false)
    }
  }

  const handleRunTenderAudit = async () => {
    if (!currentProject) return

    try {
      setIsAuditingTender(true)
      setIsAuditModalOpen(true)
      setAuditResult(null)

      const projectTxs = transactions.filter(t => t.projectId === currentProject.id && !t.isVoided)
      
      const summaryProgress = (currentProject.expectedProducts || []).map(ep => {
        const remissionItems = projectTxs.filter(t => t.type === 'remission').flatMap(t => t.items || []).filter(i => {
          const match = getMatchingExpectedProduct(i, currentProject.expectedProducts)
          return match && (match.code === ep.code || match.description === ep.description)
        })
        const deliveredQty = remissionItems.reduce((acc, curr) => acc + (curr?.quantity || 0), 0)

        const saleItems = projectTxs.filter(t => t.type === 'sale').flatMap(t => t.items || []).filter(i => {
          const match = getMatchingExpectedProduct(i, currentProject.expectedProducts)
          return match && (match.code === ep.code || match.description === ep.description)
        })
        const invoicedQty = saleItems.reduce((acc, curr) => acc + (curr?.quantity || 0), 0)

        const purchaseItems = projectTxs.filter(t => t.type === 'purchase').flatMap(t => t.items || []).filter(i => {
          const match = getMatchingExpectedProduct(i, currentProject.expectedProducts)
          return match && (match.code === ep.code || match.description === ep.description)
        })
        const purchasedQty = purchaseItems.reduce((acc, curr) => acc + (curr?.quantity || 0), 0)

        return {
          code: ep.code,
          description: ep.description,
          contractQty: ep.quantity,
          purchasedQty,
          deliveredQty,
          invoicedQty,
          pendingDeliverQty: Math.max(0, ep.quantity - deliveredQty),
        }
      })

      const resp = await aiTenderAuditor({
        projectName: currentProject.name,
        purchaseOrder: currentProject.purchaseOrder,
        customerName: currentProject.customerName,
        expectedProducts: currentProject.expectedProducts,
        summaryProgress,
      })

      if (!resp.success || !resp.data) {
        throw new Error(resp.error || 'No se pudo generar la auditoría.')
      }

      setAuditResult(resp.data)
    } catch (err: any) {
      console.error('Error al auditar licitación:', err)
      toast({
        title: 'Error en Auditoría IA',
        description: err.message || 'No se pudo procesar la auditoría.',
        variant: 'destructive',
      })
    } finally {
      setIsAuditingTender(false)
    }
  }

  // Interpretación semántica de facturas de proveedor contra ítems de la Orden de Compra con IA (Gemini)
  const runAiInvoiceInterpretation = async (rawItems: any[], proj: Project | undefined) => {
    if (!proj || !proj.expectedProducts || proj.expectedProducts.length === 0 || !rawItems || rawItems.length === 0) return

    try {
      setIsMatchingInvoiceAI(true)
      const resp = await aiInvoiceProjectMatcher({
        projectName: proj.name,
        purchaseOrder: proj.purchaseOrder,
        expectedProducts: proj.expectedProducts.map(ep => ({
          code: ep.code,
          description: ep.description,
          quantity: ep.quantity,
          unitPrice: ep.unitPrice,
          unit: ep.unit,
        })),
        invoiceItems: rawItems.map((it, idx) => ({
          index: idx,
          code: it.code || '',
          description: it.description || '',
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
          lineTotal: Number(it.lineTotal) || 0,
        })),
      })

      if (resp.success && resp.data) {
        const newMappings: Record<number, string> = {}
        const newReasons: Record<number, string> = {}

        resp.data.matches.forEach(m => {
          newMappings[m.invoiceItemIndex] = m.matchedProjectCode
          newReasons[m.invoiceItemIndex] = m.reason
        })

        // Rellenar cualquier índice faltante con el primer renglón de la OC
        rawItems.forEach((_, idx) => {
          if (!newMappings[idx]) {
            newMappings[idx] = proj.expectedProducts[0].code
          }
        })

        setItemMappings(newMappings)
        setAiMatchReasons(newReasons)
        setAiUnificationSummary(resp.data.unificationSummary || '')
      }
    } catch (e) {
      console.warn('No se pudo completar la interpretación IA de ítems:', e)
    } finally {
      setIsMatchingInvoiceAI(false)
    }
  }

  // Fusionar múltiples productos de la factura del proveedor en 1 sola línea del ítem de la Orden de Compra
  const handleMergeUnifiedInvoiceRows = () => {
    if (!mappedData || !mappedData.items || !currentProject) return

    const grouped = new Map<string, { items: any[]; indices: number[] }>()
    const unmappedRows: any[] = []

    mappedData.items.forEach((it, idx) => {
      const code = itemMappings[idx] || getMatchingExpectedProduct(it, currentProject.expectedProducts)?.code || '__UNMATCHED__'
      if (code === '__UNMATCHED__') {
        unmappedRows.push(it)
      } else {
        if (!grouped.has(code)) {
          grouped.set(code, { items: [], indices: [] })
        }
        grouped.get(code)!.items.push(it)
        grouped.get(code)!.indices.push(idx)
      }
    })

    const mergedItems: any[] = []
    const newMappings: Record<number, string> = {}
    const newReasons: Record<number, string> = {}

    grouped.forEach((group, ocCode) => {
      const ep = currentProject.expectedProducts.find(p => cleanStringLower(p.code) === cleanStringLower(ocCode))
      if (group.items.length === 1 && currentProject.expectedProducts.length > 1) {
        const single = group.items[0]
        const newIdx = mergedItems.length
        mergedItems.push(single)
        newMappings[newIdx] = ocCode
        newReasons[newIdx] = `Vinculado a ${ocCode}`
      } else {
        // Unificar todos los productos de este grupo en 1 sola línea del ítem de la OC
        const totalCost = Number(
          group.items.reduce((sum, it) => sum + (Number(it.lineTotal) || (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0)), 0).toFixed(2)
        )
        const targetQty = ep?.quantity || 1
        const subDescriptions = group.items
          .map(it => `${it.quantity || 1}x ${cleanString(it.description)}`)
          .join(' + ')
        const unifiedDesc = ep
          ? `${ep.description} [Unificado (${group.items.length} prods): ${subDescriptions}]`
          : `Lote Unificado (${group.items.length} prods): ${subDescriptions}`

        const newIdx = mergedItems.length
        mergedItems.push({
          code: ep?.code || ocCode,
          description: unifiedDesc,
          quantity: targetQty,
          unitPrice: Number((totalCost / targetQty).toFixed(4)),
          lineTotal: totalCost,
        })
        newMappings[newIdx] = ep?.code || ocCode
        newReasons[newIdx] = `Unificados ${group.items.length} productos de proveedor en ${ep?.code || ocCode} (Costo total: $${totalCost.toFixed(2)})`
      }
    })

    unmappedRows.forEach(ur => {
      const newIdx = mergedItems.length
      mergedItems.push(ur)
      newMappings[newIdx] = '__UNMATCHED__'
    })

    setMappedData({
      ...mappedData,
      items: mergedItems,
    })
    setItemMappings(newMappings)
    setAiMatchReasons(newReasons)
    toast({
      title: '🔗 Productos Unificados en el Ítem de la OC',
      description: `Los productos del proveedor se consolidaron bajo el renglón de la Orden de Compra conservando el costo exacto.`,
    })
  }

  // Unificar con IA todas las facturas de compra ya registradas en el proyecto actual contra la OC
  const handleBatchUnifyProjectInvoicesWithAI = async () => {
    if (!currentProject || !currentProject.expectedProducts || currentProject.expectedProducts.length === 0) return

    const purchaseTxs = transactions.filter(t => t.projectId === currentProject.id && !t.isVoided && t.type === 'purchase')
    if (purchaseTxs.length === 0) {
      toast({ title: 'Sin facturas de compra', description: 'Este proyecto aún no tiene facturas de compra registradas.' })
      return
    }

    setIsBatchUnifyingProject(true)
    try {
      // Construir lista plana de todos los ítems de las facturas de compra del proyecto
      const flatItems: { txId: string; itemIdx: number; code?: string; description: string; quantity: number; unitPrice: number; lineTotal: number }[] = []
      purchaseTxs.forEach(tx => {
        ;(tx.items || []).forEach((it, itemIdx) => {
          flatItems.push({
            txId: tx.id,
            itemIdx,
            code: it.code,
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            lineTotal: it.lineTotal,
          })
        })
      })

      if (flatItems.length === 0) return

      // Si la OC tiene 1 solo ítem, unificar todo directamente a ese ítem; si tiene varios, consultar a Gemini
      const matchMap = new Map<number, string>()

      if (currentProject.expectedProducts.length === 1) {
        const singleCode = currentProject.expectedProducts[0].code
        flatItems.forEach((_, idx) => matchMap.set(idx, singleCode))
      } else {
        const resp = await aiInvoiceProjectMatcher({
          projectName: currentProject.name,
          purchaseOrder: currentProject.purchaseOrder,
          expectedProducts: currentProject.expectedProducts,
          invoiceItems: flatItems.map((fi, idx) => ({
            index: idx,
            code: fi.code || '',
            description: fi.description,
            quantity: fi.quantity,
            unitPrice: fi.unitPrice,
            lineTotal: fi.lineTotal,
          })),
        })

        if (resp.success && resp.data) {
          resp.data.matches.forEach(m => {
            matchMap.set(m.invoiceItemIndex, m.matchedProjectCode)
          })
        }
      }

      // Actualizar cada factura de compra con su matchedProductCode unificado
      purchaseTxs.forEach(tx => {
        const updatedTxItems = (tx.items || []).map((it, itemIdx) => {
          const flatIdx = flatItems.findIndex(fi => fi.txId === tx.id && fi.itemIdx === itemIdx)
          const assignedCode = flatIdx >= 0 ? matchMap.get(flatIdx) : undefined
          return {
            ...it,
            matchedProductCode: assignedCode || it.matchedProductCode || currentProject.expectedProducts[0].code,
          }
        })
        updateTransaction(db, tx.id, { items: updatedTxItems })
      })

      toast({
        title: '✅ Facturas Unificadas con la Orden de Compra (IA)',
        description: `Se interpretaron y unificaron ${flatItems.length} productos de ${purchaseTxs.length} factura(s) de proveedor con los ítems de la OC.`,
      })
    } catch (err: any) {
      console.error('Error unificando facturas del proyecto:', err)
      toast({
        title: 'Error en Unificación IA',
        description: err.message || 'No se pudieron unificar las facturas.',
        variant: 'destructive',
      })
    } finally {
      setIsBatchUnifyingProject(false)
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
      setAiMatchReasons({})
      setAiUnificationSummary('')
      const response: AiActionResponse = await aiJsonKeyMapper({ invoiceJsonString: rawData })
      
      if (!response.success) {
        throw new Error(response.error || "Error desconocido en el servicio de IA.");
      }
      
      const result = response.data!;
      
      const docNum = result.invoiceNumber?.trim()
      const ctrlNum = (result as any).numeroControl?.trim()

      if (activeTab === 'purchases' && (docNum || ctrlNum)) {
        const existingTx = transactions.find(t => 
          !t.isVoided && t.type === 'purchase' && (
            (docNum && t.invoiceNumber && t.invoiceNumber.trim().toLowerCase() === docNum.toLowerCase()) ||
            (ctrlNum && t.numeroControl && t.numeroControl.trim().toLowerCase() === ctrlNum.toLowerCase())
          )
        );

        if (existingTx) {
          toast({
            title: "⚠️ Factura de Compra Ya Registrada",
            description: `La factura N° ${docNum || ctrlNum} ya fue ingresada previamente (Proveedor: ${existingTx.entityName || 'Registrado'}). Se ha impedido la carga duplicada.`,
            variant: "destructive"
          });
          setMappedData(null);
          setJsonInput('');
          return;
        }
      }

      setMappedData(result)

      // 1. Sugerir vinculación inicial inmediata y 2. Ejecutar interpretación semántica con IA (Gemini)
      if (currentProject && currentProject.expectedProducts && currentProject.expectedProducts.length > 0 && result.items) {
        const autoMatches = calculateProductMatches(result.items as any, currentProject.expectedProducts)
        setItemMappings(autoMatches)
        // Llamar a la IA en segundo plano para interpretar descripciones de proveedores y unificar con la OC
        runAiInvoiceInterpretation(result.items as any, currentProject)
      } else {
        setItemMappings({})
      }
      
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

    const docNum = mappedData.invoiceNumber?.trim()
    const ctrlNum = (mappedData as any).numeroControl?.trim()

    const existingTx = transactions.find(t => 
      !t.isVoided && t.type === 'purchase' && (
        (docNum && t.invoiceNumber && t.invoiceNumber.trim().toLowerCase() === docNum.toLowerCase()) ||
        (ctrlNum && t.numeroControl && t.numeroControl.trim().toLowerCase() === ctrlNum.toLowerCase())
      )
    );

    if (existingTx) {
      toast({
        title: "⚠️ Factura de Compra Ya Existe",
        description: `La factura de compra N° ${docNum || ctrlNum} ya se encuentra registrada en el sistema.`,
        variant: "destructive"
      });
      return;
    }

    const supplier = suppliers.find(s => s.id === selectedSupplierId)
    const rawItems = mappedData.items || []
    const validItems: TransactionItem[] = []
    const orphanItems: TransactionItem[] = []
    
    rawItems.forEach((item, idx) => {
      const explicitCode = itemMappings[idx];
      let ep: any = null;
      const isExplicitUnmatched = explicitCode === '__UNMATCHED__';

      if (explicitCode && !isExplicitUnmatched) {
        ep = currentProject.expectedProducts.find(p => cleanStringLower(p.code) === cleanStringLower(explicitCode));
      }

      if (!ep && !isExplicitUnmatched) {
        ep = getMatchingExpectedProduct(item, currentProject.expectedProducts);
      }
      const isExpected = !!ep && !isExplicitUnmatched;
      const unitPrice = item.unitPrice || (ep?.unitPrice || 0);
      const txItem = {
        description: item.description ? cleanString(item.description) : (ep?.description || 'Gasto proveedor'),
        quantity: item.quantity || 1,
        unitPrice: unitPrice,
        lineTotal: item.lineTotal || ((item.quantity || 1) * unitPrice),
        code: item.code ? cleanString(item.code) : (ep?.code || 'S/C'),
        matchedProductCode: ep ? ep.code : undefined
      };
      if (isExpected) validItems.push(txItem);
      else orphanItems.push(txItem);
    });

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
    if (!selectedProjectId || !manualPurchase.supplierId) return
    if (manualItems.length === 0) {
      toast({ title: "Sin productos", description: "Agregue al menos un producto a la compra.", variant: "destructive" })
      return
    }

    const docNum = manualPurchase.codigoGeneracion?.trim()
    const ctrlNum = manualPurchase.numeroControl?.trim()

    if (docNum || ctrlNum) {
      const existingTx = transactions.find(t => 
        !t.isVoided && t.type === 'purchase' && (
          (docNum && t.invoiceNumber && t.invoiceNumber.trim().toLowerCase() === docNum.toLowerCase()) ||
          (ctrlNum && t.numeroControl && t.numeroControl.trim().toLowerCase() === ctrlNum.toLowerCase())
        )
      );

      if (existingTx) {
        toast({
          title: "⚠️ Factura de Compra Ya Existe",
          description: `La factura de compra N° ${docNum || ctrlNum} ya fue registrada previamente en el sistema.`,
          variant: "destructive"
        });
        return;
      }
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
      items: (mappedData.items || []).map((i, idx) => ({ ...i, description: i.description || '', quantity: i.quantity || 1, unitPrice: i.unitPrice || 0, lineTotal: i.lineTotal || 0, matchedProductCode: itemMappings[idx] || (getMatchingExpectedProduct(i, currentProject.expectedProducts)?.code) })),
      subtotal,
      taxAmount: tax,
      retentionAmount: calculatedRetention,
      perceptionAmount: perception,
      totalAmount: adjustedTotal,
      costBasis: 0,
      gain: adjustedTotal
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

  const exportKardexExcel = async () => {
    if (!currentProject) return

    const projectTxs = transactions.filter(t => t.projectId === currentProject.id && !t.isVoided);

    // 1. Sheet 1: Summary of Margins & Profitability per Product
    const summaryRows = (currentProject.expectedProducts || []).map(ep => {
      const remissionItems = projectTxs.filter(t => t.type === 'remission').flatMap(t => t.items || []).filter(i => {
        if (!i) return false;
        const match = getMatchingExpectedProduct(i, currentProject.expectedProducts);
        return match && (match.code === ep.code || match.description === ep.description);
      });
      const deliveredQty = remissionItems.reduce((acc, curr) => acc + (curr?.quantity || 0), 0);

      const saleItems = projectTxs.filter(t => t.type === 'sale').flatMap(t => t.items || []).filter(i => {
        if (!i) return false;
        const match = getMatchingExpectedProduct(i, currentProject.expectedProducts);
        return match && (match.code === ep.code || match.description === ep.description);
      });
      const saleQty = saleItems.reduce((acc, curr) => acc + (curr?.quantity || 0), 0);
      const saleTotal = saleItems.reduce((acc, curr) => acc + (curr?.lineTotal || (curr?.quantity * curr?.unitPrice) || 0), 0);
      const saleAvgUnitPrice = saleQty > 0 ? saleTotal / saleQty : ep.unitPrice;

      const costItems = projectTxs.filter(t => t.type === 'purchase').flatMap(t => t.items || []).filter(i => {
        if (!i) return false;
        const match = getMatchingExpectedProduct(i, currentProject.expectedProducts);
        return match && (match.code === ep.code || match.description === ep.description);
      });
      const costQty = costItems.reduce((acc, curr) => acc + (curr?.quantity || 0), 0);
      const costTotal = costItems.reduce((acc, curr) => acc + (curr?.lineTotal || (curr?.quantity * curr?.unitPrice) || 0), 0);
      const costAvgUnitPrice = costQty > 0 ? costTotal / costQty : 0;

      const marginAmount = saleTotal - costTotal;
      const marginPercent = saleTotal > 0 ? (marginAmount / saleTotal) * 100 : 0;

      return {
        "Código": ep.code || 'S/C',
        "Producto": ep.description,
        "Cant. Cotizada (OC)": ep.quantity,
        "Cant. Entregada (Remisión)": deliveredQty,
        "Cant. Facturada (Venta)": saleQty,
        "Precio Venta Unit. Prom. ($)": Number(saleAvgUnitPrice.toFixed(2)),
        "Venta Total ($)": Number(saleTotal.toFixed(2)),
        "Cant. Comprada (Costo)": costQty,
        "Costo Unit. Prom. ($)": Number(costAvgUnitPrice.toFixed(2)),
        "Costo Total ($)": Number(costTotal.toFixed(2)),
        "Margen ($)": Number(marginAmount.toFixed(2)),
        "Margen (%)": `${marginPercent.toFixed(1)}%`
      };
    });

    // 2. Sheet 2: Detailed Movements with Purchase Cost vs Selling Price
    const detailedRows = projectTxs.flatMap(tx => 
      (tx.items || []).map(item => {
        const isSale = tx.type === 'sale';
        const isPurchase = tx.type === 'purchase';
        const isRemission = tx.type === 'remission';

        let unitCost = isPurchase ? item.unitPrice : 0;
        let unitSale = isSale ? item.unitPrice : (isRemission ? item.unitPrice : 0);

        if (isSale) {
          const matchingCostItems = projectTxs.filter(t => t.type === 'purchase').flatMap(t => t.items || []).filter(i => 
            (i.code && item.code && i.code.trim().toLowerCase() === item.code.trim().toLowerCase()) ||
            (i.description && item.description && i.description.trim().toLowerCase() === item.description.trim().toLowerCase())
          );
          const totalCostQty = matchingCostItems.reduce((acc, curr) => acc + curr.quantity, 0);
          const totalCostVal = matchingCostItems.reduce((acc, curr) => acc + (curr.lineTotal || curr.quantity * curr.unitPrice), 0);
          unitCost = totalCostQty > 0 ? totalCostVal / totalCostQty : 0;
        }

        const lineSaleTotal = isSale ? (item.lineTotal || item.quantity * item.unitPrice) : 0;
        const lineCostTotal = item.quantity * unitCost;
        const lineMargin = lineSaleTotal - lineCostTotal;

        return {
          "Tipo Movimiento": isPurchase ? 'Compra / Insumo' : isSale ? 'Venta (DTE)' : 'Remisión (Envío)',
          "Número Comprobante": tx.invoiceNumber || tx.numeroControl || 'S/N',
          "Fecha": new Date(tx.issueDate).toLocaleDateString(),
          "Entidad (Cliente/Prov)": tx.entityName,
          "Proyecto": currentProject.name,
          "Código": item.code || '',
          "Producto": item.description,
          "Cantidad": item.quantity,
          "Costo Unit. Compra ($)": Number(unitCost.toFixed(2)),
          "Precio Venta Unit. ($)": Number(unitSale.toFixed(2)),
          "Total Costo ($)": Number(lineCostTotal.toFixed(2)),
          "Total Venta ($)": Number(lineSaleTotal.toFixed(2)),
          "Margen Fila ($)": Number(lineMargin.toFixed(2))
        };
      })
    );

    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // Add Sheet 1 (Summary Margins)
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Rentabilidad")

    // Add Sheet 2 (Detailed Movements)
    const wsDetailed = XLSX.utils.json_to_sheet(detailedRows)
    XLSX.utils.book_append_sheet(wb, wsDetailed, "Movimientos Kardex")

    XLSX.writeFile(wb, `Kardex_Rentabilidad_${currentProject.name}_${new Date().toISOString().split('T')[0]}.xlsx`)
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
              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  className="gap-2 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white shadow-sm font-bold text-xs h-9 w-full sm:w-auto"
                  onClick={() => {
                    setTenderParsedData(null);
                    setTenderFile(null);
                    setTenderTargetProjectId('new');
                    setIsTenderModalOpen(true);
                  }}
                >
                  <Sparkles className="h-4 w-4" /> Cargar Orden de Compra (Word / PDF con IA)
                </Button>
                <Dialog open={isProjectDialogOpen} onOpenChange={(open) => {
                setIsProjectDialogOpen(open)
                if (!open) {
                  setEditingProject(null)
                  setNewProject({ name: '', purchaseOrder: '', targetSaleAmount: 0, customerId: '', warrantyStartDate: '', warrantyMonths: 0, deliveryDeadline: '', deliveryAddress: '', paymentTerms: '', orderRequirements: '' })
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
                      <TabsTrigger value="documents" className="text-xs">Docs (Word / PDF)</TabsTrigger>
                    </TabsList>

                    <TabsContent value="general" className="space-y-6">
                      <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
                            {isAnalyzingTender ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">
                              {isAnalyzingTender ? 'Analizando archivo Word / PDF con IA...' : 'Autocompletar Proyecto desde Orden de Compra (Word .docx o PDF)'}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Sube tu archivo Word o PDF para rellenar automáticamente el nombre, OC, cliente, requisitos y productos.
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isAnalyzingTender}
                          className="h-8 text-xs font-bold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                          onClick={(e) => {
                            e.preventDefault();
                            fileInputExcelRef.current?.click();
                          }}
                        >
                          {isAnalyzingTender ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          Subir Word / PDF
                        </Button>
                      </div>

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
                            <h4 className="font-bold text-xs uppercase text-muted-foreground">Garantía y Requisitos de la OC</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Inicio de Garantía</Label>
                                <Input type="date" value={newProject.warrantyStartDate || ''} onChange={e => setNewProject({...newProject, warrantyStartDate: e.target.value})} />
                              </div>
                              <div className="space-y-2">
                                <Label>Duración (Meses)</Label>
                                <Input type="number" placeholder="Ej. 12" value={newProject.warrantyMonths || ''} onChange={e => setNewProject({...newProject, warrantyMonths: Number(e.target.value)})} />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Plazo de Entrega OC</Label>
                                <Input className="h-8 text-xs" placeholder="Ej. 15 días hábiles" value={newProject.deliveryDeadline || ''} onChange={e => setNewProject({...newProject, deliveryDeadline: e.target.value})} />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Condición de Pago</Label>
                                <Input className="h-8 text-xs" placeholder="Ej. Crédito 30 días" value={newProject.paymentTerms || ''} onChange={e => setNewProject({...newProject, paymentTerms: e.target.value})} />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Lugar / Bodega de Entrega</Label>
                              <Input className="h-8 text-xs" placeholder="Dirección o bodega según Orden de Compra" value={newProject.deliveryAddress || ''} onChange={e => setNewProject({...newProject, deliveryAddress: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Requisitos Especiales de la Orden de Compra</Label>
                              <Input className="h-8 text-xs" placeholder="Contacto administrador, requisitos de facturación, etc." value={newProject.orderRequirements || ''} onChange={e => setNewProject({...newProject, orderRequirements: e.target.value})} />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex justify-between items-center gap-2">
                            <h4 className="font-bold text-xs uppercase text-muted-foreground flex-1">Productos de la OC</h4>
                            <div className="flex gap-1">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                type="button"
                                className="h-7 text-[10px] px-2 gap-1 text-blue-600 border-blue-600/30 hover:bg-blue-600/10 shrink-0 font-bold" 
                                onClick={(e) => {
                                  e.preventDefault();
                                  setTenderParsedData(null);
                                  setTenderFile(null);
                                  setTenderTargetProjectId(editingProject ? editingProject.id : 'new');
                                  setIsTenderModalOpen(true);
                                }}
                                title="Extraer y clasificar productos desde Word o PDF de Orden de Compra con IA"
                              >
                                <Sparkles className="h-3 w-3 text-blue-500" /> Word / PDF IA
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                type="button"
                                className="h-7 text-[10px] px-2 gap-1 text-green-600 border-green-600/20 hover:bg-green-600/10 shrink-0" 
                                onClick={handleDownloadTemplate}
                                title="Descargar Plantilla Excel"
                              >
                                <Download className="h-3 w-3" /> Plantilla
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                type="button"
                                className="h-7 text-[10px] px-2 gap-1 text-green-600 border-green-600/20 hover:bg-green-600/10 shrink-0" 
                                onClick={(e) => { e.preventDefault(); fileInputExcelRef.current?.click(); }}
                                title="Cargar desde Word (.docx/.doc), PDF o Excel (.xlsx)"
                              >
                                <Upload className="h-3 w-3" /> Cargar
                              </Button>
                              <input type="file" ref={fileInputExcelRef} className="hidden" accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,.pdf,application/pdf,.xlsx,.xls" onChange={handleImportExcel} />
                              <Button 
                                variant="outline" 
                                size="sm" 
                                type="button"
                                className="h-7 text-[10px] px-2 gap-1 text-primary border-primary/20 hover:bg-primary/5 shrink-0" 
                                onClick={(e) => { e.preventDefault(); setIsSuppliesDialogOpen(true); }}
                                title="Editar en Pantalla Completa"
                              >
                                <Maximize2 className="h-3 w-3" /> Ampliar
                              </Button>
                            </div>
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
                      {(() => {
                        const projectDups = getDuplicateTransactionsForProject(editingProject?.id);
                        const dupSet = new Set(projectDups.map(d => d.id));

                        return (
                          <>
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-sm font-bold text-foreground">Historial de Facturas (JSON)</h4>
                                <p className="text-[10px] text-muted-foreground">Listado de DTEs y facturas registradas en este proyecto</p>
                              </div>
                              {projectDups.length > 0 && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-8 text-xs gap-1.5 font-bold shadow-sm animate-pulse"
                                  onClick={() => handlePurgeDuplicates(editingProject?.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Borrar Repetidas ({projectDups.length})
                                </Button>
                              )}
                            </div>

                            <ScrollArea className="h-[300px] rounded-lg border bg-muted/30 p-4">
                              {transactions.filter(t => t.projectId === editingProject?.id).length > 0 ? (
                                <div className="space-y-3">
                                  {transactions.filter(t => t.projectId === editingProject?.id).map((tx) => {
                                    const isDup = dupSet.has(tx.id);
                                    return (
                                      <div 
                                        key={tx.id} 
                                        className={cn(
                                          "flex flex-col p-3 bg-card rounded-lg border shadow-sm group hover:border-primary cursor-pointer transition-all active:scale-[0.98]",
                                          isDup && "border-destructive/40 bg-destructive/5"
                                        )}
                                        onClick={() => setViewingInvoice(tx)}
                                        title="Haga clic para ver representación gráfica"
                                      >
                                        <div className="flex justify-between items-center mb-2">
                                          <div className="flex items-center gap-2">
                                            <ReceiptText className={cn("h-4 w-4", tx.type === 'purchase' ? "text-blue-500" : "text-green-500")} />
                                            <span className="text-xs font-bold font-mono">{tx.invoiceNumber}</span>
                                            <Badge variant="outline" className="text-[9px]">{tx.documentType === '03' ? 'CCF' : tx.documentType === '01' ? 'FAC' : 'DTE'}</Badge>
                                            {isDup && (
                                              <Badge variant="destructive" className="text-[8px] px-1.5 py-0 font-bold uppercase">
                                                Repetida
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <span className="text-xs font-bold text-foreground mr-1">${tx.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6 text-muted-foreground hover:text-primary z-10"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingTransaction(tx);
                                              }}
                                              title="Editar factura"
                                            >
                                              <Edit2 className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm(`¿Desea borrar definitivamente la factura N° ${tx.invoiceNumber}?`)) {
                                                  deleteTransaction(db, tx.id);
                                                  toast({ title: "Factura Borrada", description: `La factura N° ${tx.invoiceNumber} fue eliminada.` });
                                                }
                                              }}
                                              title="Borrar factura"
                                            >
                                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                            </Button>
                                          </div>
                                        </div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                          <span className="truncate max-w-[200px]">{tx.entityName}</span>
                                          <span>{new Date(tx.issueDate).toLocaleDateString()}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-2 py-10">
                                  <ReceiptText className="h-10 w-10" />
                                  <p className="text-xs italic">No hay facturas procesadas en este proyecto.</p>
                                </div>
                              )}
                            </ScrollArea>
                          </>
                        );
                      })()}
                    </TabsContent>

                    <TabsContent value="documents" className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-foreground">Archivos Adjuntos (Word / PDF)</h4>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="gap-2" 
                          disabled={!editingProject || isUploading}
                          onClick={() => docInputRef.current?.click()}
                        >
                          {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                          Subir Word / PDF
                        </Button>
                        <input type="file" ref={docInputRef} className="hidden" accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,.pdf,application/pdf,image/*" onChange={handleDocUpload} />
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
                          <TableHead className="w-[110px]">Código SV</TableHead>
                          <TableHead className="w-[260px]">Descripción</TableHead>
                          <TableHead className="w-[80px] text-right">Cantidad</TableHead>
                          <TableHead className="w-[95px] text-right">Precio Venta ($)</TableHead>
                          <TableHead className="w-[95px] text-right">Total ($)</TableHead>
                          <TableHead className="w-[140px]">Jerarquía / Tipo</TableHead>
                          <TableHead className="w-[50px] text-center">Acción</TableHead>
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
                              <TableCell className="p-2">
                                <select
                                  className="w-full h-8 text-[11px] rounded border bg-background px-1 text-foreground"
                                  value={p.parentCode || '__PARENT__'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleUpdateProductProperty(idx, 'parentCode', val === '__PARENT__' ? undefined : val);
                                  }}
                                >
                                  <option value="__PARENT__">🌟 Renglón Oficial</option>
                                  {newProjectProducts
                                    .filter((_, i) => i !== idx && !_.parentCode)
                                    .map(op => (
                                      <option key={op.code} value={op.code}>
                                        📦 Insumo de: [{op.code}]
                                      </option>
                                    ))}
                                </select>
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
                            <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic text-xs">
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
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block leading-none mb-1">Valor Oficial de la OC (Renglones Principales)</span>
                        <span className="text-lg font-black text-primary">
                          ${newProjectProducts.filter(p => !p.parentCode).reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0).toFixed(2)}
                        </span>
                        {newProjectProducts.filter(p => !!p.parentCode).length > 0 && (
                          <span className="block text-[9px] text-muted-foreground">
                            ({newProjectProducts.filter(p => !!p.parentCode).length} insumos de bodega vinculados)
                          </span>
                        )}
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

              {/* Diálogo de Configuración de Kits e Insumos de Bodega */}
              <Dialog open={isKitConfigOpen} onOpenChange={setIsKitConfigOpen}>
                <DialogContent className="sm:max-w-[850px] w-[95vw] max-h-[85vh] flex flex-col p-6 overflow-hidden">
                  <DialogHeader className="pb-3 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold font-headline text-foreground">
                      <Layers className="h-5 w-5 text-primary" />
                      Estructuración de Licitación: Kits y Componentes de Bodega
                    </DialogTitle>
                    <CardDescription className="text-xs">
                      Defina los Renglones Oficiales contratados con el cliente y asigne cuáles productos son insumos de bodega que componen cada renglón.
                    </CardDescription>
                  </DialogHeader>

                  <div className="flex-1 overflow-y-auto my-3 space-y-4 pr-1">
                    {/* Tarjeta de Asignación Automática Inteligente */}
                    {currentProject?.expectedProducts && currentProject.expectedProducts.length > 2 && (
                      <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                        <div className="text-xs space-y-0.5">
                          <span className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-blue-600" /> Auto-Agrupar Insumos en Renglón 1
                          </span>
                          <p className="text-muted-foreground text-[11px] max-w-xl">
                            Conservar los 2 primeros ítems como los únicos Renglones Oficiales y asignar automáticamente los {currentProject.expectedProducts.length - 2} productos restantes como insumos de bodega de [{currentProject.expectedProducts[0].code}].
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shrink-0 gap-1.5"
                          onClick={() => {
                            const firstParent = currentProject.expectedProducts[0]?.code;
                            const childCodes = currentProject.expectedProducts.slice(2).map(p => p.code);
                            handleLinkItemsToParent(childCodes, firstParent, true);
                          }}
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Vincular Ahora
                        </Button>
                      </div>
                    )}

                    {/* Tabla de asignación producto por producto */}
                    <div className="border rounded-xl overflow-hidden bg-card">
                      <Table className="text-xs">
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                          <TableRow>
                            <TableHead className="w-[110px]">Código</TableHead>
                            <TableHead>Descripción del Producto</TableHead>
                            <TableHead className="w-[80px] text-right">Cant.</TableHead>
                            <TableHead className="w-[230px]">Tipo / Pertenencia</TableHead>
                            <TableHead className="w-[70px] text-center">Acción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(currentProject?.expectedProducts || []).map((p, idx) => {
                            const isChild = !!p.parentCode;
                            return (
                              <TableRow key={idx} className={cn(isChild ? "bg-muted/10" : "font-semibold")}>
                                <TableCell className="font-mono text-primary font-bold">
                                  {p.code || `R-${idx + 1}`}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className={cn(isChild ? "text-muted-foreground text-[11px]" : "font-bold text-foreground")}>
                                      {isChild && "↳ Insumo: "} {p.description}
                                    </span>
                                    {p.unitPrice > 0 && (
                                      <span className="text-[10px] text-muted-foreground">
                                        Precio: ${p.unitPrice.toFixed(2)} c/u • Subtotal: ${(p.quantity * p.unitPrice).toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono">{p.quantity}</TableCell>
                                <TableCell>
                                  <select
                                    className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 py-1 shadow-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                    value={p.parentCode || '__PARENT__'}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const updated = (currentProject?.expectedProducts || []).map((it, i) => {
                                        if (i === idx) {
                                          if (val === '__PARENT__' || !val) {
                                            const { parentCode, quantityPerParent, ...rest } = it;
                                            return rest;
                                          } else {
                                            return { ...it, parentCode: val };
                                          }
                                        }
                                        if (it.code === val) {
                                          return { ...it, isKit: true };
                                        }
                                        return it;
                                      });
                                      if (currentProject) {
                                        updateProject(db, currentProject.id, { expectedProducts: updated });
                                      }
                                    }}
                                  >
                                    <option value="__PARENT__">🌟 Renglón Oficial (Licitación)</option>
                                    {(currentProject?.expectedProducts || [])
                                      .filter((_, i) => i !== idx && !_.parentCode)
                                      .map(op => (
                                        <option key={op.code} value={op.code}>
                                          📦 Insumo de: [{op.code}] {op.description.slice(0, 22)}...
                                        </option>
                                      ))}
                                  </select>
                                </TableCell>
                                <TableCell className="text-center">
                                  {isChild && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-[10px] text-destructive hover:bg-destructive/10 px-2"
                                      onClick={() => handleUnlinkItem(p.code)}
                                      title="Desvincular (volver a convertir en Renglón Oficial)"
                                    >
                                      Desvincular
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <DialogFooter className="border-t pt-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>Monto Oficial OC (Renglones Principales):</span>
                      <strong className="text-primary font-mono text-sm">
                        ${(currentProject?.expectedProducts || [])
                          .filter(p => !p.parentCode)
                          .reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0)
                          .toFixed(2)}
                      </strong>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] px-2 text-blue-600 hover:bg-blue-50"
                        onClick={() => {
                          const officialTotal = (currentProject?.expectedProducts || [])
                            .filter(p => !p.parentCode)
                            .reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0);
                          if (currentProject && officialTotal > 0) {
                            updateProject(db, currentProject.id, { targetSaleAmount: officialTotal });
                            toast({ title: "Monto OC Ajustado", description: `Presupuesto del proyecto actualizado a $${officialTotal.toFixed(2)}.` });
                          }
                        }}
                      >
                        Sincronizar Presupuesto
                      </Button>
                    </div>
                    <Button className="bg-primary text-white w-full sm:w-auto" onClick={() => setIsKitConfigOpen(false)}>
                      Listo / Cerrar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Filter and Search Bar for Projects */}
            {(() => {
              const activeCount = projects.filter(p => p.status !== 'completed').length;
              const completedCount = projects.filter(p => p.status === 'completed').length;
              const allCount = projects.length;

              const filteredProjects = projects.filter(p => {
                // Tab filter
                if (projectFilterTab === 'active' && p.status === 'completed') return false;
                if (projectFilterTab === 'completed' && p.status !== 'completed') return false;

                // Search query filter
                if (projectSearchQuery.trim()) {
                  const q = projectSearchQuery.trim().toLowerCase();
                  const nameMatch = p.name.toLowerCase().includes(q);
                  const poMatch = p.purchaseOrder.toLowerCase().includes(q);
                  const customerMatch = (p.customerName || '').toLowerCase().includes(q);
                  return nameMatch || poMatch || customerMatch;
                }

                return true;
              });

              return (
                <>
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-card/60 p-2.5 rounded-xl border mb-6">
                    <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg overflow-x-auto">
                      <Button
                        variant={projectFilterTab === 'active' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-8 text-xs font-bold gap-1.5 shrink-0"
                        onClick={() => setProjectFilterTab('active')}
                      >
                        <PlayCircle className="h-3.5 w-3.5 text-emerald-500" />
                        En Curso
                        <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 font-mono">
                          {activeCount}
                        </Badge>
                      </Button>

                      <Button
                        variant={projectFilterTab === 'completed' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-8 text-xs font-bold gap-1.5 shrink-0"
                        onClick={() => setProjectFilterTab('completed')}
                      >
                        <Archive className="h-3.5 w-3.5 text-blue-500" />
                        Archivados / Entregados
                        <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 font-mono">
                          {completedCount}
                        </Badge>
                      </Button>

                      <Button
                        variant={projectFilterTab === 'all' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-8 text-xs font-bold gap-1.5 shrink-0"
                        onClick={() => setProjectFilterTab('all')}
                      >
                        <Layers className="h-3.5 w-3.5 text-amber-500" />
                        Todos
                        <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 font-mono">
                          {allCount}
                        </Badge>
                      </Button>
                    </div>

                    <div className="relative w-full md:w-72">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nombre, OC o cliente..."
                        className="pl-8 h-9 text-xs"
                        value={projectSearchQuery}
                        onChange={(e) => setProjectSearchQuery(e.target.value)}
                      />
                      {projectSearchQuery && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-7 w-7 text-muted-foreground"
                          onClick={() => setProjectSearchQuery('')}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {filteredProjects.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredProjects.map(p => {
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
                              p.status === 'completed' && "opacity-80 border-slate-700/50 bg-slate-900/40"
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
                                  {p.status === 'completed' && <Badge className="text-[8px] bg-green-600 border-none text-white font-bold">ENTREGADO / ARCHIVADO</Badge>}
                                  {warranty && <Badge className={cn("text-[8px] border", warranty.color)}>{warranty.text}</Badge>}
                                </div>
                              </div>
                              <CardDescription className="text-xs truncate">{p.customerName}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-4 flex-1">
                              <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
                                  <span>Suministros</span>
                                  <span>Obj: ${p.targetSaleAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                                  <div className="flex flex-wrap items-center gap-1 pt-2">
                                    <Badge variant="secondary" className="text-[8px] gap-1 px-1.5 h-4">
                                      <FileText className="h-2 w-2" /> {p.documents.length} Docs
                                    </Badge>
                                    {p.deliveryDeadline && (
                                      <Badge variant="outline" className="text-[8px] px-1.5 h-4 border-blue-500/40 text-blue-500 truncate max-w-[140px]">
                                        Plazo: {p.deliveryDeadline}
                                      </Badge>
                                    )}
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
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={(e) => {
                                e.stopPropagation();
                                setSourceProjectToMerge(p);
                                setIsMergeDialogOpen(true);
                              }} title="Unir con otro proyecto">
                                <GitMerge className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className={cn("h-8 w-8", p.status === 'completed' ? "text-emerald-500 hover:bg-emerald-500/10" : "text-muted-foreground hover:bg-muted")} 
                                onClick={(e) => toggleProjectStatus(e, p)} 
                                title={p.status === 'completed' ? "Reabrir Proyecto (Mover a En Curso)" : "Archivar / Finalizar Proyecto"}
                              >
                                {p.status === 'completed' ? <PlayCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => handleDeleteProject(e, p.id)} title="Eliminar">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </CardFooter>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-16 border-2 border-dashed rounded-xl text-center space-y-3 bg-card/30">
                      <Archive className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-foreground">No se encontraron proyectos</h4>
                        <p className="text-xs text-muted-foreground">
                          {projectFilterTab === 'completed' 
                            ? "No hay proyectos archivados o finalizados en este momento." 
                            : projectSearchQuery 
                            ? `No coinciden proyectos con "${projectSearchQuery}".` 
                            : "No hay proyectos activos registrados."}
                        </p>
                      </div>
                      {projectSearchQuery && (
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => setProjectSearchQuery('')}>
                          Limpiar búsqueda
                        </Button>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
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
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          Validación y Unificación con OC
                        </CardTitle>
                        {mappedData && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isMatchingInvoiceAI}
                              onClick={() => runAiInvoiceInterpretation(mappedData.items || [], currentProject)}
                              className="h-7 text-[10px] gap-1 border-blue-500/40 text-blue-500 hover:bg-blue-500/10 font-bold"
                              title="La IA analiza las descripciones del proveedor y las unifica con los ítems de la Orden de Compra"
                            >
                              {isMatchingInvoiceAI ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                              Interpretar con IA
                            </Button>
                            {(mappedData.items?.length || 0) > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleMergeUnifiedInvoiceRows}
                                className="h-7 text-[10px] gap-1 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 font-bold"
                                title="Une varios productos de esta factura que pertenecen al mismo ítem de la OC en 1 sola línea consolidada"
                              >
                                <GitMerge className="h-3 w-3" />
                                Fusionar en 1 Ítem OC
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {mappedData ? (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Badge variant="secondary" className="bg-primary/10 text-primary uppercase text-[10px]">
                              DTE: {mappedData.documentType === '03' ? 'CRÉDITO FISCAL' : 'FACTURA'} • {mappedData.items?.length || 0} productos
                            </Badge>
                            {currentProject?.expectedProducts && currentProject.expectedProducts.length > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-muted-foreground">Unificar toda la factura en:</span>
                                <select
                                  value=""
                                  onChange={(e) => {
                                    const targetCode = e.target.value;
                                    if (!targetCode) return;
                                    const allMap: Record<number, string> = {};
                                    (mappedData.items || []).forEach((_, i) => {
                                      allMap[i] = targetCode;
                                    });
                                    setItemMappings(allMap);
                                    toast({
                                      title: 'Factura Unificada al Renglón',
                                      description: `Todos los productos de esta factura se unificaron en [${targetCode}].`,
                                    });
                                  }}
                                  className="h-7 text-[10px] rounded border bg-background px-2 font-bold text-primary"
                                >
                                  <option value="">-- Seleccionar Ítem OC --</option>
                                  {currentProject.expectedProducts.map((ep) => (
                                    <option key={ep.code} value={ep.code}>
                                      🔗 Unificar todo en [{ep.code}] {ep.description.slice(0, 28)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Banner de Interpretación Semántica de la IA */}
                          {(isMatchingInvoiceAI || aiUnificationSummary) && (
                            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-[11px] flex items-start gap-2">
                              {isMatchingInvoiceAI ? (
                                <>
                                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0 mt-0.5" />
                                  <span className="text-foreground font-medium">
                                    Gemini está interpretando las descripciones comerciales del proveedor para unificarlas con la Orden de Compra...
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Bot className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                                  <div className="space-y-0.5">
                                    <span className="font-bold text-blue-500 block text-[10px] uppercase">Interpretación y Unificación IA:</span>
                                    <p className="text-foreground leading-snug">{aiUnificationSummary}</p>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          <ScrollArea className="h-[280px] border rounded-lg">
                            <table className="w-full text-[10px]">
                              <thead className="bg-muted sticky top-0 z-10">
                                <tr>
                                  <th className="p-2 text-left">Producto en Factura Proveedor</th>
                                  <th className="p-2 text-left min-w-[220px]">Unificar en Ítem de la OC</th>
                                  <th className="p-2 text-right">Cant.</th>
                                  <th className="p-2 text-center">Estado</th>
                                  <th className="p-2 text-right">Acción</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {mappedData.items?.map((it, idx) => {
                                  const explicitCode = itemMappings[idx];
                                  const isExplicitUnmatched = explicitCode === '__UNMATCHED__';

                                  let projectProduct: any = null;
                                  if (explicitCode && !isExplicitUnmatched) {
                                    projectProduct = currentProject?.expectedProducts?.find(ep => cleanStringLower(ep.code) === cleanStringLower(explicitCode));
                                  }
                                  if (!projectProduct && !isExplicitUnmatched) {
                                    projectProduct = getMatchingExpectedProduct(it, currentProject?.expectedProducts || []);
                                  }
                                  const isExpected = !!projectProduct && !isExplicitUnmatched;
                                  const selectedValue = explicitCode !== undefined 
                                    ? explicitCode 
                                    : (projectProduct ? projectProduct.code : '__UNMATCHED__');
                                  const sameProductCount = (mappedData.items || []).filter((_, iIdx) => {
                                    const c = itemMappings[iIdx] !== undefined
                                      ? itemMappings[iIdx]
                                      : getMatchingExpectedProduct(mappedData.items![iIdx], currentProject?.expectedProducts || [])?.code;
                                    return c && projectProduct && cleanStringLower(c) === cleanStringLower(projectProduct.code);
                                  }).length;
                                  const isJoined = isExpected && (sameProductCount > 1 || (currentProject?.expectedProducts?.length === 1));
                                  const expectedQty = projectProduct ? projectProduct.quantity : 0;
                                  const hasExcess = isExpected && !isJoined && (it.quantity || 0) > expectedQty;
                                  const aiReason = aiMatchReasons[idx];
                                  
                                  return (
                                    <tr key={idx} className={cn(!isExpected && "bg-destructive/5", isJoined && "bg-blue-500/5", hasExcess && "bg-amber-500/5")}>
                                      <td className="p-2 font-medium">
                                        <div className="flex flex-col">
                                          <span className="font-semibold text-foreground">{it.description}</span>
                                          {it.code && <span className="text-[9px] text-muted-foreground font-mono">Cód Prov: {it.code}</span>}
                                          <span className="text-[9px] text-muted-foreground">
                                            ${(it.unitPrice || 0).toFixed(2)} c/u • Total: <strong className="text-foreground">${(it.lineTotal || (it.quantity || 0) * (it.unitPrice || 0)).toFixed(2)}</strong>
                                          </span>
                                        </div>
                                      </td>
                                      <td className="p-2">
                                        <div className="space-y-1">
                                          <select
                                            value={selectedValue}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setItemMappings(prev => ({ ...prev, [idx]: val }));
                                            }}
                                            className="w-full h-7 text-[10px] rounded border bg-background px-2 py-0.5 text-foreground focus:ring-1 focus:ring-primary font-medium"
                                          >
                                            <option value="__UNMATCHED__">📦 No pertenece al proyecto (Enviar a Excedente)</option>
                                            {currentProject?.expectedProducts?.map((ep) => (
                                              <option key={ep.code} value={ep.code}>
                                                {ep.parentCode 
                                                  ? `  ↳ [Insumo: ${ep.code}] ${ep.description.length > 30 ? ep.description.slice(0, 30) + '...' : ep.description} (Req: ${ep.quantity})`
                                                  : `🌟 [Oficial: ${ep.code}] ${ep.description.length > 30 ? ep.description.slice(0, 30) + '...' : ep.description} (OC: ${ep.quantity})`}
                                              </option>
                                            ))}
                                          </select>
                                          {isExpected && (
                                            <div className="flex flex-wrap items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">
                                              <Link2 className="h-3 w-3 shrink-0" />
                                              <span>{projectProduct?.code}</span>
                                              {isJoined && (
                                                <Badge variant="outline" className="text-[8px] py-0 px-1.5 border-blue-500/40 text-blue-500 bg-blue-500/10">
                                                  Unificado ({sameProductCount} prods → {projectProduct?.code})
                                                </Badge>
                                              )}
                                            </div>
                                          )}
                                          {aiReason && (
                                            <p className="text-[9px] text-muted-foreground leading-tight flex items-center gap-1">
                                              <Sparkles className="h-2.5 w-2.5 text-blue-500 shrink-0" />
                                              <span className="truncate max-w-[230px]" title={aiReason}>{aiReason}</span>
                                            </p>
                                          )}
                                        </div>
                                      </td>
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
                                          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-300 text-[9px]">
                                            EXCEDENTE
                                          </Badge>
                                        ) : isJoined ? (
                                          <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-bold" title={`Unificado dentro del ítem ${projectProduct?.code} de la Orden de Compra`}>
                                            UNIFICADO
                                          </Badge>
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

                          {/* Resumen de Grupos Unificados por Ítem de la OC */}
                          {(() => {
                            const groups = new Map<string, { ep: any; count: number; totalCost: number }>();
                            (mappedData.items || []).forEach((it, idx) => {
                              const explicitCode = itemMappings[idx];
                              if (explicitCode === '__UNMATCHED__') return;
                              const ep = explicitCode
                                ? currentProject?.expectedProducts?.find(p => cleanStringLower(p.code) === cleanStringLower(explicitCode))
                                : getMatchingExpectedProduct(it, currentProject?.expectedProducts || []);
                              if (!ep) return;
                              const curr = groups.get(ep.code) || { ep, count: 0, totalCost: 0 };
                              curr.count += 1;
                              curr.totalCost += Number(it.lineTotal) || (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
                              groups.set(ep.code, curr);
                            });
                            const groupList = Array.from(groups.values());
                            if (groupList.length === 0) return null;

                            return (
                              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-1.5 text-[10px]">
                                <div className="flex items-center justify-between font-bold text-emerald-500">
                                  <span className="flex items-center gap-1">
                                    <Link2 className="h-3.5 w-3.5" />
                                    Resumen de Unificación hacia la Orden de Compra:
                                  </span>
                                  <span>{groupList.length} ítem(s) de la OC</span>
                                </div>
                                {groupList.map(g => (
                                  <div key={g.ep.code} className="flex items-center justify-between text-foreground bg-background/60 px-2 py-1 rounded border">
                                    <span className="truncate max-w-[260px]">
                                      <strong>[{g.ep.code}]</strong> {g.ep.description}
                                    </span>
                                    <span className="font-mono font-bold text-emerald-500 shrink-0">
                                      {g.count} prod(s) unificados • Costo: ${g.totalCost.toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}

                          <div className="bg-muted p-3 rounded-lg border text-xs">
                            <div className="flex justify-between"><span>IVA (13%):</span><span className="font-bold">${mappedData.taxAmount?.toFixed(2)}</span></div>
                            <div className="flex justify-between text-base font-black border-t mt-2 pt-2"><span>TOTAL:</span><span>${mappedData.totalAmount?.toFixed(2)}</span></div>
                          </div>
                          <Button className="w-full bg-primary font-bold" onClick={handleSavePurchase}>Confirmar Ingreso Unificado al Proyecto</Button>
                        </div>
                      ) : <div className="py-20 text-center text-muted-foreground italic text-xs">Cargue el JSON para interpretar y unificar suministros con la OC.</div>}
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
                        {/* Manual Purchase Logic Replaced with Cascade */}
                          <Select value={manualPurchase.documentType} onValueChange={v => setManualPurchase({...manualPurchase, documentType: v})}>
                            <SelectTrigger><SelectValue placeholder="Tipo Documento" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="03">Crédito Fiscal (CCF)</SelectItem>
                              <SelectItem value="01">Factura Consumidor (FAC)</SelectItem>
                            </SelectContent>
                          </Select>
                       </div>
                       
                       <div className="border p-4 rounded-lg bg-muted/20 space-y-3">
                           {currentProject?.expectedProducts && currentProject.expectedProducts.length > 0 && (
                             <div className="space-y-1">
                               <Label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                                 <Sliders className="h-3 w-3 text-primary" /> Seleccionar Producto de la OC (Cascada):
                               </Label>
                               <Select
                                 value=""
                                 onValueChange={(val) => {
                                   const ep = currentProject.expectedProducts.find(p => p.code === val || p.description === val);
                                   if (ep) {
                                     setTempManualItem({
                                       ...tempManualItem,
                                       code: ep.code || '',
                                       description: ep.description || '',
                                       unitPrice: ep.unitPrice || 0,
                                       lineTotal: (tempManualItem.quantity || 1) * (ep.unitPrice || 0)
                                     });
                                   }
                                 }}
                               >
                                 <SelectTrigger className="h-9 text-xs bg-background">
                                   <SelectValue placeholder="-- Elegir de la Orden de Compra --" />
                                 </SelectTrigger>
                                 <SelectContent className="max-h-[220px]">
                                   {currentProject.expectedProducts.map((ep, idx) => (
                                     <SelectItem key={idx} value={ep.code || ep.description} className="text-xs">
                                       <span className="font-bold font-mono text-primary">{ep.code || 'S/C'}</span> - {ep.description} (${ep.unitPrice?.toFixed(2) || '0.00'})
                                     </SelectItem>
                                   ))}
                                 </SelectContent>
                               </Select>
                             </div>
                           )}

                           <div className="grid grid-cols-2 gap-2">
                              <Input placeholder="Código del producto" className="col-span-2 text-xs font-mono" value={tempManualItem.code} onChange={e => {
                                const code = e.target.value;
                                const ep = currentProject?.expectedProducts.find(p => p.code?.trim().toLowerCase() === code.trim().toLowerCase());
                                if (ep) {
                                  setTempManualItem({...tempManualItem, code, description: ep.description, unitPrice: ep.unitPrice, lineTotal: (tempManualItem.quantity || 1) * ep.unitPrice});
                                } else {
                                  setTempManualItem({...tempManualItem, code});
                                }
                              }} />
                              <Input placeholder="Descripción del producto" className="col-span-2 text-xs" value={tempManualItem.description} onChange={e => setTempManualItem({...tempManualItem, description: e.target.value})} />
                              <Input type="number" placeholder="Cant." className="text-xs" value={tempManualItem.quantity} onChange={e => {
                                const qty = Number(e.target.value);
                                setTempManualItem({...tempManualItem, quantity: qty, lineTotal: qty * tempManualItem.unitPrice});
                              }} />
                              <Input type="number" placeholder="Precio ($)" className="text-xs" value={tempManualItem.unitPrice} onChange={e => {
                                const price = Number(e.target.value);
                                setTempManualItem({...tempManualItem, unitPrice: price, lineTotal: tempManualItem.quantity * price});
                              }} />
                           </div>
                           <Button variant="outline" size="sm" className="w-full text-xs font-bold" onClick={handleAddManualItem}>Añadir Item</Button>
                        </div>
                       <Button className="w-full bg-primary" onClick={handleSaveManualPurchase} disabled={manualItems.length === 0}>Guardar Compra</Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-lg">Resumen Manual</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                       <ScrollArea className="h-[180px] border rounded-lg p-2 bg-card">
                          {manualItems.map((it, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 border-b text-[10px] group">
                               <div className="flex-1">
                                 <span>{it.code ? `[${it.code}] ` : ''}{it.description} (x{it.quantity})</span>
                               </div>
                               <div className="flex items-center gap-2">
                                 <span className="font-bold text-foreground">${it.lineTotal.toFixed(2)}</span>
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   className="h-5 w-5 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" 
                                   onClick={() => setManualItems(manualItems.filter((_, i) => i !== idx))}
                                 >
                                   <Trash2 className="h-3 w-3" />
                                 </Button>
                               </div>
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
                            <div key={idx} className="flex justify-between items-center p-2 border-b text-[10px] group">
                               <div className="flex-1">
                                 <span>{it.code ? `[${it.code}] ` : ''}{it.description} (x{it.quantity})</span>
                               </div>
                               <div className="flex items-center gap-2">
                                 <span className="font-bold">${it.lineTotal.toFixed(2)}</span>
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   className="h-5 w-5 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" 
                                   onClick={() => setManualItems(manualItems.filter((_, i) => i !== idx))}
                                 >
                                   <Trash2 className="h-3 w-3" />
                                 </Button>
                               </div>
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
               {/* Encabezado y Acción de Auditoría de Licitación */}
               <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-card rounded-xl border shadow-sm">
                 <div className="space-y-1">
                   <div className="flex items-center gap-2">
                     <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                       <Briefcase className="h-5 w-5 text-primary" />
                       {currentProject.name}
                     </h3>
                     <Badge variant="outline" className="font-mono text-xs font-bold">
                       {currentProject.purchaseOrder}
                     </Badge>
                   </div>
                   <p className="text-xs text-muted-foreground">
                     Cliente / Institución: <strong className="text-foreground">{currentProject.customerName}</strong> • {currentProject.expectedProducts?.length || 0} renglones contratados
                   </p>
                 </div>
                 <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                   <Button
                     variant="outline"
                     size="sm"
                     className="gap-2 border-blue-600/40 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 font-bold text-xs w-full sm:w-auto h-9"
                     onClick={handleBatchUnifyProjectInvoicesWithAI}
                     disabled={isBatchUnifyingProject}
                     title="Analiza todas las facturas de compra del proyecto y unifica sus productos con los ítems de la Orden de Compra"
                   >
                     {isBatchUnifyingProject ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-blue-500" />}
                     Unificar Facturas con OC (IA)
                   </Button>
                   <Button
                     variant="outline"
                     size="sm"
                     className="gap-2 border-emerald-600/40 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 font-bold text-xs w-full sm:w-auto h-9"
                     onClick={handleRunTenderAudit}
                     disabled={isAuditingTender}
                   >
                     {isAuditingTender ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5 text-emerald-500" />}
                     Auditoría IA de Licitación
                   </Button>
                 </div>
               </div>

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

                {(() => {
                  const projectTxs = transactions.filter(t => t.projectId === currentProject.id && !t.isVoided);
                  const allExpectedProducts = currentProject.expectedProducts || [];
                  const officialProducts = allExpectedProducts.filter(ep => !ep.parentCode);
                  const allChildComponents = allExpectedProducts.filter(ep => !!ep.parentCode);
                  
                  const productRows = officialProducts.map(ep => {
                    const remissionItems = projectTxs.filter(t => t.type === 'remission').flatMap(t => t.items || []).filter(i => {
                      if (!i) return false;
                      const match = getMatchingExpectedProduct(i, allExpectedProducts);
                      return match && (match.code === ep.code || match.description === ep.description);
                    });
                    const deliveredQty = remissionItems.reduce((acc, curr) => acc + (curr?.quantity || 0), 0);

                    const saleItems = projectTxs.filter(t => t.type === 'sale').flatMap(t => t.items || []).filter(i => {
                      if (!i) return false;
                      const match = getMatchingExpectedProduct(i, allExpectedProducts);
                      return match && (match.code === ep.code || match.description === ep.description);
                    });
                    const saleQty = saleItems.reduce((acc, curr) => acc + (curr?.quantity || 0), 0);
                    const saleTotal = saleItems.reduce((acc, curr) => acc + (curr?.lineTotal || (curr?.quantity * curr?.unitPrice) || 0), 0);
                    const saleAvgUnitPrice = saleQty > 0 ? saleTotal / saleQty : ep.unitPrice;

                    // Compras directas al renglón
                    const directCostItems = projectTxs.filter(t => t.type === 'purchase').flatMap(t => t.items || []).filter(i => {
                      if (!i) return false;
                      const match = getMatchingExpectedProduct(i, allExpectedProducts);
                      return match && (match.code === ep.code || match.description === ep.description);
                    });
                    const directCostQty = directCostItems.reduce((acc, curr) => acc + (curr?.quantity || 0), 0);
                    const directCostTotal = directCostItems.reduce((acc, curr) => acc + (curr?.lineTotal || (curr?.quantity * curr?.unitPrice) || 0), 0);

                    // Insumos o componentes de bodega asociados a este Renglón Oficial
                    const myComponents = allChildComponents.filter(c => c.parentCode === ep.code);
                    const isKit = !!ep.isKit || myComponents.length > 0;

                    const componentsDetail = myComponents.map(comp => {
                      const compCostItems = projectTxs.filter(t => t.type === 'purchase').flatMap(t => t.items || []).filter(i => {
                        if (!i) return false;
                        const match = getMatchingExpectedProduct(i, allExpectedProducts);
                        return match && (match.code === comp.code || match.description === comp.description);
                      });
                      const compCostQty = compCostItems.reduce((acc, curr) => acc + (curr?.quantity || 0), 0);
                      const compCostTotal = compCostItems.reduce((acc, curr) => acc + (curr?.lineTotal || (curr?.quantity * curr?.unitPrice) || 0), 0);
                      const compAvgCost = compCostQty > 0 ? compCostTotal / compCostQty : (comp.unitPrice || 0);
                      const qtyPerParent = comp.quantityPerParent || 1;
                      const requiredTotal = comp.quantity || (ep.quantity * qtyPerParent);
                      const kitsStock = Math.floor(compCostQty / qtyPerParent);
                      const missingQty = Math.max(0, requiredTotal - compCostQty);
                      const compUnifiedDescs = Array.from(new Set(compCostItems.map(ci => ci.description).filter(Boolean)));

                      return {
                        comp,
                        costQty: compCostQty,
                        costTotal: compCostTotal,
                        avgCost: compAvgCost,
                        qtyPerParent,
                        requiredTotal,
                        kitsStock,
                        missingQty,
                        costItemsCount: compCostItems.length,
                        unifiedDescriptions: compUnifiedDescs
                      };
                    });

                    const componentsCostTotal = componentsDetail.reduce((acc, cd) => acc + cd.costTotal, 0);
                    const totalCost = directCostTotal + componentsCostTotal;

                    // Kits completos disponibles según insumos comprados
                    let assembledKits = directCostQty;
                    if (componentsDetail.length > 0) {
                      const minKits = Math.min(...componentsDetail.map(cd => cd.kitsStock));
                      assembledKits = Math.max(directCostQty, minKits);
                    }

                    const costQty = assembledKits;
                    const costTotal = totalCost;
                    const costAvgUnitPrice = costQty > 0 ? costTotal / costQty : 0;
                    const allCostItemsCount = directCostItems.length + componentsDetail.reduce((acc, cd) => acc + cd.costItemsCount, 0);
                    const unifiedDescriptions = Array.from(new Set([
                      ...directCostItems.map(ci => ci.description).filter(Boolean),
                      ...componentsDetail.flatMap(cd => cd.unifiedDescriptions)
                    ]));

                    const pendingDeliver = ep.quantity - deliveredQty;
                    const pendingInvoice = deliveredQty - saleQty;
                    const baseSaleValue = saleTotal > 0 ? saleTotal : (ep.quantity * ep.unitPrice);
                    const marginAmount = baseSaleValue - costTotal;
                    const marginPercent = baseSaleValue > 0 ? (marginAmount / baseSaleValue) * 100 : 0;

                    return {
                      ep,
                      isKit,
                      childComponents: componentsDetail,
                      deliveredQty,
                      saleQty,
                      saleTotal,
                      saleAvgUnitPrice,
                      costQty,
                      costTotal,
                      directCostTotal,
                      componentsCostTotal,
                      costAvgUnitPrice,
                      costItemsCount: allCostItemsCount,
                      unifiedDescriptions,
                      pendingDeliver,
                      pendingInvoice,
                      marginAmount,
                      marginPercent,
                      assembledKits
                    };
                  });

                  return (
                    <div className="space-y-6">
                      {/* Banner Sugerencia de Estructuración Rápida si hay insumos sin agrupar */}
                      {allChildComponents.length === 0 && currentProject.expectedProducts?.length > 2 && (
                        <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-emerald-500/10 border border-blue-500/30 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-sm">
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-blue-600/15 rounded-lg text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                              <Layers className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                                Estructuración de Licitación: Renglones Principales vs. Insumos de Bodega
                                <Badge variant="outline" className="text-[9px] py-0 border-blue-500/40 text-blue-600 bg-blue-500/10">Sugerencia Inteligente</Badge>
                              </h4>
                              <p className="text-[11px] text-muted-foreground mt-0.5 max-w-2xl">
                                Hay {currentProject.expectedProducts.length} renglones en la tabla. Si los 2 primeros son los ítems únicos de la orden ({currentProject.expectedProducts[0]?.description?.slice(0, 30)}... y {currentProject.expectedProducts[1]?.description?.slice(0, 30)}...) y los demás son sus insumos de bodega, puedes unificarlos con un solo clic.
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto">
                            <Button 
                              size="sm" 
                              className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1.5 w-full sm:w-auto"
                              onClick={() => {
                                const firstParent = currentProject.expectedProducts[0]?.code;
                                const childCodes = currentProject.expectedProducts.slice(2).map(p => p.code);
                                handleLinkItemsToParent(childCodes, firstParent, true);
                              }}
                            >
                              <Sparkles className="h-3.5 w-3.5" /> Auto-vincular al Renglón 1
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-xs font-semibold gap-1.5 w-full sm:w-auto"
                              onClick={() => setIsKitConfigOpen(true)}
                            >
                              <Sliders className="h-3.5 w-3.5" /> Configurar Personalizado
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Tablero de Seguimiento de Suministros de Licitación */}
                      <Card className="border-t-4 border-t-emerald-600 shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                              <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-emerald-600" />
                                Seguimiento y Cumplimiento de Licitación
                              </CardTitle>
                              <CardDescription className="text-xs">
                                Control renglón por renglón: contratado vs. compras vinculadas, remisiones entregadas y saldo pendiente.
                              </CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                                onClick={() => setIsKitConfigOpen(true)}
                              >
                                <Layers className="h-3.5 w-3.5" />
                                Estructurar Kits e Insumos
                              </Button>
                              <Badge className="bg-emerald-600 text-white font-mono text-xs">
                                {productRows.filter(r => r.deliveredQty >= r.ep.quantity).length} de {productRows.length} Renglones Cumplidos
                                {allChildComponents.length > 0 && ` (${allChildComponents.length} Insumos de Bodega)`}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto rounded-lg border">
                            <Table className="text-xs">
                              <TableHeader className="bg-muted/60">
                                <TableRow>
                                  <TableHead className="font-bold">Renglón / Descripción Oficial</TableHead>
                                  <TableHead className="text-center font-bold">Unidad</TableHead>
                                  <TableHead className="text-right font-bold bg-muted/40">Contratado</TableHead>
                                  <TableHead className="text-right font-bold text-rose-700 bg-rose-50/50">Comprado</TableHead>
                                  <TableHead className="text-right font-bold text-blue-700 bg-blue-50/50">Entregado</TableHead>
                                  <TableHead className="text-right font-bold text-green-700 bg-green-50/50">Facturado</TableHead>
                                  <TableHead className="text-right font-bold text-amber-700 bg-amber-50/50">Saldo Pendiente</TableHead>
                                  <TableHead className="text-center font-bold">Avance</TableHead>
                                  <TableHead className="text-center font-bold">Estado</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {productRows.map((row, idx) => {
                                  const reqQty = row.ep.quantity || 1;
                                  const pctDelivered = Math.min(Math.round((row.deliveredQty / reqQty) * 100), 100);
                                  const isComplete = row.deliveredQty >= reqQty;
                                  const isExpanded = !!expandedKitCodes[row.ep.code];

                                  let isStocked = false;
                                  let statusBadge = null;

                                  if (isComplete) {
                                    statusBadge = (
                                      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold">
                                        ✓ CUMPLIDO
                                      </Badge>
                                    );
                                  } else if (row.isKit && row.childComponents.length > 0) {
                                    if (row.assembledKits >= reqQty) {
                                      isStocked = true;
                                      statusBadge = (
                                        <Badge className="bg-emerald-600 text-white text-[9px] font-bold" title="Todos los insumos de bodega completos para los kits contratados">
                                          EN BODEGA (LISTO)
                                        </Badge>
                                      );
                                    } else if (row.assembledKits > 0) {
                                      statusBadge = (
                                        <Badge className="bg-blue-600 text-white text-[9px] font-bold" title={`${row.assembledKits} de ${reqQty} kits completos armados con insumos de bodega`}>
                                          EN BODEGA ({row.assembledKits}/{reqQty})
                                        </Badge>
                                      );
                                    } else if (row.costTotal > 0) {
                                      statusBadge = (
                                        <Badge className="bg-amber-500 text-white text-[9px] font-bold" title="Insumos comprados en bodega pero pendientes de completar kit">
                                          INSUMOS PARCIALES
                                        </Badge>
                                      );
                                    } else {
                                      statusBadge = (
                                        <Badge variant="destructive" className="text-[9px] font-bold">
                                          SIN COMPRAS
                                        </Badge>
                                      );
                                    }
                                  } else {
                                    isStocked = row.costQty >= reqQty;
                                    if (isStocked) {
                                      statusBadge = (
                                        <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-bold" title="Comprado en bodega, pendiente de remisión">
                                          EN BODEGA
                                        </Badge>
                                      );
                                    } else if (row.costQty === 0) {
                                      statusBadge = (
                                        <Badge variant="destructive" className="text-[9px] font-bold">
                                          SIN COMPRAS
                                        </Badge>
                                      );
                                    } else {
                                      statusBadge = (
                                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-bold">
                                          EN PROCESO
                                        </Badge>
                                      );
                                    }
                                  }

                                  return (
                                    <React.Fragment key={idx}>
                                      <TableRow className={cn(isComplete && "bg-emerald-50/30 dark:bg-emerald-950/10")}>
                                        <TableCell className="font-medium">
                                          <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <Badge variant="outline" className="font-mono text-[9px] font-bold text-primary">
                                                {row.ep.code || `R-${idx + 1}`}
                                              </Badge>
                                              <span className="font-semibold">{row.ep.description}</span>
                                              {row.isKit && (
                                                <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-indigo-500/40 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 gap-1 font-semibold">
                                                  <Layers className="h-2.5 w-2.5" />
                                                  Kit ({row.childComponents.length} insumos)
                                                </Badge>
                                              )}
                                            </div>
                                            {row.ep.unitPrice > 0 && (
                                              <span className="text-[10px] text-muted-foreground mt-0.5">
                                                Presupuesto Venta: ${row.ep.unitPrice.toFixed(2)} c/u • Subtotal: ${(reqQty * row.ep.unitPrice).toFixed(2)}
                                              </span>
                                            )}
                                            {row.isKit && row.childComponents.length > 0 && (
                                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 text-[10px] px-2 py-0 gap-1 text-primary hover:bg-primary/10 font-bold"
                                                  onClick={() => toggleExpandKit(row.ep.code)}
                                                >
                                                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                  {isExpanded ? 'Ocultar Insumos de Bodega' : `Ver ${row.childComponents.length} Insumos de Bodega`}
                                                </Button>
                                                {row.costTotal > 0 && (
                                                  <span className="text-[10px] text-muted-foreground font-mono">
                                                    Inversión en insumos: <strong className="text-foreground">${row.costTotal.toFixed(2)}</strong>
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                            {!row.isKit && row.costItemsCount > 0 && (
                                              <div
                                                className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                                                onClick={() => setViewingProductDetail({
                                                  code: row.ep.code,
                                                  description: row.ep.description,
                                                  expectedQty: row.ep.quantity,
                                                  expectedPrice: row.ep.unitPrice
                                                })}
                                                title="Haga clic para ver el desglose de productos de facturas de proveedor unificados en este ítem"
                                              >
                                                <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10 gap-1">
                                                  <Link2 className="h-2.5 w-2.5" />
                                                  {row.costItemsCount} prod(s) proveedor unificados (${row.costTotal.toFixed(2)})
                                                </Badge>
                                                <span className="text-[9px] text-muted-foreground truncate max-w-[280px]">
                                                  {row.unifiedDescriptions.slice(0, 3).join(' • ')}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-center text-muted-foreground text-[10px]">
                                          {(row.ep as any).unit || (row.isKit ? 'Kit' : 'Unidad')}
                                        </TableCell>
                                        <TableCell className="text-right font-bold bg-muted/20">
                                          {reqQty}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold text-rose-700 bg-rose-50/20">
                                          {row.isKit && row.childComponents.length > 0 ? (
                                            <div>
                                              <span>{row.assembledKits}</span>
                                              <span className="block text-[8px] text-muted-foreground font-normal">kits listos</span>
                                            </div>
                                          ) : (
                                            row.costQty
                                          )}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold text-blue-700 bg-blue-50/20">
                                          {row.deliveredQty}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold text-green-700 bg-green-50/20">
                                          {row.saleQty}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold text-amber-700 bg-amber-50/20">
                                          {Math.max(0, reqQty - row.deliveredQty)}
                                        </TableCell>
                                        <TableCell className="text-center w-[120px]">
                                          <div className="space-y-1">
                                            <Progress value={pctDelivered} className="h-2" />
                                            <span className="text-[9px] font-bold text-muted-foreground">{pctDelivered}%</span>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {statusBadge}
                                        </TableCell>
                                      </TableRow>

                                      {/* Desglose de Insumos Anidado */}
                                      {row.isKit && isExpanded && (
                                        <TableRow className="bg-muted/15 border-y-2 border-indigo-500/20">
                                          <TableCell colSpan={9} className="p-3">
                                            <div className="bg-card rounded-xl border p-3.5 space-y-2.5 shadow-sm">
                                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b">
                                                <div className="flex items-center gap-2">
                                                  <Badge className="bg-indigo-600 text-white text-[10px] gap-1">
                                                    <Layers className="h-3 w-3" /> Insumos y Componentes de Bodega
                                                  </Badge>
                                                  <span className="text-xs font-bold text-foreground">
                                                    Desglose de compras para: {row.ep.description}
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs">
                                                  <span className="text-muted-foreground font-mono text-[11px]">
                                                    Inversión en insumos: <strong className="text-foreground">${row.childComponents.reduce((acc, c) => acc + c.costTotal, 0).toFixed(2)}</strong>
                                                  </span>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-6 text-[10px] px-2 font-semibold gap-1 text-primary border-primary/30"
                                                    onClick={() => setIsKitConfigOpen(true)}
                                                  >
                                                    <Plus className="h-3 w-3" /> Gestionar Insumos
                                                  </Button>
                                                </div>
                                              </div>

                                              <div className="overflow-x-auto rounded-lg border">
                                                <Table className="text-xs">
                                                  <TableHeader className="bg-muted/40">
                                                    <TableRow>
                                                      <TableHead className="font-bold">Insumo de Bodega</TableHead>
                                                      <TableHead className="text-center">Cód. Bodega</TableHead>
                                                      <TableHead className="text-right">Por Kit</TableHead>
                                                      <TableHead className="text-right font-bold">Total Requerido</TableHead>
                                                      <TableHead className="text-right font-bold text-rose-700 bg-rose-50/40">Comprado en Bodega</TableHead>
                                                      <TableHead className="text-right">Costo Unit. Prom.</TableHead>
                                                      <TableHead className="text-right font-bold">Inversión Total</TableHead>
                                                      <TableHead className="text-center">Estado Stock</TableHead>
                                                      <TableHead className="text-center">Acción</TableHead>
                                                    </TableRow>
                                                  </TableHeader>
                                                  <TableBody>
                                                    {row.childComponents.map((cd, cIdx) => {
                                                      const isItemStocked = cd.costQty >= cd.requiredTotal;
                                                      return (
                                                        <TableRow key={cIdx} className="hover:bg-muted/30">
                                                          <TableCell className="font-medium">
                                                            <div className="flex flex-col">
                                                              <span className="font-semibold text-foreground">{cd.comp.description}</span>
                                                              {cd.costItemsCount > 0 && (
                                                                <span className="text-[9px] text-muted-foreground">
                                                                  {cd.unifiedDescriptions.slice(0, 2).join(' • ')}
                                                                </span>
                                                              )}
                                                            </div>
                                                          </TableCell>
                                                          <TableCell className="text-center font-mono text-primary text-[10px] font-bold">
                                                            {cd.comp.code || 'S/C'}
                                                          </TableCell>
                                                          <TableCell className="text-right font-mono">{cd.qtyPerParent}</TableCell>
                                                          <TableCell className="text-right font-mono font-bold">{cd.requiredTotal}</TableCell>
                                                          <TableCell className="text-right font-mono font-bold text-rose-700 bg-rose-50/20">
                                                            {cd.costQty}
                                                          </TableCell>
                                                          <TableCell className="text-right font-mono text-muted-foreground">
                                                            ${cd.avgCost.toFixed(2)}
                                                          </TableCell>
                                                          <TableCell className="text-right font-mono font-bold text-foreground">
                                                            ${cd.costTotal.toFixed(2)}
                                                          </TableCell>
                                                          <TableCell className="text-center">
                                                            {isItemStocked ? (
                                                              <Badge className="bg-emerald-600 text-white text-[9px] py-0 font-bold">
                                                                ✓ 100% en Bodega
                                                              </Badge>
                                                            ) : cd.costQty > 0 ? (
                                                              <Badge className="bg-amber-500 text-white text-[9px] py-0 font-bold">
                                                                {cd.costQty} de {cd.requiredTotal} (Faltan {cd.missingQty})
                                                              </Badge>
                                                            ) : (
                                                              <Badge variant="destructive" className="text-[9px] py-0 font-bold">
                                                                Sin Compras
                                                              </Badge>
                                                            )}
                          </TableCell>
                                                          <TableCell className="text-center">
                                                            <Button
                                                              variant="ghost"
                                                              size="sm"
                                                              className="h-6 text-[10px] text-muted-foreground hover:text-destructive px-2"
                                                              onClick={() => handleUnlinkItem(cd.comp.code)}
                                                              title="Desvincular como componente y volver a Renglón Oficial"
                                                            >
                                                              Desvincular
                                                            </Button>
                                                          </TableCell>
                                                        </TableRow>
                                                      );
                                                    })}
                                                  </TableBody>
                                                </Table>
                                              </div>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                                {productRows.length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground italic text-xs">
                                      No hay renglones registrados en la licitación. Use "Cargar Licitación (PDF con IA)" para importarlos.
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>

                      {/* 1. Tabla de Margen y Rentabilidad por Producto */}
                      <Card className="border-t-4 border-t-primary shadow-sm">
                        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2">
                          <div>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                              <TrendingUp className="h-5 w-5 text-green-600" />
                              Margen y Rentabilidad por Producto
                            </CardTitle>
                            <CardDescription className="text-xs">
                              Comparativa de Ventas Facturadas vs. Costos de Adquisición/Insumos por ítem.
                            </CardDescription>
                          </div>
                          <Button size="sm" variant="outline" className="gap-2 border-green-600 text-green-700 hover:bg-green-50 shrink-0" onClick={exportKardexExcel}>
                            <FileDown className="h-4 w-4" /> Exportar Kardex (Excel)
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto rounded-lg border">
                            <Table className="text-xs">
                              <TableHeader className="bg-muted/60">
                                <TableRow>
                                  <TableHead className="font-bold">Producto</TableHead>
                                  <TableHead className="text-center bg-green-50/50 text-green-900 border-x" colSpan={3}>Venta (Facturas)</TableHead>
                                  <TableHead className="text-center bg-orange-50/50 text-orange-900 border-r" colSpan={3}>Costo (Compras / Matriz)</TableHead>
                                  <TableHead className="text-right font-bold bg-primary/5">Margen ($ / %)</TableHead>
                                </TableRow>
                                <TableRow className="text-[10px] uppercase font-bold text-muted-foreground bg-muted/30">
                                  <TableHead></TableHead>
                                  <TableHead className="text-right border-l">Cant.</TableHead>
                                  <TableHead className="text-right">Precio Unit.</TableHead>
                                  <TableHead className="text-right border-r">Venta Total</TableHead>
                                  <TableHead className="text-right">Cant.</TableHead>
                                  <TableHead className="text-right">Costo Unit.</TableHead>
                                  <TableHead className="text-right border-r">Costo Total</TableHead>
                                  <TableHead className="text-right"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {productRows.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground italic">
                                      No hay productos configurados en la Orden de Compra de este proyecto.
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  productRows.map((r, idx) => (
                                    <TableRow key={idx} className="hover:bg-muted/30">
                                      <TableCell className="font-medium max-w-[200px] truncate" title={r.ep.description}>
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-foreground">{r.ep.code || 'S/C'}</span>
                                          {r.isKit && (
                                            <Badge variant="outline" className="text-[8px] py-0 px-1 border-indigo-500/40 text-indigo-600 bg-indigo-500/10 font-bold">
                                              Kit ({r.childComponents.length})
                                            </Badge>
                                          )}
                                        </div>
                                        <span className="block text-[10px] text-muted-foreground truncate">{r.ep.description}</span>
                                      </TableCell>

                                      {/* Venta */}
                                      <TableCell className="text-right border-l font-semibold">{r.saleQty}</TableCell>
                                      <TableCell className="text-right text-muted-foreground">${r.saleAvgUnitPrice.toFixed(2)}</TableCell>
                                      <TableCell className="text-right font-bold text-green-600 border-r">${r.saleTotal.toFixed(2)}</TableCell>

                                      {/* Costo */}
                                      <TableCell className="text-right font-semibold">{r.costQty}</TableCell>
                                      <TableCell className="text-right text-muted-foreground">${r.costAvgUnitPrice.toFixed(2)}</TableCell>
                                      <TableCell className="text-right font-bold text-orange-600 border-r">${r.costTotal.toFixed(2)}</TableCell>

                                      {/* Margen */}
                                      <TableCell className="text-right font-bold bg-primary/5">
                                        <div className={cn("text-xs font-black", r.marginAmount >= 0 ? "text-green-600" : "text-destructive")}>
                                          ${r.marginAmount.toFixed(2)}
                                        </div>
                                        <div className="text-[9px] text-muted-foreground">
                                          {r.marginPercent.toFixed(1)}%
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>

                      {/* 2. Tabla de Control de Entregas e Individualidad Parcial */}
                      <Card>
                        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2">
                          <div>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                              <Package className="h-5 w-5 text-blue-600" />
                              Control de Entregas Parciales y Facturación
                            </CardTitle>
                            <CardDescription className="text-xs">
                              Monitoreo de lo despachado en remisiones individuales vs. facturado por comprobante DTE.
                            </CardDescription>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto rounded-lg border">
                            <Table className="text-xs">
                              <TableHeader className="bg-muted/50">
                                <TableRow>
                                  <TableHead className="font-bold">Producto OC</TableHead>
                                  <TableHead className="text-right">Cotizado (OC)</TableHead>
                                  <TableHead className="text-right text-blue-600">Enviado (Remisión)</TableHead>
                                  <TableHead className="text-right text-green-600">Facturado (DTE)</TableHead>
                                  <TableHead className="text-center">Pend. Enviar</TableHead>
                                  <TableHead className="text-center">Por Facturar</TableHead>
                                  <TableHead className="text-center">Detalle</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {productRows.map((r, idx) => (
                                  <TableRow key={idx} className="hover:bg-muted/30">
                                    <TableCell className="font-medium max-w-[220px] truncate" title={r.ep.description}>
                                      <span className="font-bold">{r.ep.code || 'S/C'}</span> - {r.ep.description}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                      {r.ep.quantity}
                                      <span className="block text-[9px] text-muted-foreground">${(r.ep.quantity * r.ep.unitPrice).toFixed(2)}</span>
                                    </TableCell>
                                    <TableCell className="text-right text-blue-600 font-bold">
                                      {r.deliveredQty}
                                      <span className="block text-[9px] text-muted-foreground">${(r.deliveredQty * r.ep.unitPrice).toFixed(2)}</span>
                                    </TableCell>
                                    <TableCell className="text-right text-green-600 font-bold">
                                      {r.saleQty}
                                    </TableCell>
                                    
                                    {/* Pendiente Enviar */}
                                    <TableCell className="text-center">
                                      {r.pendingDeliver > 0 ? (
                                        <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                                          {r.pendingDeliver} por enviar
                                        </Badge>
                                      ) : r.pendingDeliver < 0 ? (
                                        <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-700 border-purple-200">
                                          +{Math.abs(r.pendingDeliver)} sobre-entrega
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-[9px] bg-green-50 text-green-700 border-green-200">
                                          Completado
                                        </Badge>
                                      )}
                                    </TableCell>

                                    {/* Por Facturar */}
                                    <TableCell className="text-center">
                                      {r.pendingInvoice > 0 ? (
                                        <Badge className="text-[9px] bg-blue-600 text-white">
                                          {r.pendingInvoice} por facturar
                                        </Badge>
                                      ) : (
                                        <Badge variant="secondary" className="text-[9px]">
                                          Facturado
                                        </Badge>
                                      )}
                                    </TableCell>

                                    {/* Ver Detalle */}
                                    <TableCell className="text-center">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs gap-1 text-primary hover:bg-primary/10"
                                        onClick={() => setViewingProductDetail({
                                          code: r.ep.code,
                                          description: r.ep.description,
                                          expectedQty: r.ep.quantity,
                                          expectedPrice: r.ep.unitPrice
                                        })}
                                      >
                                        <Eye className="h-3.5 w-3.5" /> Ver
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}

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
                        
                        {currentProject?.expectedProducts && currentProject.expectedProducts.length > 0 && (
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                              <Sliders className="h-3 w-3 text-primary" /> Seleccionar Producto de la OC (Cascada):
                            </Label>
                            <Select
                              value=""
                              onValueChange={(val) => {
                                const ep = currentProject.expectedProducts.find(p => p.code === val || p.description === val);
                                if (ep) {
                                  setTempManualItem({
                                    ...tempManualItem,
                                    code: ep.code || '',
                                    description: ep.description || '',
                                    unitPrice: ep.unitPrice || 0,
                                    lineTotal: (tempManualItem.quantity || 1) * (ep.unitPrice || 0)
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs bg-background">
                                <SelectValue placeholder="-- Seleccionar de la Orden de Compra --" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[220px]">
                                {currentProject.expectedProducts.map((ep, idx) => (
                                  <SelectItem key={idx} value={ep.code || ep.description} className="text-xs">
                                    <span className="font-bold font-mono text-primary">{ep.code || 'S/C'}</span> - {ep.description}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <Input className="h-8 text-xs font-mono" placeholder="Código" value={tempManualItem.code} onChange={e => {
                            const code = e.target.value;
                            const ep = currentProject?.expectedProducts.find(p => p.code?.trim().toLowerCase() === code.trim().toLowerCase());
                            if (ep) {
                              setTempManualItem({...tempManualItem, code, description: ep.description, unitPrice: ep.unitPrice, lineTotal: (tempManualItem.quantity || 1) * ep.unitPrice});
                            } else {
                              setTempManualItem({...tempManualItem, code});
                            }
                          }} />
                          <Input className="h-8 text-xs sm:col-span-2" placeholder="Descripción" value={tempManualItem.description} onChange={e => setTempManualItem({...tempManualItem, description: e.target.value})} />
                          <Input type="number" className="h-8 text-xs text-right" placeholder="Cant." value={tempManualItem.quantity} onChange={e => {
                            const qty = Number(e.target.value);
                            setTempManualItem({...tempManualItem, quantity: qty, lineTotal: qty * tempManualItem.unitPrice});
                          }} />
                        </div>
                        <Button variant="outline" size="sm" className="w-full h-8 text-xs font-bold" onClick={handleAddManualItem}>Añadir a Remisión</Button>
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
                             const tax = mappedData.taxAmount !== undefined ? mappedData.taxAmount : (isCCF ? subtotal * 0.13 : 0)
                             const parsedRetention = mappedData.retentionAmount || 0
                             const calculatedRetention = parsedRetention > 0 
                               ? parsedRetention 
                               : (isGC && isCCF && subtotal >= 100 ? subtotal * 0.01 : 0)
                             const perception = mappedData.perceptionAmount || 0
                             const adjustedTotal = mappedData.totalAmount || (subtotal + tax - calculatedRetention + perception)

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
                      <th className="p-2 text-left font-bold text-muted-foreground">Descripción en Factura</th>
                      <th className="p-2 text-left font-bold text-muted-foreground min-w-[180px]">Unificar a Ítem OC</th>
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
                            value={item?.quantity || 0} 
                            onChange={(e) => {
                              const newQty = Number(e.target.value);
                              const newItems = [...(editingTransaction.items || [])];
                              newItems[idx] = { ...item, quantity: newQty, lineTotal: newQty * (item?.unitPrice || 0) };
                              setEditingTransaction({ ...editingTransaction, items: newItems });
                            }} 
                          />
                        </td>
                        <td className="p-2">
                          <Input 
                            className="h-8 text-xs font-mono" 
                            value={item?.code || ''} 
                            onChange={(e) => {
                              const newItems = [...(editingTransaction.items || [])];
                              newItems[idx] = { ...item, code: e.target.value };
                              setEditingTransaction({ ...editingTransaction, items: newItems });
                            }} 
                          />
                        </td>
                        <td className="p-2">
                          <Input 
                            className="h-8 text-xs" 
                            value={item?.description || ''} 
                            onChange={(e) => {
                              const newItems = [...(editingTransaction.items || [])];
                              newItems[idx] = { ...item, description: e.target.value };
                              setEditingTransaction({ ...editingTransaction, items: newItems });
                            }} 
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={item?.matchedProductCode || getMatchingExpectedProduct(item, currentProject?.expectedProducts || [])?.code || '__UNMATCHED__'}
                            onChange={(e) => {
                              const newItems = [...(editingTransaction.items || [])];
                              newItems[idx] = { ...item, matchedProductCode: e.target.value };
                              setEditingTransaction({ ...editingTransaction, items: newItems });
                            }}
                            className="w-full h-8 text-[11px] rounded border bg-background px-2 text-foreground"
                          >
                            <option value="__UNMATCHED__">📦 Sin vincular (Excedente)</option>
                            {(currentProject?.expectedProducts || []).map((ep) => (
                              <option key={ep.code} value={ep.code}>
                                {ep.parentCode 
                                  ? `  ↳ [Insumo: ${ep.code}] ${ep.description.slice(0, 26)}`
                                  : `🌟 [Oficial: ${ep.code}] ${ep.description.slice(0, 26)}`}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <Input 
                            type="number" 
                            className="h-8 w-24 text-xs text-right" 
                            value={item?.unitPrice || 0} 
                            onChange={(e) => {
                              const newPrice = Number(e.target.value);
                              const newItems = [...(editingTransaction.items || [])];
                              newItems[idx] = { ...item, unitPrice: newPrice, lineTotal: (item?.quantity || 0) * newPrice };
                              setEditingTransaction({ ...editingTransaction, items: newItems });
                            }} 
                          />
                        </td>
                        <td className="p-2 text-right font-bold text-foreground">
                          ${((item?.quantity || 0) * (item?.unitPrice || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
      {/* Modal: Detalle de Entregas e Historial por Producto */}
      <Dialog open={!!viewingProductDetail} onOpenChange={(open) => !open && setViewingProductDetail(null)}>
        <DialogContent className="sm:max-w-[820px] w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Eye className="h-5 w-5 text-primary" />
              Desglose de Productos Unificados, Compras y Entregas del Renglón
            </DialogTitle>
            <CardDescription className="text-xs">
              {viewingProductDetail?.code ? `[${viewingProductDetail.code}] ` : ''}{viewingProductDetail?.description}
            </CardDescription>
          </DialogHeader>

          {viewingProductDetail && currentProject && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2 bg-muted/40 p-3 rounded-lg border text-center">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Cotizado (OC)</span>
                  <span className="text-sm font-bold text-foreground">{viewingProductDetail.expectedQty} u.</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Remitido (Físico)</span>
                  <span className="text-sm font-bold text-blue-600">
                    {transactions
                      .filter(t => t.projectId === currentProject.id && !t.isVoided && t.type === 'remission')
                      .flatMap(t => t.items || [])
                      .filter(i => {
                        if (!i) return false;
                        const match = getMatchingExpectedProduct(i, currentProject.expectedProducts);
                        return match && (match.code === viewingProductDetail.code || match.description === viewingProductDetail.description);
                      })
                      .reduce((acc, curr) => acc + (curr?.quantity || 0), 0)} u.
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Facturado (Fiscal)</span>
                  <span className="text-sm font-bold text-green-600">
                    {transactions
                      .filter(t => t.projectId === currentProject.id && !t.isVoided && t.type === 'sale')
                      .flatMap(t => t.items || [])
                      .filter(i => {
                        if (!i) return false;
                        const match = getMatchingExpectedProduct(i, currentProject.expectedProducts);
                        return match && (match.code === viewingProductDetail.code || match.description === viewingProductDetail.description);
                      })
                      .reduce((acc, curr) => acc + (curr?.quantity || 0), 0)} u.
                  </span>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/60">
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Factura / Doc</TableHead>
                      <TableHead>Descripción en Factura / Proveedor</TableHead>
                      <TableHead className="text-center">Tipo</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">P. Unit</TableHead>
                      <TableHead className="text-right font-bold">Total ($)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const projectTxs = transactions.filter(t => t.projectId === currentProject.id && !t.isVoided);
                      const matchingEvents = projectTxs.flatMap(tx => {
                        const matchingItems = (tx.items || []).filter(i => {
                          if (!i) return false;
                          const match = getMatchingExpectedProduct(i, currentProject.expectedProducts);
                          return match && (match.code === viewingProductDetail.code || match.description === viewingProductDetail.description);
                        });

                        return matchingItems.map(item => ({
                          txId: tx.id,
                          date: tx.issueDate,
                          docNum: tx.invoiceNumber || 'S/N',
                          entityName: tx.entityName || '',
                          itemCode: item.code || '',
                          itemDescription: item.description || '',
                          docType: tx.documentType,
                          type: tx.type,
                          quantity: item.quantity,
                          unitPrice: item.unitPrice,
                          lineTotal: item.lineTotal || (item.quantity * item.unitPrice)
                        }));
                      });

                      if (matchingEvents.length === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground italic">
                              No hay productos de facturas ni movimientos unificados en este renglón aún.
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return matchingEvents.map((evt, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-muted-foreground whitespace-nowrap">{new Date(evt.date).toLocaleDateString()}</TableCell>
                          <TableCell className="font-mono font-bold text-foreground text-[10px]">
                            <div>{evt.docNum}</div>
                            {evt.entityName && <div className="text-[9px] text-muted-foreground font-sans font-normal truncate max-w-[120px]">{evt.entityName}</div>}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-foreground max-w-[230px]">
                            <div className="truncate" title={evt.itemDescription}>{evt.itemDescription}</div>
                            {evt.itemCode && <div className="text-[9px] font-mono text-muted-foreground">Cód: {evt.itemCode}</div>}
                          </TableCell>
                          <TableCell className="text-center">
                            {evt.type === 'remission' && <Badge className="bg-blue-500 text-[9px]">Remisión</Badge>}
                            {evt.type === 'sale' && <Badge className="bg-green-600 text-[9px]">{evt.docType === '03' ? 'CCF Venta' : 'FAC Venta'}</Badge>}
                            {evt.type === 'purchase' && <Badge variant="outline" className="text-[9px] border-blue-500/40 text-blue-500">Unificado Compra</Badge>}
                          </TableCell>
                          <TableCell className="text-right font-bold">{evt.quantity}</TableCell>
                          <TableCell className="text-right text-muted-foreground">${evt.unitPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold text-foreground">${evt.lineTotal.toFixed(2)}</TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button variant="outline" size="sm" onClick={() => setViewingProductDetail(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Unir Proyectos */}
      <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
        <DialogContent className="sm:max-w-[500px] w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <GitMerge className="h-5 w-5 text-blue-600" />
              Unir / Fusionar Proyectos
            </DialogTitle>
            <CardDescription className="text-xs">
              Consolide dos entregas o presupuestos en un solo proyecto principal manteniendo el historial de remisiones y comprobantes DTE.
            </CardDescription>
          </DialogHeader>

          {sourceProjectToMerge && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
                <span className="font-bold block">Proyecto Origen a Consolidar:</span>
                <span className="font-semibold block text-sm">{sourceProjectToMerge.name}</span>
                <span className="text-[10px] text-amber-700">Monto OC: ${sourceProjectToMerge.targetSaleAmount.toLocaleString()} • OC: {sourceProjectToMerge.purchaseOrder}</span>
              </div>

              <div className="space-y-2">
                <Label>Seleccionar Proyecto Destino (Principal)</Label>
                <Select value={targetProjectIdToMerge} onValueChange={setTargetProjectIdToMerge}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Seleccione el proyecto que conservará todo" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects
                      .filter(p => p.id !== sourceProjectToMerge.id)
                      .map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.name} ({p.purchaseOrder}) - ${p.targetSaleAmount.toLocaleString()}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  * Todas las facturas, remisiones y productos del proyecto origen pasarán a formar parte de este proyecto. El proyecto origen se eliminará.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsMergeDialogOpen(false)} disabled={isMerging}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 gap-2"
              disabled={!targetProjectIdToMerge || isMerging}
              onClick={handleConfirmMerge}
            >
              {isMerging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitMerge className="h-3.5 w-3.5" />}
              Confirmar Fusión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Importar Orden de Compra / Licitación desde Word o PDF con IA */}
      <Dialog open={isTenderModalOpen} onOpenChange={setIsTenderModalOpen}>
        <DialogContent className="sm:max-w-[900px] w-[95vw] max-h-[92vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold font-headline text-foreground">
              <Sparkles className="h-5 w-5 text-blue-500" />
              Cargar Orden de Compra / Licitación (Word Prioritario o PDF) con IA
            </DialogTitle>
            <CardDescription>
              Suba el archivo <strong>Word (.docx / .doc) [Prioridad Recomendada]</strong> o PDF de la Orden de Compra. Gemini extraerá los requisitos, plazos, institución y renglones para crear el proyecto automáticamente.
            </CardDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {/* Dropzone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all",
                isDraggingTender ? "border-blue-500 bg-blue-500/15 scale-[0.99]" : tenderFile ? "bg-blue-50/20 border-blue-500/40" : "hover:border-blue-500/50 bg-muted/20"
              )}
              onClick={() => tenderFileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingTender(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingTender(false); }}
              onDrop={handleTenderDrop}
            >
              <input
                type="file"
                ref={tenderFileInputRef}
                className="hidden"
                accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,.pdf,application/pdf"
                onChange={handleTenderPdfUpload}
              />
              {isAnalyzingTender ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
                  <div>
                    <p className="font-bold text-sm text-foreground">Analizando Requisitos de la Orden de Compra...</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Gemini está extrayendo renglones, plazos de entrega, condiciones y precios del documento.</p>
                  </div>
                </div>
              ) : tenderFile ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                      tenderFile.name.toLowerCase().endsWith('.doc') || tenderFile.name.toLowerCase().endsWith('.docx')
                        ? "bg-blue-100 dark:bg-blue-950/40 text-blue-600"
                        : "bg-red-100 dark:bg-red-950/40 text-red-600"
                    )}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-xs text-foreground truncate">{tenderFile.name}</p>
                        <Badge variant="outline" className="text-[9px] font-bold">
                          {tenderFile.name.toLowerCase().endsWith('.doc') || tenderFile.name.toLowerCase().endsWith('.docx') ? 'WORD (Prioritario)' : 'PDF'}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{(tenderFile.size / 1024).toFixed(1)} KB • Documento listo</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      tenderFileInputRef.current?.click();
                    }}
                  >
                    <Upload className="h-3 w-3" /> Cambiar Archivo
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <div className="flex items-center gap-2">
                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 shadow-sm">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600">
                      <Upload className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-1.5">
                      <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] px-2 py-0">PRIORIDAD: WORD (.DOCX / .DOC)</Badge>
                      <Badge variant="outline" className="text-[10px] px-2 py-0">También acepta .PDF</Badge>
                    </div>
                    <p className="font-bold text-sm text-foreground pt-1">Haga clic para seleccionar el archivo Word o PDF de la Orden de Compra</p>
                    <p className="text-xs text-muted-foreground">Se creará el proyecto automáticamente de acuerdo a los requisitos y renglones de la OC</p>
                  </div>
                </div>
              )}
            </div>

            {/* Resultado de la IA */}
            {tenderParsedData && (
              <div className="space-y-4 animate-in fade-in duration-300">
                {tenderParsedData.summary && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-foreground leading-relaxed">{tenderParsedData.summary}</p>
                  </div>
                )}

                {/* Datos generales extraídos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-muted/30 p-3 rounded-lg border">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold">Nombre del Proyecto / Suministro</Label>
                    <Input
                      value={tenderParsedData.projectName || ''}
                      onChange={(e) => setTenderParsedData({ ...tenderParsedData, projectName: e.target.value })}
                      className="h-8 text-xs"
                      placeholder="Nombre según Orden de Compra"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold">No. Orden de Compra (OC)</Label>
                    <Input
                      value={tenderParsedData.purchaseOrder || ''}
                      onChange={(e) => setTenderParsedData({ ...tenderParsedData, purchaseOrder: e.target.value })}
                      className="h-8 text-xs font-mono font-bold"
                      placeholder="Ej: OC-01/2026"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold">Cliente / Institución Compradora</Label>
                    <Input
                      value={tenderParsedData.customerName || ''}
                      onChange={(e) => setTenderParsedData({ ...tenderParsedData, customerName: e.target.value })}
                      className="h-8 text-xs"
                      placeholder="Ej: Ministerio de Salud"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-bold">Monto Total OC ($)</Label>
                      {(() => {
                        const sumItems = (tenderParsedData.items || []).reduce(
                          (acc, it) => acc + (Number(it.lineTotal) || (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)),
                          0
                        );
                        if (sumItems > 0 && Math.abs((tenderParsedData.totalBudget || 0) - sumItems) > 0.05) {
                          return (
                            <button
                              type="button"
                              onClick={() => setTenderParsedData({ ...tenderParsedData, totalBudget: Number(sumItems.toFixed(2)) })}
                              className="text-[9px] text-emerald-500 hover:underline font-bold"
                              title="Igualar al total exacto de la suma de renglones"
                            >
                              Usar suma (${sumItems.toFixed(2)})
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      value={tenderParsedData.totalBudget ?? ''}
                      onChange={(e) => setTenderParsedData({ ...tenderParsedData, totalBudget: Number(e.target.value) })}
                      className="h-8 text-xs font-bold text-emerald-500 font-mono"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Requisitos de la Orden de Compra */}
                <div className="bg-blue-950/15 border border-blue-500/25 p-3 rounded-lg space-y-2.5">
                  <Label className="text-xs font-bold flex items-center gap-1.5 text-blue-400">
                    <FileSearch className="h-3.5 w-3.5" />
                    Requisitos Extraídos de la Orden de Compra
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground font-semibold">Plazo / Fecha de Entrega</Label>
                      <Input
                        value={tenderParsedData.deliveryDeadline || ''}
                        onChange={(e) => setTenderParsedData({ ...tenderParsedData, deliveryDeadline: e.target.value })}
                        className="h-7 text-xs"
                        placeholder="Ej: 15 días hábiles"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground font-semibold">Lugar / Bodega de Entrega</Label>
                      <Input
                        value={tenderParsedData.deliveryAddress || ''}
                        onChange={(e) => setTenderParsedData({ ...tenderParsedData, deliveryAddress: e.target.value })}
                        className="h-7 text-xs"
                        placeholder="Bodega institucional o dirección"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground font-semibold">Condiciones de Pago / Garantía</Label>
                      <Input
                        value={tenderParsedData.paymentTerms || ''}
                        onChange={(e) => setTenderParsedData({ ...tenderParsedData, paymentTerms: e.target.value })}
                        className="h-7 text-xs"
                        placeholder="Ej: Crédito 30 días / Quedan"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground font-semibold">Requisitos Especiales / Administrador de OC / Notas</Label>
                    <Input
                      value={tenderParsedData.orderRequirements || ''}
                      onChange={(e) => setTenderParsedData({ ...tenderParsedData, orderRequirements: e.target.value })}
                      className="h-7 text-xs"
                      placeholder="Documentos requeridos al entregar, contacto de administrador de contrato, etc."
                    />
                  </div>
                </div>

                {/* Destino de la Orden de Compra */}
                <div className="bg-card p-3 rounded-lg border space-y-2">
                  <Label className="text-xs font-bold">Acción con la Orden de Compra:</Label>
                  <Select value={tenderTargetProjectId} onValueChange={setTenderTargetProjectId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Seleccione el destino" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new" className="text-xs font-bold text-emerald-600">
                        ✨ Crear automáticamente NUEVO Proyecto con los requisitos de esta OC
                      </SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          Actualizar requisitos y productos en: {p.name} ({p.purchaseOrder})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tabla de Productos Clasificados */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 text-primary" />
                      Renglones y Productos Clasificados ({tenderParsedData.items?.length || 0})
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] gap-1"
                      onClick={() => {
                        const newItems = [...(tenderParsedData.items || [])];
                        newItems.push({
                          code: `Renglón ${newItems.length + 1}`,
                          description: 'Nuevo Producto',
                          quantity: 1,
                          unitPrice: 0,
                          lineTotal: 0,
                          unit: 'Galón',
                        });
                        setTenderParsedData({ ...tenderParsedData, items: newItems });
                      }}
                    >
                      <Plus className="h-3 w-3" /> Añadir Renglón
                    </Button>
                  </div>

                  <ScrollArea className="h-[230px] rounded-lg border">
                    <Table className="text-[11px]">
                      <TableHeader className="bg-muted sticky top-0">
                        <TableRow>
                          <TableHead className="w-[100px]">Renglón/Cód</TableHead>
                          <TableHead>Descripción Técnica</TableHead>
                          <TableHead className="w-[90px] text-center">Unidad</TableHead>
                          <TableHead className="w-[80px] text-right">Cant.</TableHead>
                          <TableHead className="w-[90px] text-right">Precio ($)</TableHead>
                          <TableHead className="w-[90px] text-right">Total ($)</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tenderParsedData.items?.map((it, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="p-1.5">
                              <Input
                                value={it.code}
                                onChange={(e) => {
                                  const updated = [...(tenderParsedData.items || [])];
                                  updated[idx] = { ...updated[idx], code: e.target.value };
                                  setTenderParsedData({ ...tenderParsedData, items: updated });
                                }}
                                className="h-7 text-[10px] font-mono font-bold"
                              />
                            </TableCell>
                            <TableCell className="p-1.5">
                              <Input
                                value={it.description}
                                onChange={(e) => {
                                  const updated = [...(tenderParsedData.items || [])];
                                  updated[idx] = { ...updated[idx], description: e.target.value };
                                  setTenderParsedData({ ...tenderParsedData, items: updated });
                                }}
                                className="h-7 text-[10px]"
                              />
                            </TableCell>
                            <TableCell className="p-1.5 text-center">
                              <Input
                                value={it.unit || ''}
                                onChange={(e) => {
                                  const updated = [...(tenderParsedData.items || [])];
                                  updated[idx] = { ...updated[idx], unit: e.target.value };
                                  setTenderParsedData({ ...tenderParsedData, items: updated });
                                }}
                                placeholder="Cubeta, Galón"
                                className="h-7 text-[10px] text-center"
                              />
                            </TableCell>
                            <TableCell className="p-1.5 text-right">
                              <Input
                                type="number"
                                step="any"
                                value={it.quantity}
                                onChange={(e) => {
                                  const qty = Number(e.target.value);
                                  const updated = [...(tenderParsedData.items || [])];
                                  const up = Number(updated[idx].unitPrice) || 0;
                                  const newLt = Number((qty * up).toFixed(2));
                                  updated[idx] = { ...updated[idx], quantity: qty, lineTotal: newLt };
                                  const newSum = Number(updated.reduce((acc, r) => acc + (Number(r.lineTotal) || (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0)), 0).toFixed(2));
                                  setTenderParsedData({ ...tenderParsedData, items: updated, totalBudget: newSum });
                                }}
                                className="h-7 text-[10px] text-right font-bold"
                              />
                            </TableCell>
                            <TableCell className="p-1.5 text-right">
                              <Input
                                type="number"
                                step="0.01"
                                value={it.unitPrice ?? 0}
                                onChange={(e) => {
                                  const pr = Number(e.target.value);
                                  const updated = [...(tenderParsedData.items || [])];
                                  const q = Number(updated[idx].quantity) || 0;
                                  const newLt = Number((q * pr).toFixed(2));
                                  updated[idx] = { ...updated[idx], unitPrice: pr, lineTotal: newLt };
                                  const newSum = Number(updated.reduce((acc, r) => acc + (Number(r.lineTotal) || (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0)), 0).toFixed(2));
                                  setTenderParsedData({ ...tenderParsedData, items: updated, totalBudget: newSum });
                                }}
                                className="h-7 text-[10px] text-right font-mono"
                              />
                            </TableCell>
                            <TableCell className="p-1.5 text-right">
                              <Input
                                type="number"
                                step="0.01"
                                value={it.lineTotal ?? Number(((it.quantity || 0) * (it.unitPrice || 0)).toFixed(2))}
                                onChange={(e) => {
                                  const lt = Number(e.target.value);
                                  const updated = [...(tenderParsedData.items || [])];
                                  const q = Number(updated[idx].quantity) || 1;
                                  const calcUp = q > 0 ? Number((lt / q).toFixed(4)) : 0;
                                  updated[idx] = { ...updated[idx], lineTotal: lt, unitPrice: calcUp };
                                  const newSum = Number(updated.reduce((acc, r) => acc + (Number(r.lineTotal) || (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0)), 0).toFixed(2));
                                  setTenderParsedData({ ...tenderParsedData, items: updated, totalBudget: newSum });
                                }}
                                className="h-7 text-[10px] text-right font-mono font-bold text-emerald-500"
                              />
                            </TableCell>
                            <TableCell className="p-1.5 text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  const updated = (tenderParsedData.items || []).filter((_, i) => i !== idx);
                                  const newSum = Number(updated.reduce((acc, r) => acc + (Number(r.lineTotal) || (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0)), 0).toFixed(2));
                                  setTenderParsedData({ ...tenderParsedData, items: updated, totalBudget: newSum });
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>

                  {/* Barra de Verificación Matemática de Renglones vs Monto de la Orden */}
                  {(() => {
                    const sumRows = Number(
                      (tenderParsedData.items || [])
                        .reduce((acc, r) => acc + (Number(r.lineTotal) || (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0)), 0)
                        .toFixed(2)
                    );
                    const sumRowsPlusIva = Number((sumRows * 1.13).toFixed(2));
                    return (
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/40 border text-xs">
                        <div className="flex items-center gap-3 font-mono">
                          <span className="text-muted-foreground">
                            Suma de Renglones: <strong className="text-foreground">${sumRows.toFixed(2)}</strong>
                          </span>
                          <span className="text-muted-foreground">
                            Monto Total OC: <strong className="text-emerald-500">${Number(tenderParsedData.totalBudget || 0).toFixed(2)}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] font-mono"
                            onClick={() => setTenderParsedData({ ...tenderParsedData, totalBudget: sumRows })}
                          >
                            = Igualar OC a Suma (${sumRows.toFixed(2)})
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] font-mono text-blue-500 border-blue-500/30"
                            onClick={() => {
                              const itemsWithIva = (tenderParsedData.items || []).map(r => {
                                const q = Number(r.quantity) || 1;
                                const upIva = Number(((Number(r.unitPrice) || 0) * 1.13).toFixed(4));
                                const ltIva = Number((q * upIva).toFixed(2));
                                return { ...r, unitPrice: upIva, lineTotal: ltIva };
                              });
                              const totalIva = Number(itemsWithIva.reduce((acc, r) => acc + (r.lineTotal || 0), 0).toFixed(2));
                              setTenderParsedData({ ...tenderParsedData, items: itemsWithIva, totalBudget: totalIva });
                            }}
                            title="Si los precios de la tabla están sin IVA, multiplica cada precio por 1.13 y actualiza el total"
                          >
                            + Sumar 13% IVA a Precios (${sumRowsPlusIva.toFixed(2)})
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 gap-2 pt-3 border-t flex-wrap">
            <Button
              variant="outline"
              size="sm"
              disabled={isSavingTenderProject}
              onClick={() => setIsTenderModalOpen(false)}
            >
              Cancelar
            </Button>
            {(tenderTargetProjectId === 'new' || !tenderTargetProjectId) && tenderParsedData && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs border-blue-500/40 text-blue-500 hover:bg-blue-500/10 font-bold"
                disabled={!tenderParsedData || isSavingTenderProject}
                onClick={() => handleApplyTenderToProject('form')}
              >
                <Pencil className="h-3.5 w-3.5" />
                Pasar al Formulario (Revisar)
              </Button>
            )}
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold"
              disabled={!tenderParsedData || isSavingTenderProject}
              onClick={() => handleApplyTenderToProject('direct')}
            >
              {isSavingTenderProject ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {tenderTargetProjectId === 'new' || !tenderTargetProjectId
                ? 'Crear Proyecto con Requisitos de la OC'
                : 'Actualizar Requisitos en el Proyecto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Auditoría IA de Licitación */}
      <Dialog open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen}>
        <DialogContent className="sm:max-w-[700px] w-[95vw] max-h-[85vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold font-headline text-foreground">
              <Bot className="h-5 w-5 text-emerald-500" />
              Auditoría y Diagnóstico de Licitación con IA
            </DialogTitle>
            <CardDescription>
              Evaluación inteligente de compras vinculadas, remisiones al cliente y saldos pendientes por suministrar.
            </CardDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1">
            {isAuditingTender ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
                <p className="font-bold text-sm text-foreground">Auditando cumplimiento de licitación...</p>
                <p className="text-xs text-muted-foreground">Analizando facturas de compras, remisiones y márgenes presupuestarios.</p>
              </div>
            ) : auditResult ? (
              <div className="space-y-4 animate-in fade-in duration-300">
                {/* Score y Estado */}
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Estado General</span>
                    <p className="text-base font-bold text-foreground mt-0.5">{auditResult.overallStatus}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Cumplimiento Global</span>
                    <p className="text-2xl font-black text-emerald-600">{auditResult.completionPercentage}%</p>
                  </div>
                </div>

                {/* Resumen Ejecutivo */}
                <div className="p-4 bg-card rounded-xl border shadow-sm space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-primary" />
                    Resumen Ejecutivo
                  </h4>
                  <p className="text-xs text-foreground leading-relaxed">{auditResult.executiveSummary}</p>
                </div>

                {/* Alertas por Renglón */}
                {auditResult.itemAlerts && auditResult.itemAlerts.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Diagnóstico por Renglón
                    </h4>
                    <div className="space-y-2">
                      {auditResult.itemAlerts.map((alt, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "p-3 rounded-lg border text-xs flex items-start gap-2.5",
                            alt.status === 'OK' && "bg-emerald-50/40 border-emerald-300 text-emerald-900 dark:text-emerald-200 dark:bg-emerald-950/20",
                            alt.status === 'PENDIENTE' && "bg-amber-50/40 border-amber-300 text-amber-900 dark:text-amber-200 dark:bg-amber-950/20",
                            (alt.status === 'CRITICO' || alt.status === 'EXCESO') && "bg-rose-50/40 border-rose-300 text-rose-900 dark:text-rose-200 dark:bg-rose-950/20"
                          )}
                        >
                          <Badge
                            className={cn(
                              "text-[9px] font-mono font-bold shrink-0",
                              alt.status === 'OK' && "bg-emerald-600 text-white",
                              alt.status === 'PENDIENTE' && "bg-amber-500 text-white",
                              (alt.status === 'CRITICO' || alt.status === 'EXCESO') && "bg-rose-600 text-white"
                            )}
                          >
                            {alt.code}: {alt.status}
                          </Badge>
                          <p className="flex-1 leading-relaxed">{alt.observation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recomendaciones Accionables */}
                {auditResult.actionRecommendations && auditResult.actionRecommendations.length > 0 && (
                  <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-2">
                    <h4 className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                      <Sparkles className="h-3.5 w-3.5" />
                      Recomendaciones Accionables
                    </h4>
                    <ul className="space-y-1.5 text-xs text-foreground">
                      {auditResult.actionRecommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <DialogFooter className="mt-3 pt-3 border-t">
            <Button size="sm" onClick={() => setIsAuditModalOpen(false)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  )
}
