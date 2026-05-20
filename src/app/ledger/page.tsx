"use client"

import * as React from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { useLedgerStore } from "@/lib/store"
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
import { Trash2, TrendingUp, TrendingDown, ArrowRightLeft, FileText, Loader2, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export default function LedgerPage() {
  const { transactions, deleteTransaction } = useLedgerStore()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Historial de Transacciones</h3>
            <p className="text-sm text-muted-foreground">Registro completo de todos los flujos institucionales y actividad de ventas.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Tipo/Estado</TableHead>
                  <TableHead>Factura #</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Ganancia/Costo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length > 0 ? (
                  [...transactions].reverse().map((t) => (
                    <TableRow key={t.id} className={cn("group", t.isVoided && "bg-muted/30 grayscale opacity-60")}>
                      <TableCell>
                        {t.isVoided ? (
                          <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 bg-muted/50 gap-1">
                            <XCircle className="h-3 w-3" /> Anulada
                          </Badge>
                        ) : t.type === 'purchase' ? (
                          <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5 gap-1">
                            <TrendingDown className="h-3 w-3" /> Compra
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 gap-1">
                            <TrendingUp className="h-3 w-3" /> Venta
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{t.invoiceNumber}</TableCell>
                      <TableCell className="font-medium">{t.entityName}</TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(t.issueDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm">
                        <span className={t.isVoided ? 'line-through' : ''}>
                          ${t.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                         <div className="flex flex-col items-end gap-1">
                            <span className={cn(
                              t.type === 'sale' && !t.isVoided ? 'text-primary font-bold' : 'text-muted-foreground text-xs',
                              t.isVoided && 'line-through'
                            )}>
                              {t.type === 'sale' ? `+$${t.gain.toFixed(2)}` : `Costo: $${t.costBasis.toFixed(2)}`}
                            </span>
                            {t.type === 'sale' && !t.isVoided && (
                              <span className="text-[10px] text-muted-foreground">
                                ({((t.gain / t.totalAmount) * 100).toFixed(1)}% Margen)
                              </span>
                            )}
                            {t.isVoided && (
                              <span className="text-[9px] text-destructive uppercase font-bold max-w-[100px] truncate" title={t.voidReason}>
                                Razón: {t.voidReason}
                              </span>
                            )}
                         </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 transition-opacity"
                          onClick={() => deleteTransaction(t.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ArrowRightLeft className="h-8 w-8 opacity-20" />
                        <span>No se han registrado transacciones en el libro todavía.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
