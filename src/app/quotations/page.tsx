"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/layout/AppLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Plus, 
  Trash2, 
  Printer, 
  Save, 
  RotateCcw, 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  FileSpreadsheet,
  Building2,
  User,
  Calendar,
  Sparkles,
  CheckCircle2,
  FolderOpen,
  Copy,
  FileDown,
  Upload,
  Briefcase,
  Search,
  Loader2,
  FileText,
  Sliders,
  Package,
  Clock,
  MapPin
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useLedgerStore, type ProjectProduct } from "@/lib/store"
import { useFirestore } from "@/firebase"
import { aiTenderParser } from "@/ai/flows/ai-tender-parser"
import { jsPDF } from "jspdf"

export interface QuotationItem {
  id: string
  code: string             // Código o Renglón (ej. Renglón 1, PT-01)
  description: string
  unit: string             // Unidad de medida (Cubeta 5 Gal, Galón, Kit, Unidad)
  costoLista: number       // Costo Lista con IVA
  precioPublico: number    // Precio de venta al público
  isSpecialQuote: boolean  // Cotización especial con fábrica (12% desc por defecto)
  divisor: number          // Divisor seleccionado para cálculo del precio
  quantity: number         // Cantidad de unidades
}

export interface SavedQuotation {
  id: string
  quoteNumber: string
  referenceProcess?: string
  institution: string
  contactName: string
  quoteDate: string
  validityDays: string
  deliveryTime?: string
  paymentTerms?: string
  notes?: string
  factoryDiscountPct: number
  applyRetention1Pct: boolean
  status: 'Borrador' | 'Enviada' | 'Aprobada' | 'Rechazada'
  items: QuotationItem[]
  totals: {
    totalCotizado: number
    costoTotal: number
    utilidadBruta: number
    margenRealPct: number
  }
  savedAt: string
  convertedProjectId?: string
}

const DIVISORES_NORMALES = [
  { value: 0.80, label: "÷ 0.80 (20% Margen Bruto)", margin: "20%" },
  { value: 0.79, label: "÷ 0.79 (21% Margen Bruto) [Default]", margin: "21%" },
  { value: 0.78, label: "÷ 0.78 (22% Margen Bruto)", margin: "22%" },
  { value: 0.75, label: "÷ 0.75 (25% Margen Bruto)", margin: "25%" },
  { value: 0.70, label: "÷ 0.70 (30% Margen Bruto)", margin: "30%" },
]

const DIVISORES_ESPECIALES = [
  { value: 0.90, label: "÷ 0.90 (10% Margen)", margin: "10%" },
  { value: 0.85, label: "÷ 0.85 (15% Margen) [Default]", margin: "15%" },
  { value: 0.80, label: "÷ 0.80 (20% Margen)", margin: "20%" },
  { value: 0.75, label: "÷ 0.75 (25% Margen)", margin: "25%" },
  { value: 0.70, label: "÷ 0.70 (30% Margen)", margin: "30%" },
  { value: 0.65, label: "÷ 0.65 (35% Margen)", margin: "35%" },
]

const UNIDADES_COMUNES = [
  "Cubeta 5 Gal",
  "Galón",
  "Kit",
  "Cuarto (1/4 Gal)",
  "Litro",
  "Caneca",
  "Unidad",
  "Pliego",
  "Rollo"
]

export default function QuotationsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const db = useFirestore()
  const { entities, projects, inventory, addEntity, addProject } = useLedgerStore()

  // Encabezado de la cotización
  const [institution, setInstitution] = React.useState("MINISTERIO DE SALUD / HOSPITAL NACIONAL")
  const [contactName, setContactName] = React.useState("Lic. Roberto Morales (Adquisiciones)")
  const [referenceProcess, setReferenceProcess] = React.useState("LG-2026 / Solicitud de Cotización")
  const [quoteNumber, setQuoteNumber] = React.useState(`COT-${new Date().getFullYear()}-101`)
  const [quoteDate, setQuoteDate] = React.useState(new Date().toISOString().split("T")[0])
  const [validityDays, setValidityDays] = React.useState("30 días calendario")
  const [deliveryTime, setDeliveryTime] = React.useState("Inmediato / 5 días hábiles")
  const [paymentTerms, setPaymentTerms] = React.useState("Crédito 30 días / Quedan Institucional")
  const [quoteStatus, setQuoteStatus] = React.useState<'Borrador' | 'Enviada' | 'Aprobada' | 'Rechazada'>('Borrador')
  const [notes, setNotes] = React.useState("Precios incluyen IVA (13%). Entrega en bodega institucional sin costo adicional.")

  // Parámetros financieros globales de cotización
  const [factoryDiscountPct, setFactoryDiscountPct] = React.useState<number>(12) // 12% descuento especial de fábrica por defecto
  const [applyRetention1Pct, setApplyRetention1Pct] = React.useState<boolean>(false)

  // Modales y carga IA / Excel
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false)
  const [isCatalogOpen, setIsCatalogOpen] = React.useState(false)
  const [savedQuotes, setSavedQuotes] = React.useState<SavedQuotation[]>([])
  const [historySearch, setHistorySearch] = React.useState("")
  const [catalogSearch, setCatalogSearch] = React.useState("")
  const [isImportingAI, setIsImportingAI] = React.useState(false)
  const [isConvertingToProject, setIsConvertingToProject] = React.useState(false)

  const aiFileInputRef = React.useRef<HTMLInputElement>(null)
  const excelFileInputRef = React.useRef<HTMLInputElement>(null)

  // Lista de productos en la cotización
  const [items, setItems] = React.useState<QuotationItem[]>([
    {
      id: "item-1",
      code: "Renglón 1",
      description: "PINTURA LATEX ARQUITECTONICA BLANCO MATE (CUBETA 5 GL)",
      unit: "Cubeta 5 Gal",
      costoLista: 129.50,
      precioPublico: 185.00,
      isSpecialQuote: false,
      divisor: 0.79,
      quantity: 10
    },
    {
      id: "item-2",
      code: "Renglón 2",
      description: "PINTURA EPÓXICA ALTO RENDIMIENTO GRIS PERLA (KIT 2 GL)",
      unit: "Kit",
      costoLista: 129.50,
      precioPublico: 185.00,
      isSpecialQuote: true,
      divisor: 0.85,
      quantity: 25
    }
  ])

  const customers = React.useMemo(() => entities.filter(e => e.type === 'customer'), [entities])

  // Catálogo unificado de productos de proyectos previos, inventario y cotizaciones guardadas
  const productCatalog = React.useMemo(() => {
    const map = new Map<string, { code: string; description: string; unit: string; suggestedPrice: number; source: string }>()

    inventory.forEach(inv => {
      const key = (inv.description || '').trim().toUpperCase()
      if (key && !map.has(key)) {
        map.set(key, {
          code: inv.code || 'INV',
          description: inv.description.trim(),
          unit: 'Unidad',
          suggestedPrice: Number(inv.unitPrice) || 0,
          source: 'Inventario Global'
        })
      }
    })

    projects.forEach(proj => {
      (proj.expectedProducts || []).forEach(ep => {
        const key = (ep.description || '').trim().toUpperCase()
        if (key && !map.has(key)) {
          map.set(key, {
            code: ep.code || 'Renglón',
            description: ep.description.trim(),
            unit: ep.unit || 'Unidad',
            suggestedPrice: Number(ep.unitPrice) || 0,
            source: `Proyecto: ${proj.name}`
          })
        }
      })
    })

    savedQuotes.forEach(sq => {
      (sq.items || []).forEach(it => {
        const key = (it.description || '').trim().toUpperCase()
        if (key && !map.has(key)) {
          map.set(key, {
            code: it.code || 'Renglón',
            description: it.description.trim(),
            unit: it.unit || 'Unidad',
            suggestedPrice: Number(it.costoLista) || 0,
            source: `Cotización ${sq.quoteNumber}`
          })
        }
      })
    })

    return Array.from(map.values())
  }, [inventory, projects, savedQuotes])

  // Cargar historial desde localStorage al iniciar
  const loadSavedQuotesFromStorage = React.useCallback(() => {
    if (typeof window === "undefined") return
    try {
      const list: SavedQuotation[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith("quote_")) {
          const raw = localStorage.getItem(k)
          if (raw) {
            const parsed = JSON.parse(raw)
            list.push({
              id: parsed.id || parsed.quoteNumber || k,
              quoteNumber: parsed.quoteNumber || k.replace("quote_", ""),
              referenceProcess: parsed.referenceProcess || "",
              institution: parsed.institution || "Sin Institución",
              contactName: parsed.contactName || "",
              quoteDate: parsed.quoteDate || new Date().toISOString().split("T")[0],
              validityDays: parsed.validityDays || "30 días calendario",
              deliveryTime: parsed.deliveryTime || "Inmediato",
              paymentTerms: parsed.paymentTerms || "Crédito 30 días",
              notes: parsed.notes || "",
              factoryDiscountPct: parsed.factoryDiscountPct ?? 12,
              applyRetention1Pct: parsed.applyRetention1Pct ?? false,
              status: parsed.status || "Borrador",
              items: (parsed.items || []).map((it: any, idx: number) => ({
                id: it.id || `item-${idx}`,
                code: it.code || `Renglón ${idx + 1}`,
                description: it.description || "",
                unit: it.unit || "Unidad",
                costoLista: Number(it.costoLista) || 0,
                precioPublico: Number(it.precioPublico) || 0,
                isSpecialQuote: Boolean(it.isSpecialQuote),
                divisor: Number(it.divisor) || (it.isSpecialQuote ? 0.85 : 0.79),
                quantity: Number(it.quantity) || 1,
              })),
              totals: parsed.totals || { totalCotizado: 0, costoTotal: 0, utilidadBruta: 0, margenRealPct: 0 },
              savedAt: parsed.savedAt || new Date().toISOString(),
              convertedProjectId: parsed.convertedProjectId,
            })
          }
        }
      }
      list.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
      setSavedQuotes(list)
    } catch (e) {
      console.warn("Error leyendo cotizaciones guardadas:", e)
    }
  }, [])

  React.useEffect(() => {
    setQuoteNumber(`COT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`)
    loadSavedQuotesFromStorage()
  }, [loadSavedQuotesFromStorage])

  // Cálculos específicos para cada ítem
  const calculateItem = React.useCallback((item: QuotationItem) => {
    // 1. Análisis de Margen Público
    const factorCosto = item.precioPublico > 0 ? (item.costoLista / item.precioPublico) : 0
    const margenPublico = item.precioPublico > 0 ? ((1 - factorCosto) * 100) : 0

    // 2 y 3. Escenarios de Costo Real y Precio de Venta
    const discountFactor = 1 - (Math.max(0, Math.min(99, factoryDiscountPct)) / 100)
    let costoReal = item.costoLista
    if (item.isSpecialQuote) {
      // Descuento de fábrica directo sobre el costo lista (12% default -> * 0.88)
      costoReal = item.costoLista * discountFactor
    }

    // Precio Unitario Final
    const precioUnitarioFinal = item.divisor > 0 ? (costoReal / item.divisor) : 0
    const subtotal = precioUnitarioFinal * item.quantity
    const costoTotalItem = costoReal * item.quantity
    const utilidadItem = subtotal - costoTotalItem
    const margenItemPct = subtotal > 0 ? (utilidadItem / subtotal) * 100 : 0

    return {
      factorCosto,
      margenPublico,
      costoReal,
      precioUnitarioFinal,
      subtotal,
      costoTotalItem,
      utilidadItem,
      margenItemPct
    }
  }, [factoryDiscountPct])

  // Cálculos globales
  const calculatedItems = React.useMemo(() => {
    return items.map(item => ({
      item,
      calcs: calculateItem(item)
    }))
  }, [items, calculateItem])

  const totals = React.useMemo(() => {
    const totalCotizado = calculatedItems.reduce((acc, curr) => acc + curr.calcs.subtotal, 0)
    const costoTotal = calculatedItems.reduce((acc, curr) => acc + curr.calcs.costoTotalItem, 0)
    const subtotalSinIva = totalCotizado / 1.13
    const iva13 = totalCotizado - subtotalSinIva
    const retencion1 = applyRetention1Pct && subtotalSinIva >= 100 ? subtotalSinIva * 0.01 : 0
    const liquidoRecibir = totalCotizado - retencion1
    const utilidadBruta = totalCotizado - costoTotal
    const margenRealPct = totalCotizado > 0 ? (utilidadBruta / totalCotizado) * 100 : 0

    return {
      totalCotizado,
      costoTotal,
      subtotalSinIva,
      iva13,
      retencion1,
      liquidoRecibir,
      utilidadBruta,
      margenRealPct
    }
  }, [calculatedItems, applyRetention1Pct])

  // Modificar ítem
  const updateItem = (id: string, updates: Partial<QuotationItem>) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it
      const updated = { ...it, ...updates }
      
      // Si cambia el toggle de cotización especial, ajustar automáticamente el divisor por defecto
      if (updates.isSpecialQuote !== undefined && updates.divisor === undefined) {
        updated.divisor = updates.isSpecialQuote ? 0.85 : 0.79
      }
      return updated
    }))
  }

  // Añadir ítem
  const addItem = () => {
    const nextNum = items.length + 1
    const newItem: QuotationItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `Renglón ${nextNum}`,
      description: "",
      unit: "Galón",
      costoLista: 0,
      precioPublico: 0,
      isSpecialQuote: false,
      divisor: 0.79,
      quantity: 1
    }
    setItems(prev => [...prev, newItem])
  }

  // Duplicar ítem
  const duplicateItem = (item: QuotationItem) => {
    const nextNum = items.length + 1
    const copy: QuotationItem = {
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `Renglón ${nextNum}`,
    }
    setItems(prev => [...prev, copy])
    toast({ title: "Línea duplicada", description: `Se duplicó "${item.description || copy.code}".` })
  }

  // Eliminar ítem
  const removeItem = (id: string) => {
    if (items.length <= 1) {
      toast({
        title: "No se puede eliminar",
        description: "La cotización debe contener al menos un producto.",
        variant: "destructive"
      })
      return
    }
    setItems(prev => prev.filter(it => it.id !== id))
  }

  // Acciones masivas en toda la tabla
  const toggleAllSpecialQuote = (enableSpecial: boolean) => {
    setItems(prev => prev.map(it => ({
      ...it,
      isSpecialQuote: enableSpecial,
      divisor: enableSpecial ? 0.85 : 0.79
    })))
    toast({
      title: enableSpecial ? `Cotización Especial (-${factoryDiscountPct}%) activada en todo` : "Modo Venta Institucional Normal en todo",
      description: `Se actualizaron los ${items.length} renglones de la cotización.`
    })
  }

  const applyDivisorToAll = (divisorVal: number) => {
    setItems(prev => prev.map(it => ({
      ...it,
      divisor: divisorVal
    })))
    toast({
      title: `Divisor ÷ ${divisorVal.toFixed(2)} aplicado a todos los ítems`,
    })
  }

  // Reiniciar cotización
  const resetQuote = () => {
    if (confirm("¿Desea iniciar una nueva cotización en blanco?")) {
      setInstitution("")
      setContactName("")
      setReferenceProcess("")
      setQuoteStatus("Borrador")
      setQuoteNumber(`COT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`)
      setQuoteDate(new Date().toISOString().split("T")[0])
      setItems([
        {
          id: `item-${Date.now()}`,
          code: "Renglón 1",
          description: "",
          unit: "Galón",
          costoLista: 0,
          precioPublico: 0,
          isSpecialQuote: false,
          divisor: 0.79,
          quantity: 1
        }
      ])
      toast({ title: "Nueva Cotización Lista" })
    }
  }

  // Guardar cotización
  const saveQuote = (silent = false): SavedQuotation | null => {
    if (!institution.trim()) {
      if (!silent) {
        toast({
          title: "Falta institución o cliente",
          description: "Por favor indique el nombre de la institución o cliente antes de guardar.",
          variant: "destructive"
        })
      }
      return null
    }

    try {
      const quoteData: SavedQuotation = {
        id: quoteNumber,
        quoteNumber,
        referenceProcess,
        institution: institution.trim(),
        contactName: contactName.trim(),
        quoteDate,
        validityDays,
        deliveryTime,
        paymentTerms,
        notes,
        factoryDiscountPct,
        applyRetention1Pct,
        status: quoteStatus,
        items,
        totals: {
          totalCotizado: totals.totalCotizado,
          costoTotal: totals.costoTotal,
          utilidadBruta: totals.utilidadBruta,
          margenRealPct: totals.margenRealPct
        },
        savedAt: new Date().toISOString()
      }
      localStorage.setItem(`quote_${quoteNumber}`, JSON.stringify(quoteData))
      loadSavedQuotesFromStorage()
      if (!silent) {
        toast({
          title: "✅ Cotización Guardada",
          description: `La cotización ${quoteNumber} para ${institution} quedó guardada en el historial.`
        })
      }
      return quoteData
    } catch (e) {
      if (!silent) {
        toast({
          title: "Error al guardar",
          description: "No se pudo guardar la cotización.",
          variant: "destructive"
        })
      }
      return null
    }
  }

  // Cargar una cotización del historial
  const handleLoadSavedQuote = (sq: SavedQuotation) => {
    setQuoteNumber(sq.quoteNumber)
    setReferenceProcess(sq.referenceProcess || "")
    setInstitution(sq.institution)
    setContactName(sq.contactName)
    setQuoteDate(sq.quoteDate)
    setValidityDays(sq.validityDays)
    setDeliveryTime(sq.deliveryTime || "Inmediato / 5 días hábiles")
    setPaymentTerms(sq.paymentTerms || "Crédito 30 días")
    setNotes(sq.notes || "")
    setFactoryDiscountPct(sq.factoryDiscountPct ?? 12)
    setApplyRetention1Pct(sq.applyRetention1Pct ?? false)
    setQuoteStatus(sq.status || "Borrador")
    setItems(sq.items)
    setIsHistoryOpen(false)
    toast({
      title: `Cotización ${sq.quoteNumber} Cargada`,
      description: `Cliente: ${sq.institution}`
    })
  }

  // Duplicar una cotización del historial con nuevo correlativo
  const handleDuplicateSavedQuote = (sq: SavedQuotation) => {
    const newNum = `COT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`
    handleLoadSavedQuote({
      ...sq,
      id: newNum,
      quoteNumber: newNum,
      quoteDate: new Date().toISOString().split("T")[0],
      status: "Borrador"
    })
    toast({
      title: "Cotización Duplicada",
      description: `Se creó la copia ${newNum} lista para editar.`
    })
  }

  // Eliminar cotización guardada
  const handleDeleteSavedQuote = (qNum: string) => {
    if (confirm(`¿Eliminar la cotización ${qNum} del historial?`)) {
      localStorage.removeItem(`quote_${qNum}`)
      loadSavedQuotesFromStorage()
      toast({ title: "Cotización Eliminada", description: `${qNum} fue eliminada del historial.` })
    }
  }

  // Importar Solicitud de Cotización desde Word (.docx/.doc) o PDF con IA
  const handleImportWordOrPdfWithAI = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const lower = file.name.toLowerCase()
    const isWord = lower.endsWith(".docx") || lower.endsWith(".doc")
    const isPdf = lower.endsWith(".pdf")

    if (!isWord && !isPdf) {
      toast({
        title: "Formato no soportado",
        description: "Seleccione un archivo Word (.docx / .doc) o PDF.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsImportingAI(true)
      let dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (ev) => resolve(ev.target?.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      if (isWord && dataUri.includes("base64,")) {
        const b64 = dataUri.split("base64,")[1]
        const mime = lower.endsWith(".doc")
          ? "application/msword"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        dataUri = `data:${mime};base64,${b64}`
      }

      const resp = await aiTenderParser({
        pdfDataUri: dataUri,
        documentName: file.name,
      })

      if (!resp.success || !resp.data) {
        throw new Error(resp.error || "No se pudieron extraer los renglones del documento.")
      }

      const d = resp.data
      if (d.customerName) setInstitution(d.customerName)
      if (d.purchaseOrder || d.projectName) {
        setReferenceProcess([d.purchaseOrder, d.projectName].filter(Boolean).join(" - "))
      }
      if (d.deliveryDeadline) setDeliveryTime(d.deliveryDeadline)
      if (d.paymentTerms) setPaymentTerms(d.paymentTerms)

      if (d.items && d.items.length > 0) {
        const importedItems: QuotationItem[] = d.items.map((it, idx) => ({
          id: `item-${Date.now()}-${idx}`,
          code: it.code || `Renglón ${idx + 1}`,
          description: it.description || `Producto ${idx + 1}`,
          unit: it.unit || "Galón",
          costoLista: Number(it.unitPrice) || 0,
          precioPublico: Number(it.unitPrice) > 0 ? Number((Number(it.unitPrice) / 0.70).toFixed(2)) : 0,
          isSpecialQuote: false,
          divisor: 0.79,
          quantity: Number(it.quantity) || 1,
        }))
        setItems(importedItems)
      }

      toast({
        title: isWord ? "Solicitud Word Importada con IA" : "Solicitud PDF Importada con IA",
        description: `Se cargaron ${d.items?.length || 0} renglones en el cotizador.`
      })
    } catch (err: any) {
      toast({
        title: "Error al importar con IA",
        description: err.message || "No se pudo procesar el archivo.",
        variant: "destructive"
      })
    } finally {
      setIsImportingAI(false)
      if (e.target) e.target.value = ""
    }
  }

  // Importar productos desde Excel (.xlsx)
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const XLSX = await import("xlsx")
      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result
          const wb = XLSX.read(bstr, { type: "binary" })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const data = XLSX.utils.sheet_to_json(ws)

          const imported: QuotationItem[] = []
          data.forEach((row: any, idx: number) => {
            const desc = row["DESCRIPCION"] || row["DESCRIPCION DEL PRODUCTO"] || row["Descripcion"] || row["Producto"] || ""
            const code = row["CODIGO"] || row["RENGLON"] || row["Codigo"] || `Renglón ${idx + 1}`
            const unit = row["UNIDAD"] || row["Unidad"] || "Galón"
            const qty = Number(row["CANTIDAD"] || row["Cantidad"] || 1) || 1
            const costo = Number(row["COSTO LISTA"] || row["COSTO"] || row["PRECIO VENTA"] || row["Costo"] || 0) || 0
            const pub = Number(row["PRECIO PUBLICO"] || row["Publico"] || (costo > 0 ? (costo / 0.70).toFixed(2) : 0)) || 0

            if (String(desc).trim()) {
              imported.push({
                id: `item-${Date.now()}-${idx}`,
                code: String(code).trim(),
                description: String(desc).trim(),
                unit: String(unit).trim(),
                costoLista: costo,
                precioPublico: pub,
                isSpecialQuote: false,
                divisor: 0.79,
                quantity: qty,
              })
            }
          })

          if (imported.length > 0) {
            setItems(imported)
            toast({ title: "Excel Importado", description: `Se cargaron ${imported.length} productos en la cotización.` })
          } else {
            toast({ title: "Sin filas válidas", description: "Verifique que el Excel tenga columna DESCRIPCION y CANTIDAD.", variant: "destructive" })
          }
        } catch {
          toast({ title: "Error leyendo Excel", description: "El archivo no tiene un formato Excel válido.", variant: "destructive" })
        }
      }
      reader.readAsBinaryString(file)
    } catch (err) {
      console.error(err)
    }
    e.target.value = ""
  }

  // Exportar Cotización a Excel (.xlsx) con 2 pestañas: Oferta Cliente y Análisis Interno de Margen
  const handleExportExcel = async () => {
    try {
      const XLSX = await import("xlsx")
      const wb = XLSX.utils.book_new()

      // Hoja 1: Cotización Formal para el Cliente (sin costos internos)
      const clientRows = calculatedItems.map(({ item, calcs }, idx) => ({
        "No.": idx + 1,
        "Renglón / Código": item.code || `Renglón ${idx + 1}`,
        "Descripción del Producto": item.description,
        "Unidad de Medida": item.unit || "Unidad",
        "Cantidad": item.quantity,
        "Precio Unitario c/IVA ($)": Number(calcs.precioUnitarioFinal.toFixed(2)),
        "Subtotal c/IVA ($)": Number(calcs.subtotal.toFixed(2)),
      }))
      const wsClient = XLSX.utils.json_to_sheet(clientRows)
      XLSX.utils.book_append_sheet(wb, wsClient, "Oferta Cliente")

      // Hoja 2: Análisis Interno de Costos y Márgenes
      const internalRows = calculatedItems.map(({ item, calcs }, idx) => ({
        "No.": idx + 1,
        "Renglón / Código": item.code || `Renglón ${idx + 1}`,
        "Descripción": item.description,
        "Unidad": item.unit || "Unidad",
        "Costo Lista c/IVA ($)": item.costoLista,
        "Precio Público ($)": item.precioPublico,
        "Factor Costo": Number(calcs.factorCosto.toFixed(2)),
        "Margen Público (%)": Number(calcs.margenPublico.toFixed(1)),
        "Cotización Especial Fábrica": item.isSpecialQuote ? `SÍ (-${factoryDiscountPct}%)` : "NO (Normal)",
        "Costo Real Fábrica ($)": Number(calcs.costoReal.toFixed(2)),
        "Divisor (÷)": item.divisor,
        "Precio Unitario Cotizado ($)": Number(calcs.precioUnitarioFinal.toFixed(2)),
        "Cantidad": item.quantity,
        "Subtotal Venta ($)": Number(calcs.subtotal.toFixed(2)),
        "Costo Total Línea ($)": Number(calcs.costoTotalItem.toFixed(2)),
        "Utilidad Bruta Línea ($)": Number(calcs.utilidadItem.toFixed(2)),
        "Margen Real (%)": Number(calcs.margenItemPct.toFixed(1)),
      }))
      const wsInternal = XLSX.utils.json_to_sheet(internalRows)
      XLSX.utils.book_append_sheet(wb, wsInternal, "Analisis Interno Margen")

      XLSX.writeFile(wb, `Cotizacion_${quoteNumber}_${institution.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 25)}.xlsx`)
      toast({
        title: "Excel Exportado",
        description: "Incluye pestaña 'Oferta Cliente' y pestaña 'Análisis Interno Margen'."
      })
    } catch (err) {
      console.error(err)
      toast({ title: "Error al exportar Excel", variant: "destructive" })
    }
  }

  // Descargar PDF Formal para el Cliente usando jsPDF
  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" })
      const pageW = doc.internal.pageSize.getWidth()

      // Encabezado Corporativo
      doc.setFillColor(15, 23, 42) // Slate 900
      doc.rect(0, 0, pageW, 34, "F")

      doc.setTextColor(255, 255, 255)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(18)
      doc.text("PINTURAS TECNICOLOR", 14, 15)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(16, 185, 129) // Emerald 500
      doc.text("DIVISIÓN INSTITUCIONAL Y PROYECTOS ESPECIALES", 14, 21)
      doc.setTextColor(203, 213, 225)
      doc.text("San Salvador, El Salvador • Ventas Institucionales y Licitaciones", 14, 27)

      // Caja derecha: N° Cotización
      doc.setFillColor(16, 185, 129)
      doc.roundedRect(pageW - 68, 8, 54, 18, 2, 2, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.text("COTIZACIÓN FORMAL", pageW - 41, 14, { align: "center" })
      doc.setFontSize(11)
      doc.text(quoteNumber, pageW - 41, 21, { align: "center" })

      // Datos del Cliente
      let y = 43
      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
      doc.roundedRect(14, y - 5, pageW - 28, 28, 2, 2, "FD")

      doc.setTextColor(15, 23, 42)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.text("INSTITUCIÓN / CLIENTE:", 18, y + 1)
      doc.setFont("helvetica", "normal")
      doc.text((institution || "CLIENTE INSTITUCIONAL").slice(0, 65), 62, y + 1)

      doc.setFont("helvetica", "bold")
      doc.text("ATENCIÓN / CONTACTO:", 18, y + 7)
      doc.setFont("helvetica", "normal")
      doc.text((contactName || "Departamento de Compras / UACI").slice(0, 60), 62, y + 7)

      doc.setFont("helvetica", "bold")
      doc.text("PROCESO / REFERENCIA:", 18, y + 13)
      doc.setFont("helvetica", "normal")
      doc.text((referenceProcess || quoteNumber).slice(0, 55), 62, y + 13)

      doc.setFont("helvetica", "bold")
      doc.text("FECHA:", pageW - 72, y + 1)
      doc.setFont("helvetica", "normal")
      doc.text(new Date(quoteDate).toLocaleDateString(), pageW - 48, y + 1)

      doc.setFont("helvetica", "bold")
      doc.text("VALIDEZ:", pageW - 72, y + 7)
      doc.setFont("helvetica", "normal")
      doc.text((validityDays || "30 días").slice(0, 22), pageW - 48, y + 7)

      doc.setFont("helvetica", "bold")
      doc.text("ENTREGA:", pageW - 72, y + 13)
      doc.setFont("helvetica", "normal")
      doc.text((deliveryTime || "Inmediata").slice(0, 22), pageW - 48, y + 13)

      // Encabezado de Tabla
      y = 78
      doc.setFillColor(15, 23, 42)
      doc.rect(14, y, pageW - 28, 8, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(8.5)
      doc.text("RENGLÓN", 17, y + 5.5)
      doc.text("DESCRIPCIÓN TÉCNICA DEL PRODUCTO", 42, y + 5.5)
      doc.text("UNIDAD", 132, y + 5.5, { align: "center" })
      doc.text("CANT.", 153, y + 5.5, { align: "right" })
      doc.text("P. UNIT ($)", 176, y + 5.5, { align: "right" })
      doc.text("TOTAL ($)", pageW - 16, y + 5.5, { align: "right" })

      y += 8
      doc.setTextColor(15, 23, 42)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8.5)

      calculatedItems.forEach(({ item, calcs }, idx) => {
        const descLines = doc.splitTextToSize(item.description || `Producto ${idx + 1}`, 78)
        const rowH = Math.max(8, descLines.length * 4.5 + 3)

        if (y + rowH > 230) {
          doc.addPage()
          y = 20
        }

        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252)
          doc.rect(14, y, pageW - 28, rowH, "F")
        }

        doc.setDrawColor(226, 232, 240)
        doc.line(14, y + rowH, pageW - 14, y + rowH)

        doc.setFont("helvetica", "bold")
        doc.text((item.code || `${idx + 1}`).slice(0, 12), 17, y + 5.5)
        doc.setFont("helvetica", "normal")
        doc.text(descLines, 42, y + 5.5)
        doc.text((item.unit || "Unidad").slice(0, 14), 132, y + 5.5, { align: "center" })
        doc.text(String(item.quantity), 153, y + 5.5, { align: "right" })
        doc.text(`$${calcs.precioUnitarioFinal.toFixed(2)}`, 176, y + 5.5, { align: "right" })
        doc.setFont("helvetica", "bold")
        doc.text(`$${calcs.subtotal.toFixed(2)}`, pageW - 16, y + 5.5, { align: "right" })

        y += rowH
      })

      // Totales y Condiciones
      y += 8
      if (y > 220) {
        doc.addPage()
        y = 25
      }

      // Caja de Totales
      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(203, 213, 225)
      doc.roundedRect(pageW - 84, y, 70, applyRetention1Pct ? 30 : 24, 2, 2, "FD")

      doc.setFont("helvetica", "normal")
      doc.setFontSize(8.5)
      doc.setTextColor(71, 85, 105)
      doc.text("Subtotal (sin IVA):", pageW - 80, y + 6)
      doc.text(`$${totals.subtotalSinIva.toFixed(2)}`, pageW - 18, y + 6, { align: "right" })

      doc.text("IVA (13%):", pageW - 80, y + 12)
      doc.text(`$${totals.iva13.toFixed(2)}`, pageW - 18, y + 12, { align: "right" })

      if (applyRetention1Pct) {
        doc.text(" (-) Retención IVA 1%:", pageW - 80, y + 18)
        doc.text(`-$${totals.retencion1.toFixed(2)}`, pageW - 18, y + 18, { align: "right" })
      }

      const totalY = applyRetention1Pct ? y + 26 : y + 20
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42)
      doc.text("TOTAL OFERTA:", pageW - 80, totalY)
      doc.text(`$${totals.totalCotizado.toFixed(2)}`, pageW - 18, totalY, { align: "right" })

      // Condiciones Comerciales a la izquierda
      doc.setFont("helvetica", "bold")
      doc.setFontSize(8.5)
      doc.text("CONDICIONES COMERCIALES:", 14, y + 4)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(71, 85, 105)
      const conds = [
        `• Validez de la oferta: ${validityDays}`,
        `• Tiempo de entrega: ${deliveryTime}`,
        `• Condiciones de pago: ${paymentTerms}`,
        notes ? `• Nota: ${notes}` : "• Precios incluyen 13% de IVA."
      ]
      conds.forEach((c, i) => {
        doc.text(c.slice(0, 75), 14, y + 10 + i * 5)
      })

      // Firmas
      const signY = Math.max(y + 52, 248)
      doc.setDrawColor(100, 116, 139)
      doc.line(25, signY, 85, signY)
      doc.line(pageW - 85, signY, pageW - 25, signY)

      doc.setFont("helvetica", "bold")
      doc.setFontSize(8.5)
      doc.setTextColor(15, 23, 42)
      doc.text("Firma Autorizada y Sello", 55, signY + 5, { align: "center" })
      doc.text("Aceptación de la Institución / Cliente", pageW - 55, signY + 5, { align: "center" })
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7.5)
      doc.setTextColor(100, 116, 139)
      doc.text("Pinturas Tecnicolor - División Institucional", 55, signY + 9, { align: "center" })
      doc.text("Nombre, Firma, Fecha y Sello de Recepción", pageW - 55, signY + 9, { align: "center" })

      doc.save(`Cotizacion_${quoteNumber}.pdf`)
      toast({
        title: "PDF Descargado",
        description: `Se generó el archivo Cotizacion_${quoteNumber}.pdf listo para enviar al cliente.`
      })
    } catch (err) {
      console.error(err)
      toast({ title: "Error generando PDF", variant: "destructive" })
    }
  }

  // Convertir Cotización Aprobada en un Proyecto Institucional en Firestore
  const handleConvertToProject = async () => {
    if (!institution.trim()) {
      toast({
        title: "Falta nombre de Institución / Cliente",
        description: "Ingrese la institución antes de convertir la cotización en proyecto.",
        variant: "destructive"
      })
      return
    }

    const validItems = calculatedItems.filter(c => c.item.description.trim() !== "")
    if (validItems.length === 0) {
      toast({
        title: "Sin productos",
        description: "Agregue al menos un producto con descripción para crear el proyecto.",
        variant: "destructive"
      })
      return
    }

    setIsConvertingToProject(true)
    try {
      let matchedCustId = ""
      let matchedCustName = institution.trim()

      const existingCust = customers.find(
        c => c.name.trim().toLowerCase() === matchedCustName.toLowerCase() ||
             c.name.trim().toLowerCase().includes(matchedCustName.toLowerCase()) ||
             matchedCustName.toLowerCase().includes(c.name.trim().toLowerCase())
      )

      if (existingCust) {
        matchedCustId = existingCust.id
        matchedCustName = existingCust.name
      } else {
        matchedCustId = await addEntity(db, {
          name: matchedCustName,
          type: "customer",
          isGranContribuyente: applyRetention1Pct,
        })
      }

      const expectedProducts: ProjectProduct[] = validItems.map(({ item, calcs }, idx) => ({
        code: item.code?.trim() || `Renglón ${idx + 1}`,
        description: item.description.trim(),
        unit: item.unit || "Unidad",
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(calcs.precioUnitarioFinal.toFixed(2)),
      }))

      const projName = referenceProcess.trim()
        ? `${institution.trim()} - ${referenceProcess.trim()}`
        : `Proyecto ${institution.trim()} (${quoteNumber})`

      const createdProjId = await addProject(db, {
        name: projName,
        purchaseOrder: referenceProcess.trim() || quoteNumber,
        targetSaleAmount: Number(totals.totalCotizado.toFixed(2)),
        customerId: matchedCustId || "institucional",
        customerName: matchedCustName,
        expectedProducts,
        status: "active",
        warrantyStartDate: new Date().toISOString().split("T")[0],
        warrantyMonths: 12,
        deliveryDeadline: deliveryTime || null,
        paymentTerms: paymentTerms || null,
        orderRequirements: `Generado desde Cotización ${quoteNumber}. Contacto: ${contactName}. ${notes || ""}`.trim(),
      })

      setQuoteStatus("Aprobada")
      const saved = saveQuote(true)
      if (saved && createdProjId) {
        localStorage.setItem(`quote_${quoteNumber}`, JSON.stringify({ ...saved, status: "Aprobada", convertedProjectId: createdProjId }))
        loadSavedQuotesFromStorage()
      }

      toast({
        title: "🚀 Proyecto Institucional Creado",
        description: `La cotización ${quoteNumber} se convirtió en el proyecto "${projName}" con ${expectedProducts.length} renglones.`
      })

      router.push("/institutional")
    } catch (err: any) {
      console.error(err)
      toast({
        title: "Error al crear proyecto",
        description: err.message || "No se pudo convertir la cotización en proyecto.",
        variant: "destructive"
      })
    } finally {
      setIsConvertingToProject(false)
    }
  }

  // Imprimir ventana nativa
  const printQuote = () => {
    window.print()
  }

  return (
    <AppLayout>
      <div className="space-y-6 text-slate-100 max-w-full pb-16 print:text-slate-900 print:pb-0">
        
        {/* Datalist global para autocompletado rápido de descripciones */}
        <datalist id="paint-catalog-list">
          {productCatalog.map((prod, i) => (
            <option key={i} value={prod.description}>
              {prod.code} • {prod.unit} • ${prod.suggestedPrice.toFixed(2)} ({prod.source})
            </option>
          ))}
        </datalist>

        {/* ENCABEZADO PRINCIPAL DE LA PÁGINA */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5 print:hidden">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner">
                <Calculator className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-2xl font-black font-headline tracking-tight text-white">
                    Cotizador Institucional de Pinturas
                  </h2>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono">
                    {quoteNumber}
                  </Badge>
                  <Badge
                    className={
                      quoteStatus === "Aprobada"
                        ? "bg-emerald-600 text-white text-[10px]"
                        : quoteStatus === "Enviada"
                        ? "bg-blue-600 text-white text-[10px]"
                        : quoteStatus === "Rechazada"
                        ? "bg-rose-600 text-white text-[10px]"
                        : "bg-slate-800 text-slate-300 text-[10px]"
                    }
                  >
                    {quoteStatus}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cálculo automático de precios institucionales, importación Word/PDF con IA, historial y conversión directa a Proyecto.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Inputs ocultos para importar */}
            <input
              type="file"
              ref={aiFileInputRef}
              className="hidden"
              accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,.pdf,application/pdf"
              onChange={handleImportWordOrPdfWithAI}
            />
            <input
              type="file"
              ref={excelFileInputRef}
              className="hidden"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
            />

            <Button
              variant="outline"
              size="sm"
              disabled={isImportingAI}
              onClick={() => aiFileInputRef.current?.click()}
              className="bg-blue-950/50 border-blue-500/40 hover:bg-blue-900/50 text-blue-300 gap-1.5 text-xs font-bold"
              title="Subir solicitud de cotización o pliego en Word (.docx/.doc) o PDF"
            >
              {isImportingAI ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-blue-400" />}
              Importar Word / PDF (IA)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadSavedQuotesFromStorage()
                setIsHistoryOpen(true)
              }}
              className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200 gap-1.5 text-xs"
            >
              <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
              Historial ({savedQuotes.length})
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={resetQuote}
              className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300 gap-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Nueva
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => saveQuote(false)}
              className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200 gap-1.5 text-xs font-bold"
            >
              <Save className="h-3.5 w-3.5 text-blue-400" /> Guardar
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-emerald-400 gap-1.5 text-xs"
              title="Exportar Oferta y Análisis de Margen a Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>

            <Button
              size="sm"
              onClick={handleDownloadPDF}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 text-xs shadow-lg shadow-emerald-950"
            >
              <FileDown className="h-3.5 w-3.5" /> Descargar PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={printQuote}
              className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200 gap-1.5 text-xs"
            >
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </Button>

            <Button
              size="sm"
              disabled={isConvertingToProject}
              onClick={handleConvertToProject}
              className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white font-bold gap-1.5 text-xs shadow-lg"
              title="Crear Proyecto Institucional directamente con los productos y precios finales de esta cotización"
            >
              {isConvertingToProject ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Briefcase className="h-3.5 w-3.5" />}
              Convertir en Proyecto
            </Button>
          </div>
        </div>

        {/* ENCABEZADO IMPRESO (SOLO VISIBLE AL IMPRIMIR) */}
        <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-4 text-slate-900">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wide">PINTURAS TECNICOLOR</h1>
              <p className="text-xs text-slate-600 font-semibold">División Institucional y Proyectos Especiales</p>
              <p className="text-xs text-slate-600">San Salvador, El Salvador</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-slate-900 text-white font-bold text-sm rounded">
                COTIZACIÓN FORMAL
              </span>
              <p className="text-sm font-black text-slate-900 mt-1.5 font-mono">{quoteNumber}</p>
              <p className="text-xs text-slate-600">Fecha: {new Date(quoteDate).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* DATOS DEL CLIENTE / INSTITUCIÓN */}
        <Card className="bg-slate-900 border-slate-800 shadow-xl print:border print:border-slate-300 print:shadow-none print:bg-white print:mb-4">
          <CardHeader className="p-4 pb-2 border-b border-slate-800/60 flex flex-row items-center justify-between print:hidden">
            <CardTitle className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-400" />
              Datos de la Institución, Proceso y Condiciones Comerciales
            </CardTitle>
            <div className="flex items-center gap-2">
              {customers.length > 0 && (
                <Select onValueChange={(val) => setInstitution(val)}>
                  <SelectTrigger className="h-7 text-[11px] bg-slate-950 border-slate-700 text-slate-300 w-[210px]">
                    <SelectValue placeholder="Elegir cliente del directorio..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.name} className="text-xs">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={quoteStatus} onValueChange={(v: any) => setQuoteStatus(v)}>
                <SelectTrigger className="h-7 text-[11px] bg-slate-950 border-slate-700 text-slate-200 w-[130px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="Borrador" className="text-xs">Borrador</SelectItem>
                  <SelectItem value="Enviada" className="text-xs">Enviada</SelectItem>
                  <SelectItem value="Aprobada" className="text-xs">Aprobada / OC</SelectItem>
                  <SelectItem value="Rechazada" className="text-xs">Rechazada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3.5 print:p-3 print:grid-cols-3">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5 print:text-slate-700">
                <Building2 className="h-3 w-3 text-slate-500 print:hidden" />
                Institución / Cliente
              </Label>
              <Input
                value={institution}
                onChange={e => setInstitution(e.target.value)}
                placeholder="Ej. Ministerio de Salud / Alcaldía / Hospital"
                className="bg-slate-950 border-slate-700 text-white text-xs h-8 focus-visible:ring-emerald-500 font-medium print:bg-transparent print:border-none print:text-black print:font-bold print:p-0 print:h-auto"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5 print:text-slate-700">
                <User className="h-3 w-3 text-slate-500 print:hidden" />
                Atención / Contacto (UACI)
              </Label>
              <Input
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                placeholder="Ej. Lic. Roberto Morales"
                className="bg-slate-950 border-slate-700 text-white text-xs h-8 focus-visible:ring-emerald-500 font-medium print:bg-transparent print:border-none print:text-black print:p-0 print:h-auto"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5 print:text-slate-700">
                <FileText className="h-3 w-3 text-slate-500 print:hidden" />
                N° Proceso / Libre Gestión / OC
              </Label>
              <Input
                value={referenceProcess}
                onChange={e => setReferenceProcess(e.target.value)}
                placeholder="Ej. LG-015/2026"
                className="bg-slate-950 border-slate-700 text-white text-xs h-8 font-mono focus-visible:ring-emerald-500 print:bg-transparent print:border-none print:text-black print:p-0 print:h-auto"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5 print:text-slate-700">
                <Calendar className="h-3 w-3 text-slate-500 print:hidden" />
                Validez de Oferta
              </Label>
              <Input
                value={validityDays}
                onChange={e => setValidityDays(e.target.value)}
                placeholder="Ej. 30 días calendario"
                className="bg-slate-950 border-slate-700 text-white text-xs h-8 focus-visible:ring-emerald-500 print:bg-transparent print:border-none print:text-black print:p-0 print:h-auto"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5 print:text-slate-700">
                <Clock className="h-3 w-3 text-slate-500 print:hidden" />
                Tiempo de Entrega
              </Label>
              <Input
                value={deliveryTime}
                onChange={e => setDeliveryTime(e.target.value)}
                placeholder="Ej. 5 días hábiles"
                className="bg-slate-950 border-slate-700 text-white text-xs h-8 focus-visible:ring-emerald-500 print:bg-transparent print:border-none print:text-black print:p-0 print:h-auto"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5 print:text-slate-700">
                <DollarSign className="h-3 w-3 text-slate-500 print:hidden" />
                Condiciones de Pago
              </Label>
              <Input
                value={paymentTerms}
                onChange={e => setPaymentTerms(e.target.value)}
                placeholder="Ej. Crédito 30 días / Quedan"
                className="bg-slate-950 border-slate-700 text-white text-xs h-8 focus-visible:ring-emerald-500 print:bg-transparent print:border-none print:text-black print:p-0 print:h-auto"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5 print:text-slate-700">
                <MapPin className="h-3 w-3 text-slate-500 print:hidden" />
                Observaciones / Garantía
              </Label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notas comerciales para el cliente..."
                className="bg-slate-950 border-slate-700 text-white text-xs h-8 focus-visible:ring-emerald-500 print:bg-transparent print:border-none print:text-black print:p-0 print:h-auto"
              />
            </div>
          </CardContent>
        </Card>

        {/* TABLA DINÁMICA DE COTIZACIÓN */}
        <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden print:border-none print:shadow-none print:bg-transparent">
          <CardHeader className="p-4 pb-3 border-b border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-3 print:hidden">
            <div>
              <CardTitle className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                Detalle de Productos y Matriz de Márgenes
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Las columnas de costos, descuento de fábrica y divisores son de uso interno y se ocultan automáticamente en el PDF / Impresión.
              </CardDescription>
            </div>

            {/* BARRA DE HERRAMIENTAS RÁPIDAS Y MASIVAS */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400">% Desc. Fábrica:</span>
                <Input
                  type="number"
                  min="0"
                  max="90"
                  value={factoryDiscountPct}
                  onChange={e => setFactoryDiscountPct(Number(e.target.value) || 0)}
                  className="h-6 w-14 text-xs text-center font-mono bg-slate-900 border-slate-700 text-emerald-400 font-bold px-1"
                />
                <span className="text-[10px] text-slate-500">%</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleAllSpecialQuote(true)}
                className="h-8 text-[11px] bg-slate-950 border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/40"
                title="Activar Cotización Especial de Fábrica en todos los renglones"
              >
                Todo Especial (-{factoryDiscountPct}%)
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleAllSpecialQuote(false)}
                className="h-8 text-[11px] bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-800"
                title="Poner todos los renglones en Venta Institucional Normal"
              >
                Todo Normal
              </Button>

              <Select onValueChange={(v) => applyDivisorToAll(Number(v))}>
                <SelectTrigger className="h-8 text-[11px] bg-slate-950 border-slate-700 text-slate-200 w-[160px]">
                  <SelectValue placeholder="Divisor a todos (÷)" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="0.90" className="text-xs font-mono">Todos ÷ 0.90 (10%)</SelectItem>
                  <SelectItem value="0.85" className="text-xs font-mono">Todos ÷ 0.85 (15%)</SelectItem>
                  <SelectItem value="0.80" className="text-xs font-mono">Todos ÷ 0.80 (20%)</SelectItem>
                  <SelectItem value="0.79" className="text-xs font-mono">Todos ÷ 0.79 (21%)</SelectItem>
                  <SelectItem value="0.78" className="text-xs font-mono">Todos ÷ 0.78 (22%)</SelectItem>
                  <SelectItem value="0.75" className="text-xs font-mono">Todos ÷ 0.75 (25%)</SelectItem>
                  <SelectItem value="0.70" className="text-xs font-mono">Todos ÷ 0.70 (30%)</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCatalogOpen(true)}
                className="h-8 text-xs bg-slate-950 border-slate-700 hover:bg-slate-800 text-slate-200 gap-1"
              >
                <Package className="h-3.5 w-3.5 text-emerald-400" /> Catálogo ({productCatalog.length})
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => excelFileInputRef.current?.click()}
                className="h-8 text-xs bg-slate-950 border-slate-700 hover:bg-slate-800 text-slate-300 gap-1"
                title="Importar filas desde archivo Excel (.xlsx)"
              >
                <Upload className="h-3.5 w-3.5" /> Cargar Excel
              </Button>

              <Button
                onClick={addItem}
                size="sm"
                className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1 text-xs shadow-md shadow-emerald-950"
              >
                <Plus className="h-3.5 w-3.5" /> Añadir Renglón
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="text-xs print:text-slate-900">
                <TableHeader className="bg-slate-950/90 border-b border-slate-800 text-[10px] uppercase tracking-wider print:bg-slate-100 print:border-slate-400">
                  <TableRow className="border-slate-800 hover:bg-transparent print:border-slate-400">
                    <TableHead className="w-[95px] text-slate-400 font-bold print:text-slate-900">Renglón / Cód</TableHead>
                    <TableHead className="min-w-[230px] text-slate-300 font-bold print:text-slate-900">Descripción del Producto</TableHead>
                    <TableHead className="w-[115px] text-center text-slate-300 font-bold print:text-slate-900">Presentación</TableHead>
                    <TableHead className="w-[110px] text-right text-slate-300 font-bold print:hidden">Costo Lista (c/IVA)</TableHead>
                    <TableHead className="w-[105px] text-right text-slate-300 font-bold print:hidden">Precio Público</TableHead>
                    <TableHead className="w-[95px] text-center text-slate-300 font-bold print:hidden">Margen Púb.</TableHead>
                    <TableHead className="w-[110px] text-center text-slate-300 font-bold print:hidden">¿Cot. Especial?</TableHead>
                    <TableHead className="w-[155px] text-center text-slate-300 font-bold print:hidden">Divisor (÷)</TableHead>
                    <TableHead className="w-[110px] text-right text-emerald-400 font-black print:text-slate-900">P. Unitario ($)</TableHead>
                    <TableHead className="w-[80px] text-right text-slate-300 font-bold print:text-slate-900">Cant.</TableHead>
                    <TableHead className="w-[115px] text-right text-emerald-400 font-black print:text-slate-900">Subtotal ($)</TableHead>
                    <TableHead className="w-[95px] text-right text-teal-400 font-bold print:hidden">Utilidad ($)</TableHead>
                    <TableHead className="w-[68px] text-center text-slate-400 print:hidden">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-800/60 print:divide-slate-300">
                  {calculatedItems.map(({ item, calcs }, index) => {
                    const divisorOptions = item.isSpecialQuote ? DIVISORES_ESPECIALES : DIVISORES_NORMALES

                    return (
                      <TableRow 
                        key={item.id} 
                        className="hover:bg-slate-800/40 transition-colors border-slate-800/70 print:border-slate-300"
                      >
                        {/* 1. RENGLÓN / CÓDIGO */}
                        <TableCell className="p-1.5">
                          <Input
                            value={item.code || ""}
                            onChange={e => updateItem(item.id, { code: e.target.value })}
                            placeholder={`Renglón ${index + 1}`}
                            className="bg-slate-950/70 border-slate-800 text-slate-200 text-[11px] h-8 font-mono font-bold focus-visible:ring-emerald-500 print:bg-transparent print:border-none print:text-slate-900 print:p-0"
                          />
                        </TableCell>

                        {/* 2. DESCRIPCIÓN */}
                        <TableCell className="p-1.5">
                          <Input
                            list="paint-catalog-list"
                            value={item.description}
                            onChange={e => {
                              const val = e.target.value
                              const found = productCatalog.find(p => p.description.toLowerCase() === val.toLowerCase())
                              if (found && item.costoLista === 0) {
                                updateItem(item.id, {
                                  description: val,
                                  unit: found.unit || item.unit,
                                  costoLista: found.suggestedPrice,
                                })
                              } else {
                                updateItem(item.id, { description: val })
                              }
                            }}
                            placeholder="Descripción técnica de la pintura o suministro..."
                            className="bg-slate-950/70 border-slate-800 text-slate-100 text-xs h-8 focus-visible:ring-emerald-500 font-medium print:bg-transparent print:border-none print:text-slate-900 print:font-bold print:p-0"
                          />
                          {item.isSpecialQuote && (
                            <div className="flex items-center gap-1.5 mt-1 print:hidden">
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] font-mono py-0 px-1.5">
                                Costo Real Fábrica: ${calcs.costoReal.toFixed(2)} (-{factoryDiscountPct}%)
                              </Badge>
                            </div>
                          )}
                        </TableCell>

                        {/* 3. PRESENTACIÓN / UNIDAD */}
                        <TableCell className="p-1.5 text-center">
                          <Input
                            value={item.unit || ""}
                            onChange={e => updateItem(item.id, { unit: e.target.value })}
                            placeholder="Cubeta 5 Gal"
                            className="bg-slate-950/70 border-slate-800 text-slate-200 text-[11px] h-8 text-center focus-visible:ring-emerald-500 print:bg-transparent print:border-none print:text-slate-900 print:p-0"
                          />
                        </TableCell>

                        {/* 4. COSTO LISTA CON IVA */}
                        <TableCell className="p-1.5 text-right font-mono print:hidden">
                          <div className="relative">
                            <span className="absolute left-2 top-2 text-[10px] text-slate-500">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.costoLista || ""}
                              onChange={e => updateItem(item.id, { costoLista: Number(e.target.value) })}
                              placeholder="0.00"
                              className="bg-slate-950/70 border-slate-800 text-slate-200 text-xs h-8 pl-5 text-right font-mono focus-visible:ring-emerald-500 font-semibold"
                            />
                          </div>
                        </TableCell>

                        {/* 5. PRECIO PÚBLICO */}
                        <TableCell className="p-1.5 text-right font-mono print:hidden">
                          <div className="relative">
                            <span className="absolute left-2 top-2 text-[10px] text-slate-500">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.precioPublico || ""}
                              onChange={e => updateItem(item.id, { precioPublico: Number(e.target.value) })}
                              placeholder="0.00"
                              className="bg-slate-950/70 border-slate-800 text-slate-200 text-xs h-8 pl-5 text-right font-mono focus-visible:ring-emerald-500 font-semibold"
                            />
                          </div>
                        </TableCell>

                        {/* 6. MARGEN PÚBLICO (%) INFORMATIVO */}
                        <TableCell className="p-1.5 text-center print:hidden">
                          <div className="flex flex-col items-center justify-center">
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] font-mono font-bold ${
                                calcs.margenPublico >= 25 
                                  ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" 
                                  : calcs.margenPublico > 0 
                                  ? "text-amber-400 border-amber-500/30 bg-amber-500/10" 
                                  : "text-slate-500 border-slate-700 bg-slate-900"
                              }`}
                            >
                              {calcs.margenPublico.toFixed(1)}%
                            </Badge>
                            {calcs.factorCosto > 0 && (
                              <span className="text-[9px] text-slate-500 font-mono mt-0.5">
                                F: {calcs.factorCosto.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* 7. TOGGLE ¿COTIZACIÓN ESPECIAL? */}
                        <TableCell className="p-1.5 text-center print:hidden">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <Switch
                                checked={item.isSpecialQuote}
                                onCheckedChange={(checked) => updateItem(item.id, { isSpecialQuote: checked })}
                                className="data-[state=checked]:bg-emerald-500 scale-90"
                              />
                              <span className={`text-[10px] font-bold ${item.isSpecialQuote ? "text-emerald-400" : "text-slate-500"}`}>
                                {item.isSpecialQuote ? `SÍ (-${factoryDiscountPct}%)` : "NO"}
                              </span>
                            </div>
                            <span className="text-[8px] text-slate-500">
                              {item.isSpecialQuote ? "Esp. Fábrica" : "Normal"}
                            </span>
                          </div>
                        </TableCell>

                        {/* 8. SELECTOR DIVISOR (÷) */}
                        <TableCell className="p-1.5 print:hidden">
                          <Select
                            value={String(item.divisor)}
                            onValueChange={val => updateItem(item.id, { divisor: Number(val) })}
                          >
                            <SelectTrigger className="bg-slate-950/70 border-slate-800 text-slate-200 text-[11px] h-8 font-mono focus:ring-emerald-500">
                              <SelectValue placeholder="Divisor" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 text-xs">
                              {divisorOptions.map(opt => (
                                <SelectItem key={opt.value} value={String(opt.value)} className="font-mono text-xs">
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* 9. PRECIO UNITARIO FINAL */}
                        <TableCell className="p-1.5 text-right font-mono font-black text-emerald-400 text-xs print:text-slate-900">
                          ${calcs.precioUnitarioFinal.toFixed(2)}
                        </TableCell>

                        {/* 10. CANTIDAD */}
                        <TableCell className="p-1.5 text-right">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity || ""}
                            onChange={e => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value)) })}
                            className="bg-slate-950/70 border-slate-800 text-white text-xs h-8 text-right font-mono font-bold focus-visible:ring-emerald-500 print:bg-transparent print:border-none print:text-slate-900 print:p-0"
                          />
                        </TableCell>

                        {/* 11. SUBTOTAL */}
                        <TableCell className="p-1.5 text-right font-mono font-black text-emerald-400 text-xs print:text-slate-900">
                          ${calcs.subtotal.toFixed(2)}
                        </TableCell>

                        {/* 12. UTILIDAD POR LÍNEA (INTERNO) */}
                        <TableCell className="p-1.5 text-right font-mono text-[11px] text-teal-400 font-bold print:hidden">
                          +${calcs.utilidadItem.toFixed(2)}
                        </TableCell>

                        {/* 13. ACCIONES: DUPLICAR / ELIMINAR */}
                        <TableCell className="p-1.5 text-center print:hidden">
                          <div className="flex items-center justify-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                              onClick={() => duplicateItem(item)}
                              title="Duplicar renglón"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                              onClick={() => removeItem(item.id)}
                              title="Eliminar renglón"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* BARRA INFERIOR DE TABLA */}
            <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 flex flex-wrap justify-between items-center gap-3 print:hidden">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                  className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 font-bold gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" /> + Añadir Producto
                </Button>
                <div className="flex items-center gap-2 ml-3 pl-3 border-l border-slate-800">
                  <Switch
                    checked={applyRetention1Pct}
                    onCheckedChange={setApplyRetention1Pct}
                    className="data-[state=checked]:bg-blue-500 scale-90"
                  />
                  <span className="text-xs text-slate-400">
                    Calcular Retención 1% IVA (Gran Contribuyente)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                <span>{items.length} {items.length === 1 ? "renglón" : "renglones"}</span>
                <span>Subtotal s/IVA: <strong className="text-slate-200">${totals.subtotalSinIva.toFixed(2)}</strong></span>
                <span>IVA 13%: <strong className="text-slate-200">${totals.iva13.toFixed(2)}</strong></span>
                {applyRetention1Pct && (
                  <span>Retención 1%: <strong className="text-amber-400">-${totals.retencion1.toFixed(2)}</strong></span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RESUMEN FINANCIERO Y KPIS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
          
          {/* TOTAL COTIZADO */}
          <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <CardHeader className="p-4 pb-1">
              <CardDescription className="text-xs uppercase font-bold text-slate-400 flex items-center justify-between">
                <span>Total Cotizado (Venta)</span>
                <DollarSign className="h-4 w-4 text-emerald-400" />
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-2xl font-black font-mono text-emerald-400">
                ${totals.totalCotizado.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {applyRetention1Pct
                  ? `Líquido a recibir (-1% Ret.): $${totals.liquidoRecibir.toFixed(2)}`
                  : "Monto facturable total con IVA incluido"}
              </p>
            </CardContent>
          </Card>

          {/* COSTO TOTAL PROYECTADO */}
          <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
            <CardHeader className="p-4 pb-1">
              <CardDescription className="text-xs uppercase font-bold text-slate-400 flex items-center justify-between">
                <span>Costo Total Proyectado</span>
                <TrendingUp className="h-4 w-4 text-blue-400" />
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-2xl font-black font-mono text-slate-200">
                ${totals.costoTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Costo directo de compra (aplicando -{factoryDiscountPct}% en esp.)
              </p>
            </CardContent>
          </Card>

          {/* UTILIDAD BRUTA PROYECTADA */}
          <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400" />
            <CardHeader className="p-4 pb-1">
              <CardDescription className="text-xs uppercase font-bold text-slate-400 flex items-center justify-between">
                <span>Utilidad Bruta Proyectada</span>
                <Sparkles className="h-4 w-4 text-emerald-400" />
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-2xl font-black font-mono text-emerald-300">
                +${totals.utilidadBruta.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Ganancia bruta esperada en esta oferta
              </p>
            </CardContent>
          </Card>

          {/* MARGEN % REAL GANADO */}
          <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden relative group">
            <div className={`absolute top-0 left-0 w-1 h-full ${
              totals.margenRealPct >= 20 ? "bg-emerald-500" : totals.margenRealPct >= 15 ? "bg-teal-500" : "bg-amber-500"
            }`} />
            <CardHeader className="p-4 pb-1">
              <CardDescription className="text-xs uppercase font-bold text-slate-400 flex items-center justify-between">
                <span>Margen % Real Ganado</span>
                <Percent className="h-4 w-4 text-emerald-400" />
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-black font-mono ${
                  totals.margenRealPct >= 15 ? "text-emerald-400" : "text-amber-400"
                }`}>
                  {totals.margenRealPct.toFixed(1)}%
                </span>
                <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px]">
                  Bruto Ponderado
                </Badge>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Rentabilidad real sobre el total cotizado
              </p>
            </CardContent>
          </Card>
        </div>

        {/* RESUMEN PARA IMPRESIÓN (SOLO VISIBLE AL IMPRIMIR) */}
        <div className="hidden print:block mt-6 pt-4 border-t-2 border-slate-900 text-slate-900">
          <div className="flex justify-between items-start gap-8">
            <div className="w-1/2 space-y-1.5 text-xs text-slate-700">
              <p className="font-bold text-slate-900">Condiciones Comerciales:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Validez de la oferta: {validityDays}.</li>
                <li>Tiempo de entrega: {deliveryTime}.</li>
                <li>Condiciones de pago: {paymentTerms}.</li>
                {notes && <li>{notes}</li>}
              </ul>
            </div>

            <div className="w-1/3 bg-slate-50 p-3.5 border border-slate-300 rounded text-right space-y-1.5 font-mono">
              <div className="flex justify-between text-xs text-slate-700">
                <span>Subtotal (sin IVA):</span>
                <span>${totals.subtotalSinIva.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-700">
                <span>IVA (13%):</span>
                <span>${totals.iva13.toFixed(2)}</span>
              </div>
              {applyRetention1Pct && (
                <div className="flex justify-between text-xs text-slate-700">
                  <span>(-) Retención 1%:</span>
                  <span>-${totals.retencion1.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-400 pt-2">
                <span>TOTAL COTIZADO:</span>
                <span>${totals.totalCotizado.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mt-16 text-center text-xs text-slate-800">
            <div className="border-t border-slate-800 pt-2">
              <p className="font-bold">Firma Autorizada y Sello</p>
              <p className="text-[10px] text-slate-600">Pinturas Tecnicolor - División Institucional</p>
            </div>
            <div className="border-t border-slate-800 pt-2">
              <p className="font-bold">Aceptación del Cliente / Institución</p>
              <p className="text-[10px] text-slate-600">Nombre, Firma, Fecha y Sello de Recepción</p>
            </div>
          </div>
        </div>

      </div>

      {/* MODAL: HISTORIAL DE COTIZACIONES GUARDADAS */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="sm:max-w-[850px] w-[95vw] max-h-[88vh] flex flex-col bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader className="pb-3 border-b border-slate-800">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
              <FolderOpen className="h-5 w-5 text-amber-400" />
              Historial de Cotizaciones Guardadas ({savedQuotes.length})
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Buscar por número de cotización, institución, proceso o contacto..."
                className="pl-9 bg-slate-950 border-slate-800 text-slate-100 text-xs h-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1 max-h-[420px] pr-2">
            {savedQuotes.length === 0 ? (
              <div className="py-14 text-center text-slate-400 space-y-2">
                <FolderOpen className="h-10 w-10 mx-auto opacity-30" />
                <p className="text-sm font-bold">No hay cotizaciones guardadas aún</p>
                <p className="text-xs text-slate-500">Haga clic en el botón "Guardar" para almacenar sus cotizaciones aquí.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {savedQuotes
                  .filter(sq => {
                    if (!historySearch.trim()) return true
                    const q = historySearch.toLowerCase()
                    return (
                      sq.quoteNumber.toLowerCase().includes(q) ||
                      sq.institution.toLowerCase().includes(q) ||
                      (sq.referenceProcess || "").toLowerCase().includes(q) ||
                      (sq.contactName || "").toLowerCase().includes(q)
                    )
                  })
                  .map(sq => (
                    <div
                      key={sq.quoteNumber}
                      className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-emerald-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-xs text-emerald-400">{sq.quoteNumber}</span>
                          <Badge
                            className={
                              sq.status === "Aprobada"
                                ? "bg-emerald-600 text-white text-[9px] py-0"
                                : sq.status === "Enviada"
                                ? "bg-blue-600 text-white text-[9px] py-0"
                                : sq.status === "Rechazada"
                                ? "bg-rose-600 text-white text-[9px] py-0"
                                : "bg-slate-800 text-slate-300 text-[9px] py-0"
                            }
                          >
                            {sq.status}
                          </Badge>
                          {sq.referenceProcess && (
                            <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-300 font-mono">
                              {sq.referenceProcess}
                            </Badge>
                          )}
                          <span className="text-[10px] text-slate-500">
                            • {new Date(sq.savedAt).toLocaleDateString()} {new Date(sq.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="font-bold text-sm text-white truncate">{sq.institution}</p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                          <span>{sq.items?.length || 0} renglones</span>
                          <span>Total: <strong className="text-emerald-400">${(sq.totals?.totalCotizado || 0).toFixed(2)}</strong></span>
                          <span>Utilidad: <strong className="text-teal-400">+${(sq.totals?.utilidadBruta || 0).toFixed(2)}</strong></span>
                          <span>Margen: <strong className="text-slate-200">{(sq.totals?.margenRealPct || 0).toFixed(1)}%</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleLoadSavedQuote(sq)}
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Abrir / Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicateSavedQuote(sq)}
                          className="h-8 text-xs bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200 gap-1"
                          title="Crear una copia con nuevo número"
                        >
                          <Copy className="h-3.5 w-3.5" /> Duplicar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSavedQuote(sq.quoteNumber)}
                          className="h-8 w-8 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                          title="Eliminar cotización"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="pt-3 border-t border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setIsHistoryOpen(false)} className="bg-slate-950 border-slate-700 text-slate-300">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: CATÁLOGO RÁPIDO DE PRODUCTOS */}
      <Dialog open={isCatalogOpen} onOpenChange={setIsCatalogOpen}>
        <DialogContent className="sm:max-w-[750px] w-[95vw] max-h-[85vh] flex flex-col bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader className="pb-3 border-b border-slate-800">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
              <Package className="h-5 w-5 text-emerald-400" />
              Catálogo de Productos Registrados ({productCatalog.length})
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                placeholder="Buscar pintura, acabado, presentación o código..."
                className="pl-9 bg-slate-950 border-slate-800 text-slate-100 text-xs h-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1 max-h-[380px] pr-2">
            {productCatalog.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No se encontraron productos previos en inventario o proyectos.
              </div>
            ) : (
              <div className="space-y-1.5">
                {productCatalog
                  .filter(p => {
                    if (!catalogSearch.trim()) return true
                    const q = catalogSearch.toLowerCase()
                    return p.description.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
                  })
                  .slice(0, 60)
                  .map((prod, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/40 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] font-mono border-slate-700 text-emerald-400">
                            {prod.code}
                          </Badge>
                          <span className="text-[10px] text-slate-400">{prod.unit}</span>
                          <span className="text-[10px] text-slate-500">• {prod.source}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-100 truncate mt-0.5">{prod.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {prod.suggestedPrice > 0 && (
                          <span className="text-xs font-mono text-emerald-400 font-bold">
                            ${prod.suggestedPrice.toFixed(2)}
                          </span>
                        )}
                        <Button
                          size="sm"
                          onClick={() => {
                            const nextNum = items.length + 1
                            setItems(prev => [
                              ...prev,
                              {
                                id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                code: `Renglón ${nextNum}`,
                                description: prod.description,
                                unit: prod.unit || "Galón",
                                costoLista: prod.suggestedPrice || 0,
                                precioPublico: prod.suggestedPrice > 0 ? Number((prod.suggestedPrice / 0.70).toFixed(2)) : 0,
                                isSpecialQuote: false,
                                divisor: 0.79,
                                quantity: 1,
                              }
                            ])
                            toast({ title: "Producto agregado", description: prod.description })
                          }}
                          className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1"
                        >
                          <Plus className="h-3 w-3" /> Agregar
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="pt-3 border-t border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setIsCatalogOpen(false)} className="bg-slate-950 border-slate-700 text-slate-300">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
