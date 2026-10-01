"use client"

import * as React from "react"
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
  CheckCircle2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export interface QuotationItem {
  id: string
  description: string
  costoLista: number       // Costo Lista con IVA
  precioPublico: number    // Precio de venta al público
  isSpecialQuote: boolean  // Cotización especial con fábrica (12% desc)
  divisor: number          // Divisor seleccionado para cálculo del precio
  quantity: number         // Cantidad de unidades
}

const DIVISORES_NORMALES = [
  { value: 0.79, label: "÷ 0.79 (21% Margen Bruto) [Default]", margin: "21%" },
  { value: 0.78, label: "÷ 0.78 (22% Margen Bruto)", margin: "22%" },
]

const DIVISORES_ESPECIALES = [
  { value: 0.90, label: "÷ 0.90 (10% Margen)", margin: "10%" },
  { value: 0.85, label: "÷ 0.85 (15% Margen) [Default]", margin: "15%" },
  { value: 0.80, label: "÷ 0.80 (20% Margen)", margin: "20%" },
  { value: 0.75, label: "÷ 0.75 (25% Margen)", margin: "25%" },
  { value: 0.70, label: "÷ 0.70 (30% Margen)", margin: "30%" },
]

export default function QuotationsPage() {
  const { toast } = useToast()

  // Encabezado de la cotización
  const [institution, setInstitution] = React.useState("MINISTERIO DE SALUD / HOSPITAL NACIONAL")
  const [contactName, setContactName] = React.useState("Lic. Roberto Morales (Adquisiciones)")
  const [quoteNumber, setQuoteNumber] = React.useState(`COT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`)
  const [quoteDate, setQuoteDate] = React.useState(new Date().toISOString().split("T")[0])
  const [validityDays, setValidityDays] = React.useState("30 días calendario")

  // Lista de productos en la cotización
  const [items, setItems] = React.useState<QuotationItem[]>([
    {
      id: "item-1",
      description: "PINTURA LATEX ARQUITECTONICA BLANCO MATE (CUBETA 5 GL)",
      costoLista: 129.50,
      precioPublico: 185.00,
      isSpecialQuote: false,
      divisor: 0.79,
      quantity: 10
    },
    {
      id: "item-2",
      description: "PINTURA EPÓXICA ALTO RENDIMIENTO GRIS PERLA (KIT 2 GL)",
      costoLista: 129.50,
      precioPublico: 185.00,
      isSpecialQuote: true,
      divisor: 0.85,
      quantity: 25
    }
  ])

  // Cálculos específicos para cada ítem
  const calculateItem = (item: QuotationItem) => {
    // 1. Análisis de Margen Público
    const factorCosto = item.precioPublico > 0 ? (item.costoLista / item.precioPublico) : 0
    const margenPublico = item.precioPublico > 0 ? ((1 - factorCosto) * 100) : 0

    // 2 y 3. Escenarios de Costo Real y Precio de Venta
    let costoReal = item.costoLista
    if (item.isSpecialQuote) {
      // 12% Descuento de fábrica directo sobre el costo lista
      costoReal = item.costoLista * 0.88
    }

    // Precio Unitario Final
    const precioUnitarioFinal = item.divisor > 0 ? (costoReal / item.divisor) : 0
    const subtotal = precioUnitarioFinal * item.quantity
    const costoTotalItem = costoReal * item.quantity
    const utilidadItem = subtotal - costoTotalItem

    return {
      factorCosto,
      margenPublico,
      costoReal,
      precioUnitarioFinal,
      subtotal,
      costoTotalItem,
      utilidadItem
    }
  }

  // Cálculos globales
  const calculatedItems = React.useMemo(() => {
    return items.map(item => ({
      item,
      calcs: calculateItem(item)
    }))
  }, [items])

  const totals = React.useMemo(() => {
    const totalCotizado = calculatedItems.reduce((acc, curr) => acc + curr.calcs.subtotal, 0)
    const costoTotal = calculatedItems.reduce((acc, curr) => acc + curr.calcs.costoTotalItem, 0)
    const utilidadBruta = totalCotizado - costoTotal
    const margenRealPct = totalCotizado > 0 ? (utilidadBruta / totalCotizado) * 100 : 0

    return {
      totalCotizado,
      costoTotal,
      utilidadBruta,
      margenRealPct
    }
  }, [calculatedItems])

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
    const newItem: QuotationItem = {
      id: `item-${Date.now()}`,
      description: "",
      costoLista: 0,
      precioPublico: 0,
      isSpecialQuote: false,
      divisor: 0.79,
      quantity: 1
    }
    setItems(prev => [...prev, newItem])
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

  // Reiniciar cotización
  const resetQuote = () => {
    if (confirm("¿Desea reiniciar la cotización? Se limpiarán los datos actuales.")) {
      setInstitution("")
      setContactName("")
      setQuoteNumber(`COT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`)
      setItems([
        {
          id: `item-${Date.now()}`,
          description: "",
          costoLista: 0,
          precioPublico: 0,
          isSpecialQuote: false,
          divisor: 0.79,
          quantity: 1
        }
      ])
      toast({ title: "Cotización Reiniciada" })
    }
  }

  // Guardar cotización en almacenamiento local
  const saveQuote = () => {
    if (!institution.trim()) {
      toast({
        title: "Falta institución o cliente",
        description: "Por favor indique el nombre de la institución o cliente antes de guardar.",
        variant: "destructive"
      })
      return
    }

    try {
      const quoteData = {
        quoteNumber,
        institution,
        contactName,
        quoteDate,
        validityDays,
        items,
        totals,
        savedAt: new Date().toISOString()
      }
      localStorage.setItem(`quote_${quoteNumber}`, JSON.stringify(quoteData))
      toast({
        title: "Cotización Guardada",
        description: `La cotización ${quoteNumber} se guardó con éxito en el sistema local.`
      })
    } catch (e) {
      toast({
        title: "Error al guardar",
        description: "No se pudo guardar la cotización.",
        variant: "destructive"
      })
    }
  }

  // Imprimir / Exportar a PDF
  const printQuote = () => {
    window.print()
  }

  return (
    <AppLayout>
      <div className="space-y-6 text-slate-100 max-w-full pb-16">
        
        {/* ENCABEZADO PRINCIPAL DE LA PÁGINA */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 print:hidden">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Calculator className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black font-headline tracking-tight text-white flex items-center gap-2">
                  Cotizador Institucional de Pinturas
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono">
                    Margen y Precios
                  </Badge>
                </h2>
                <p className="text-xs text-slate-400">
                  Cálculo automático de precios de venta institucional con descuentos de fábrica y análisis de margen.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
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
              onClick={saveQuote}
              className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200 gap-1.5 text-xs"
            >
              <Save className="h-3.5 w-3.5 text-blue-400" /> Guardar
            </Button>
            <Button
              size="sm"
              onClick={printQuote}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 text-xs shadow-lg shadow-emerald-950"
            >
              <Printer className="h-3.5 w-3.5" /> Imprimir / PDF
            </Button>
          </div>
        </div>

        {/* ENCABEZADO IMPRESO (SOLO VISIBLE AL IMPRIMIR) */}
        <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wide">PINTURAS TECNICOLOR</h1>
              <p className="text-xs text-slate-600">División Institucional y Proyectos Especiales</p>
              <p className="text-xs text-slate-600">San Salvador, El Salvador • Tel: (503) 2200-0000</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-slate-900 text-white font-bold text-sm rounded">
                COTIZACIÓN FORMAL
              </span>
              <p className="text-sm font-black text-slate-900 mt-2 font-mono">{quoteNumber}</p>
              <p className="text-xs text-slate-600">Fecha: {new Date(quoteDate).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* DATOS DEL CLIENTE / INSTITUCIÓN */}
        <Card className="bg-slate-900 border-slate-800 shadow-xl print:border-none print:shadow-none print:bg-transparent">
          <CardHeader className="p-4 pb-2 border-b border-slate-800/60 print:p-0 print:border-none">
            <CardTitle className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-400 print:hidden" />
              Datos del Cliente e Institución
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 print:p-0 print:pt-3 print:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-slate-500 print:hidden" />
                Institución / Cliente
              </Label>
              <Input
                value={institution}
                onChange={e => setInstitution(e.target.value)}
                placeholder="Ej. Ministerio de Obras Públicas / Hospital El Salvador"
                className="bg-slate-950 border-slate-700 text-white text-xs h-9 focus-visible:ring-emerald-500 font-medium print:bg-transparent print:border-b print:border-slate-300 print:text-black print:px-0"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                <User className="h-3 w-3 text-slate-500 print:hidden" />
                Nombre de Contacto / Atención
              </Label>
              <Input
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                placeholder="Ej. Ing. Juan Pérez"
                className="bg-slate-950 border-slate-700 text-white text-xs h-9 focus-visible:ring-emerald-500 font-medium print:bg-transparent print:border-b print:border-slate-300 print:text-black print:px-0"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-slate-500 print:hidden" />
                Validez de Oferta
              </Label>
              <Input
                value={validityDays}
                onChange={e => setValidityDays(e.target.value)}
                placeholder="Ej. 30 días calendario"
                className="bg-slate-950 border-slate-700 text-white text-xs h-9 focus-visible:ring-emerald-500 font-medium print:bg-transparent print:border-b print:border-slate-300 print:text-black print:px-0"
              />
            </div>
          </CardContent>
        </Card>

        {/* TABLA DINÁMICA DE COTIZACIÓN */}
        <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden print:border-none print:shadow-none print:bg-transparent">
          <CardHeader className="p-4 pb-3 border-b border-slate-800 flex flex-row items-center justify-between print:hidden">
            <div>
              <CardTitle className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                Detalle de Productos a Cotizar
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Ajuste costos, toggles de cotización especial y divisores de margen por cada línea de producto.
              </CardDescription>
            </div>
            <Button
              onClick={addItem}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1 text-xs shadow-md shadow-emerald-950"
            >
              <Plus className="h-3.5 w-3.5" /> Añadir Producto
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="text-xs print:text-slate-900">
                <TableHeader className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider print:bg-slate-100 print:border-slate-300">
                  <TableRow className="border-slate-800 hover:bg-transparent print:border-slate-300">
                    <TableHead className="w-[40px] text-center text-slate-400 print:text-slate-900">#</TableHead>
                    <TableHead className="min-w-[240px] text-slate-300 font-bold print:text-slate-900">Descripción del Producto</TableHead>
                    <TableHead className="w-[120px] text-right text-slate-300 font-bold print:hidden">Costo Lista (c/IVA)</TableHead>
                    <TableHead className="w-[110px] text-right text-slate-300 font-bold print:hidden">Precio Público</TableHead>
                    <TableHead className="w-[105px] text-center text-slate-300 font-bold print:hidden">Margen Púb.</TableHead>
                    <TableHead className="w-[120px] text-center text-slate-300 font-bold print:hidden">¿Cot. Especial?</TableHead>
                    <TableHead className="w-[160px] text-center text-slate-300 font-bold print:hidden">Divisor (÷)</TableHead>
                    <TableHead className="w-[115px] text-right text-emerald-400 font-black print:text-slate-900">P. Unitario ($)</TableHead>
                    <TableHead className="w-[85px] text-right text-slate-300 font-bold print:text-slate-900">Cantidad</TableHead>
                    <TableHead className="w-[120px] text-right text-emerald-400 font-black print:text-slate-900">Subtotal ($)</TableHead>
                    <TableHead className="w-[50px] text-center text-slate-400 print:hidden"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-800/60 print:divide-slate-200">
                  {calculatedItems.map(({ item, calcs }, index) => {
                    const divisorOptions = item.isSpecialQuote ? DIVISORES_ESPECIALES : DIVISORES_NORMALES

                    return (
                      <TableRow 
                        key={item.id} 
                        className="hover:bg-slate-800/40 transition-colors border-slate-800/70 print:border-slate-200"
                      >
                        {/* 1. NÚMERO */}
                        <TableCell className="text-center font-mono text-slate-500 font-bold text-[10px] print:text-slate-600">
                          {index + 1}
                        </TableCell>

                        {/* 2. DESCRIPCIÓN */}
                        <TableCell className="p-2">
                          <Input
                            value={item.description}
                            onChange={e => updateItem(item.id, { description: e.target.value })}
                            placeholder="Descripción del producto..."
                            className="bg-slate-950/70 border-slate-800 text-slate-100 text-xs h-8 focus-visible:ring-emerald-500 font-medium print:bg-transparent print:border-none print:text-slate-900 print:font-bold print:p-0"
                          />
                          {item.isSpecialQuote && (
                            <div className="flex items-center gap-1.5 mt-1 print:hidden">
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] font-mono py-0 px-1.5">
                                Costo Fábrica: ${calcs.costoReal.toFixed(2)} (-12%)
                              </Badge>
                            </div>
                          )}
                        </TableCell>

                        {/* 3. COSTO LISTA CON IVA */}
                        <TableCell className="p-2 text-right font-mono print:hidden">
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

                        {/* 4. PRECIO PÚBLICO */}
                        <TableCell className="p-2 text-right font-mono print:hidden">
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

                        {/* 5. MARGEN PÚBLICO (%) INFORMATIVO */}
                        <TableCell className="p-2 text-center print:hidden">
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

                        {/* 6. TOGGLE ¿COTIZACIÓN ESPECIAL? */}
                        <TableCell className="p-2 text-center print:hidden">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className="flex items-center gap-1.5">
                              <Switch
                                checked={item.isSpecialQuote}
                                onCheckedChange={(checked) => updateItem(item.id, { isSpecialQuote: checked })}
                                className="data-[state=checked]:bg-emerald-500 scale-90"
                              />
                              <span className={`text-[10px] font-bold ${item.isSpecialQuote ? "text-emerald-400" : "text-slate-500"}`}>
                                {item.isSpecialQuote ? "SÍ (-12%)" : "NO"}
                              </span>
                            </div>
                            <span className="text-[8px] text-slate-500">
                              {item.isSpecialQuote ? "Especial Fábrica" : "Normal"}
                            </span>
                          </div>
                        </TableCell>

                        {/* 7. SELECTOR DIVISOR (÷) */}
                        <TableCell className="p-2 print:hidden">
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

                        {/* 8. PRECIO UNITARIO FINAL */}
                        <TableCell className="p-2 text-right font-mono font-black text-emerald-400 text-xs print:text-slate-900">
                          ${calcs.precioUnitarioFinal.toFixed(2)}
                        </TableCell>

                        {/* 9. CANTIDAD */}
                        <TableCell className="p-2 text-right">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity || ""}
                            onChange={e => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value)) })}
                            className="bg-slate-950/70 border-slate-800 text-white text-xs h-8 text-right font-mono font-bold focus-visible:ring-emerald-500 print:bg-transparent print:border-none print:text-slate-900 print:p-0"
                          />
                        </TableCell>

                        {/* 10. SUBTOTAL */}
                        <TableCell className="p-2 text-right font-mono font-black text-emerald-400 text-xs print:text-slate-900">
                          ${calcs.subtotal.toFixed(2)}
                        </TableCell>

                        {/* 11. ACCIÓN: ELIMINAR */}
                        <TableCell className="p-2 text-center print:hidden">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            onClick={() => removeItem(item.id)}
                            title="Eliminar producto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* BOTÓN INFERIOR AÑADIR PRODUCTO */}
            <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 flex justify-between items-center print:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={addItem}
                className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 font-bold gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> + Añadir Producto
              </Button>
              <span className="text-[11px] text-slate-500 font-mono">
                {items.length} {items.length === 1 ? "ítem registrado" : "ítems registrados"}
              </span>
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
                Monto facturable total con IVA incluido
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
                Costo directo de compra (aplicando -12% en esp.)
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
                Ganancia neta esperada en dólares
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
                Rentabilidad total sobre la venta
              </p>
            </CardContent>
          </Card>
        </div>

        {/* RESUMEN PARA IMPRESIÓN (SOLO VISIBLE AL IMPRIMIR) */}
        <div className="hidden print:block mt-8 pt-4 border-t-2 border-slate-900">
          <div className="flex justify-between items-start">
            <div className="w-1/2 space-y-2 text-xs text-slate-700">
              <p><strong>Condiciones Comerciales:</strong></p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Precios incluyen Impuesto a la Transferencia de Bienes Muebles y a la Prestación de Servicios (IVA 13%).</li>
                <li>Validez de la oferta: {validityDays}.</li>
                <li>Tiempo de entrega: Inmediato / sujeto a disponibilidad de stock.</li>
                <li>Forma de pago: Según acuerdo institucional o crédito comercial aprobado.</li>
              </ul>
            </div>

            <div className="w-1/3 bg-slate-50 p-4 border border-slate-300 rounded text-right space-y-2 font-mono">
              <div className="flex justify-between text-xs text-slate-700">
                <span>Subtotal (sin IVA):</span>
                <span>${(totals.totalCotizado / 1.13).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-700">
                <span>IVA (13%):</span>
                <span>${(totals.totalCotizado - (totals.totalCotizado / 1.13)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-400 pt-2">
                <span>TOTAL COTIZADO:</span>
                <span>${totals.totalCotizado.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mt-16 text-center text-xs text-slate-800">
            <div className="border-t border-slate-800 pt-2">
              <p className="font-bold">Firma Autorizada y Sello</p>
              <p className="text-[10px] text-slate-600">Pinturas Tecnicolor - Ventas Institucionales</p>
            </div>
            <div className="border-t border-slate-800 pt-2">
              <p className="font-bold">Aceptación del Cliente</p>
              <p className="text-[10px] text-slate-600">Nombre, Firma y Sello de Recepción</p>
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  )
}
