
"use client"

import * as React from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { useLedgerStore } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2, PackageSearch, Package } from "lucide-react"
import { useFirestore } from "@/firebase"

export default function InventoryPage() {
  const { inventory, removeFromInventory } = useLedgerStore()
  const db = useFirestore()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold font-headline">Inventario Global (Excedentes)</h3>
          <p className="text-sm text-muted-foreground">Productos comprados que no pertenecían a la Orden de Compra del proyecto seleccionado.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PackageSearch className="h-5 w-5 text-accent" /> Custodia de Productos</CardTitle>
            <CardDescription>Estos productos han sido excluidos de los costos de proyectos para evitar desvíos presupuestarios.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Cant.</TableHead>
                  <TableHead>P. Unitario</TableHead>
                  <TableHead>DTE Origen</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.length > 0 ? (
                  inventory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(item.dateAdded).toLocaleDateString()}
                      </TableCell>
                      <TableCell><Badge variant="outline">{item.code}</Badge></TableCell>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="font-bold">{item.quantity}</TableCell>
                      <TableCell>${item.unitPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-[10px] font-mono">{item.sourceInvoice}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive"
                          onClick={() => removeFromInventory(db, item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-8 w-8 opacity-20" />
                        No hay productos en inventario global.
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
