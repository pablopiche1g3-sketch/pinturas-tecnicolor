
"use client"

import * as React from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { useLedgerStore, type Transaction, type Project } from "@/lib/store"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  FileSpreadsheet, 
  Loader2, 
  XCircle, 
  Briefcase, 
  ArrowRightLeft,
  Receipt
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useToast } from "@/hooks/use-toast"
import { useFirestore } from "@/firebase"

export default function LedgerPage() {
  const { transactions, projects, deleteTransaction } = useLedgerStore()
  const db = useFirestore()
  const [mounted, setMounted] = React.useState(false)
  const { toast } = useToast()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const getDocTypeBadge = (type: string) => {
    switch(type) {
      case '01': return 'FAC';
      case '03': return 'CCF';
      case '07': return 'NC';
      default: return 'DTE';
    }
  }

  const exportToCSV = (txs: Transaction[], filename: string) => {
    if (txs.length === 0) {
      toast({ title: "Sin datos", description: "No hay transacciones para exportar.", variant: "destructive" })
      return
    }

    const headers = ["Fecha", "Proyecto", "Tipo Movimiento", "Tipo DTE", "No. Generación", "No. Control", "Entidad", "Subtotal", "IVA (13%)", "Total", "Utilidad/Costo", "Estado"];
    
    const rows = txs.map(t => {
      const projectName = projects.find(p => p.id === t.projectId)?.name || "Venta General";
      return [
        new Date(t.issueDate).toLocaleDateString(),
        `"${projectName}"`,
        t.type === 'purchase' ? 'Compra' : 'Venta',
        getDocTypeBadge(t.documentType),
        t.invoiceNumber,
        t.numeroControl || "N/A",
        `"${t.entityName}"`,
        t.subtotal.toFixed(2).replace('.', ','),
        t.taxAmount.toFixed(2).replace('.', ','),
        t.totalAmount.toFixed(2).replace('.', ','),
        (t.type === 'sale' ? t.gain.toFixed(2) : t.costBasis.toFixed(2)).replace('.', ','),
        t.isVoided ? `Anulada (${t.voidReason})` : 'Válida'
      ].join(";");
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Exportación exitosa", description: "El archivo se ha descargado correctamente." })
  }

  const groupedData = projects.map(project => {
    const projectTransactions = transactions.filter(t => t.projectId === project.id)
    const validTransactions = projectTransactions.filter(t => !t.isVoided)
    
    const totalPurchases = validTransactions.filter(t => t.type === 'purchase').reduce((acc, t) => acc + t.totalAmount, 0)
    const totalSales = validTransactions.filter(t => t.type === 'sale').reduce((acc, t) => acc + t.totalAmount, 0)
    const totalGain = validTransactions.filter(t => t.type === 'sale').reduce((acc, t) => acc + t.gain, 0)

    return {
      project,
      transactions: projectTransactions,
      stats: {
        totalPurchases,
        totalSales,
        totalGain,
        deviation: totalSales - project.targetSaleAmount
      }
    }
  })

  const orphanTransactions = transactions.filter(t => !t.projectId)

  const renderTransactionTable = (txs: Transaction[]) => (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead className="w-[120px]">Tipo/Estado</TableHead>
          <TableHead>Identificación DTE</TableHead>
          <TableHead>Entidad</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead className="text-right">Monto Total</TableHead>
          <TableHead className="text-right">Utilidad/Costo</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {txs.length > 0 ? (
          [...txs].reverse().map((t) => (
            <TableRow key={t.id} className={cn("group", t.isVoided && "bg-muted/30 grayscale opacity-60")}>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {t.isVoided ? (
                    <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 bg-muted/50 gap-1 text-[9px]">
                      <XCircle className="h-2 w-2" /> Anulada
                    </Badge>
                  ) : t.type === 'purchase' ? (
                    <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5 gap-1 text-[9px]">
                      <TrendingDown className="h-2 w-2" /> Compra
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 gap-1 text-[9px]">
                      <TrendingUp className="h-2 w-2" /> Venta
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[8px] h-4 w-fit bg-muted">{getDocTypeBadge(t.documentType)}</Badge>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5 max-w-[200px]">
                  <span className="font-mono text-[9px] font-bold text-foreground truncate" title={t.invoiceNumber}>
                    Gen: {t.invoiceNumber}
                  </span>
                  {t.numeroControl && (
                    <span className="font-mono text-[8px] text-muted-foreground truncate" title={t.numeroControl}>
                      Ctrl: {t.numeroControl}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-medium text-xs">{t.entityName}</TableCell>
              <TableCell className="text-muted-foreground text-[10px] whitespace-nowrap">
                {new Date(t.issueDate).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right font-bold text-xs">
                <span className={t.isVoided ? 'line-through' : ''}>
                  ${t.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </TableCell>
              <TableCell className="text-right">
                 <div className="flex flex-col items-end gap-0.5">
                    <span className={cn(
                      t.type === 'sale' && !t.isVoided ? 'text-primary font-bold text-xs' : 'text-muted-foreground text-[10px]',
                      t.isVoided && 'line-through'
                    )}>
                      {t.type === 'sale' ? `+$${t.gain.toFixed(2)}` : `Costo: $${t.costBasis.toFixed(2)}`}
                    </span>
                    {t.isVoided && (
                      <div className="flex flex-col items-end">
                         <span className="text-[8px] text-destructive uppercase font-bold max-w-[120px] truncate">Motivo: {t.voidReason}</span>
                         {t.relatedDocumentNumber && <span className="text-[8px] text-muted-foreground font-mono">Modif: {t.relatedDocumentNumber}</span>}
                      </div>
                    )}
                 </div>
              </TableCell>
              <TableCell className="text-right">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (confirm("¿Eliminar este registro permanentemente?")) {
                      deleteTransaction(db, t.id)
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={7} className="h-20 text-center text-muted-foreground italic text-xs">
              No hay movimientos registrados para este grupo.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )

  if (!mounted) return (
    <AppLayout>
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold font-headline tracking-tight text-foreground">Libro Mayor Consolidado</h3>
            <p className="text-sm text-muted-foreground">Control financiero detallado por proyectos (FAC, CCF, NC).</p>
          </div>
          <Button 
            variant="outline" 
            className="gap-2 bg-card shadow-sm w-full sm:w-auto"
            onClick={() => exportToCSV(transactions, "Libro_Mayor_Completo")}
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" /> Exportar Libro Completo
          </Button>
        </div>

        <div className="space-y-4">
          <Accordion type="multiple" className="space-y-4">
            {groupedData.map(({ project, transactions: txs, stats }) => (
              <AccordionItem 
                key={project.id} 
                value={project.id}
                className="border rounded-xl bg-card shadow-sm overflow-hidden"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted transition-all">
                  <div className="flex flex-1 items-center justify-between text-left pr-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Briefcase className="h-5 w-5 text-primary" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-foreground">{project.name}</h4>
                          <Badge variant="outline" className="font-mono text-[10px] bg-background">{project.purchaseOrder}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{project.customerName}</p>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-[10px] uppercase text-muted-foreground font-bold leading-none mb-1">Costos Reales</p>
                        <p className="text-sm font-bold text-destructive">${stats.totalPurchases.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase text-muted-foreground font-bold leading-none mb-1">Venta Real</p>
                        <p className="text-sm font-bold text-primary">${stats.totalSales.toLocaleString()}</p>
                      </div>
                      <div className="text-right border-l pl-8">
                        <p className="text-[10px] uppercase text-muted-foreground font-bold leading-none mb-1">Utilidad Neta</p>
                        <p className="text-sm font-black text-primary">
                          ${stats.totalGain.toLocaleString()}
                          <span className="text-xs text-muted-foreground font-normal ml-1">
                            ({stats.totalSales > 0 ? ((stats.totalGain / stats.totalSales) * 100).toFixed(1) : 0}%)
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="border-t">
                  <div className="p-0">
                    <div className="bg-muted/30 p-4 border-b flex items-center justify-between">
                       <div className="flex gap-4">
                          <div className="flex flex-col">
                             <span className="text-[10px] uppercase text-muted-foreground font-bold">Objetivo OC</span>
                             <span className="text-sm font-medium text-foreground">${project.targetSaleAmount.toLocaleString()}</span>
                          </div>
                          <div className="flex flex-col">
                             <span className="text-[10px] uppercase text-muted-foreground font-bold">Desviación</span>
                             <span className={cn(
                               "text-sm font-bold",
                               Math.abs(stats.deviation) < 1 ? "text-green-600" : "text-orange-600"
                             )}>
                                ${stats.deviation.toFixed(2)}
                             </span>
                          </div>
                       </div>
                       <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 text-xs gap-2"
                        onClick={() => exportToCSV(txs, `Proyecto_${project.name.replace(/\s+/g, '_')}`)}
                       >
                          <FileSpreadsheet className="h-3 w-3" /> Exportar Proyecto (CSV)
                       </Button>
                    </div>
                    {renderTransactionTable(txs)}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}

            {orphanTransactions.length > 0 && (
              <AccordionItem value="orphans" className="border rounded-xl bg-card shadow-sm overflow-hidden">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted">
                  <div className="flex flex-1 items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">Ventas Generales / Sin Proyecto</h4>
                      <p className="text-xs text-muted-foreground">Transacciones manuales o ventas de mostrador.</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="border-t">
                  <div className="bg-muted/30 p-4 border-b flex justify-end">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 text-xs gap-2"
                      onClick={() => exportToCSV(orphanTransactions, "Ventas_Generales")}
                    >
                      <FileSpreadsheet className="h-3 w-3" /> Exportar Ventas (CSV)
                    </Button>
                  </div>
                  {renderTransactionTable(orphanTransactions)}
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>

          {transactions.length === 0 && (
            <Card className="border-dashed py-20 bg-transparent shadow-none">
              <CardContent className="flex flex-col items-center justify-center text-muted-foreground gap-3">
                 <Receipt className="h-12 w-12 opacity-20" />
                 <p className="italic text-sm">No hay registros financieros en el sistema.</p>
                 <Button variant="outline" size="sm" asChild>
                    <a href="/institutional">Ir a Módulo Institucional</a>
                 </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
