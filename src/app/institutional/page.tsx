
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
import { Loader2, Plus, Briefcase, Calculator, ReceiptText, Trash2, Upload, XCircle, Package, Pencil, CheckCircle, FileText, CheckCircle2, FileDown, Eye, Download, Maximize2, Sliders, Edit2, GitMerge, Layers, TrendingUp, Info, PlayCircle, Archive, Search } from "lucide-react"
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
    entities, projects, transactions, addProject, updateProject, deleteProject, mergeProjects,
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

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const customers = entities.filter(e => e.type === 'customer')
  const suppliers = entities.filter(e => e.type === 'supplier')
  const currentProject = projects.find(p => p.id === selectedProjectId)
  const projectTransactions = transactions.filter(t => t.projectId === selectedProjectId && !t.isVoided)
  
  const projectCosts = projectTransactions.filter(t => t.type === 'purchase').reduce((acc, curr) => acc + curr.totalAmount, 0)

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

    const iCode = cleanStringLower(i.code);
    if (iCode) {
      const byCode = expectedProducts.find(ep => cleanStringLower(ep.code) === iCode);
      if (byCode) return byCode;
    }

    const iDesc = cleanStringLower(i.description);
    if (!iDesc) return null;

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
    
    rawItems.forEach(item => {
      const ep = getMatchingExpectedProduct(item, currentProject.expectedProducts);
      const isExpected = !!ep;
      const unitPrice = item.unitPrice || (ep?.unitPrice || 0);
      const txItem = {
        description: item.description ? cleanString(item.description) : (ep?.description || 'Gasto proveedor'),
        quantity: item.quantity || 1,
        unitPrice: unitPrice,
        lineTotal: item.lineTotal || ((item.quantity || 1) * unitPrice),
        code: item.code ? cleanString(item.code) : (ep?.code || 'S/C')
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
      items: (mappedData.items || []).map(i => ({ ...i, description: i.description || '', quantity: i.quantity || 1, unitPrice: i.unitPrice || 0, lineTotal: i.lineTotal || 0 })),
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
              <Dialog open={isProjectDialogOpen} onOpenChange={(open) => {
                setIsProjectDialogOpen(open)
                if (!open) {
                  setEditingProject(null)
                  setNewProject({ name: '', purchaseOrder: '', targetSaleAmount: 0, customerId: '', warrantyStartDate: '', warrantyMonths: 0 })
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
                          <div className="flex justify-between items-center gap-2">
                            <h4 className="font-bold text-xs uppercase text-muted-foreground flex-1">Productos de la OC</h4>
                            <div className="flex gap-1">
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
                                title="Cargar desde Excel"
                              >
                                <Upload className="h-3 w-3" /> Cargar
                              </Button>
                              <input type="file" ref={fileInputExcelRef} className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
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
                                  const projectProduct = getMatchingExpectedProduct(it, currentProject?.expectedProducts || []);
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
                  
                  const productRows = (currentProject.expectedProducts || []).map(ep => {
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

                    const pendingDeliver = ep.quantity - deliveredQty;
                    const pendingInvoice = deliveredQty - saleQty;
                    const marginAmount = saleTotal - costTotal;
                    const marginPercent = saleTotal > 0 ? (marginAmount / saleTotal) * 100 : 0;

                    return {
                      ep,
                      deliveredQty,
                      saleQty,
                      saleTotal,
                      saleAvgUnitPrice,
                      costQty,
                      costTotal,
                      costAvgUnitPrice,
                      pendingDeliver,
                      pendingInvoice,
                      marginAmount,
                      marginPercent
                    };
                  });

                  return (
                    <div className="space-y-6">
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
                                        <span className="font-bold text-foreground">{r.ep.code || 'S/C'}</span>
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
        <DialogContent className="sm:max-w-[700px] w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Eye className="h-5 w-5 text-primary" />
              Historial de Entregas y Facturas Parciales
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
                      <TableHead>Comprobante / N° Doc</TableHead>
                      <TableHead className="text-center">Tipo</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">P. Unit / Costo</TableHead>
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
                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">
                              No hay movimientos ni comprobantes registrados para este producto aún.
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return matchingEvents.map((evt, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-muted-foreground">{new Date(evt.date).toLocaleDateString()}</TableCell>
                          <TableCell className="font-mono font-bold text-foreground">{evt.docNum}</TableCell>
                          <TableCell className="text-center">
                            {evt.type === 'remission' && <Badge className="bg-blue-500 text-[9px]">Remisión Parcial</Badge>}
                            {evt.type === 'sale' && <Badge className="bg-green-600 text-[9px]">{evt.docType === '03' ? 'CCF Factura' : 'FAC Venta'}</Badge>}
                            {evt.type === 'purchase' && <Badge variant="outline" className="text-[9px]">Compra / Insumo</Badge>}
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
    </AppLayout>
  )
}
