"use client"

import * as React from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { useLedgerStore, InventoryItem } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, PackageSearch, Package, PlusCircle, Check } from "lucide-react"
import { useFirestore } from "@/firebase"
import { useToast } from "@/hooks/use-toast"

export default function InventoryPage() {
  const { 
    inventory, projects, removeFromInventory, updateInventoryQuantity, updateProject, addTransaction 
  } = useLedgerStore()
  const db = useFirestore()
  const { toast } = useToast()
  const [mounted, setMounted] = React.useState(false)

  // Assignment dialog state
  const [assigningItem, setAssigningItem] = React.useState<InventoryItem | null>(null)
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>('')
  const [assignQuantity, setAssignQuantity] = React.useState<number>(1)
  const [addToExpectedProducts, setAddToExpectedProducts] = React.useState<boolean>(true)
  const [chargeAsProjectCost, setChargeAsProjectCost] = React.useState<boolean>(true)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleOpenAssignModal = (item: InventoryItem) => {
    setAssigningItem(item)
    setSelectedProjectId('')
    setAssignQuantity(item.quantity)
    setAddToExpectedProducts(true)
    setChargeAsProjectCost(true)
  }

  const handleConfirmAssign = () => {
    if (!assigningItem || !selectedProjectId) return
    const targetProject = projects.find(p => p.id === selectedProjectId)
    if (!targetProject) return

    const qtyToAssign = assignQuantity
    const lineTotal = qtyToAssign * assigningItem.unitPrice

    // 1. Add to expectedProducts if checked
    if (addToExpectedProducts) {
      const currentExpected = targetProject.expectedProducts || []
      const cleanCode = (assigningItem.code || '').trim().toLowerCase()
      const cleanDesc = (assigningItem.description || '').trim().toLowerCase()

      const existingIndex = currentExpected.findIndex(ep => 
        (cleanCode && cleanCode !== 's/c' && (ep.code || '').trim().toLowerCase() === cleanCode) ||
        ((ep.description || '').trim().toLowerCase() === cleanDesc)
      )

      let updatedExpected = [...currentExpected]
      if (existingIndex >= 0) {
        updatedExpected[existingIndex] = {
          ...updatedExpected[existingIndex],
          quantity: (updatedExpected[existingIndex].quantity || 0) + qtyToAssign
        }
      } else {
        updatedExpected.push({
          code: assigningItem.code || 'S/C',
          description: assigningItem.description,
          quantity: qtyToAssign,
          unitPrice: assigningItem.unitPrice
        })
      }

      updateProject(db, selectedProjectId, { expectedProducts: updatedExpected })
    }

    // 2. Add purchase transaction if checked
    if (chargeAsProjectCost) {
      addTransaction(db, {
        invoiceNumber: assigningItem.sourceInvoice || `ASIG-${Date.now()}`,
        numeroControl: '',
        issueDate: new Date().toISOString(),
        entityId: 'global_inventory',
        entityName: 'Traslado desde Inventario Global',
        projectId: selectedProjectId,
        type: 'purchase',
        documentType: 'internal',
        items: [{
          code: assigningItem.code || 'S/C',
          description: assigningItem.description,
          quantity: qtyToAssign,
          unitPrice: assigningItem.unitPrice,
          lineTotal
        }],
        subtotal: lineTotal,
        taxAmount: 0,
        retentionAmount: 0,
        perceptionAmount: 0,
        totalAmount: lineTotal,
        costBasis: lineTotal,
        gain: 0
      })
    }

    // 3. Update or remove from inventory
    const remainingQty = assigningItem.quantity - qtyToAssign
    updateInventoryQuantity(db, assigningItem.id, remainingQty)

    toast({
      title: "Producto Asignado al Proyecto",
      description: `Se transfirieron ${qtyToAssign} unidad(es) de "${assigningItem.description}" al proyecto "${targetProject.name}".`,
    })

    setAssigningItem(null)
  }

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
            <CardDescription>Estos productos han sido excluidos de los costos de proyectos para evitar desvíos presupuestarios. Puedes asignarlos a cualquier proyecto activo.</CardDescription>
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
                      <TableCell><Badge variant="outline" className="font-mono">{item.code || 'S/C'}</Badge></TableCell>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="font-bold">{item.quantity}</TableCell>
                      <TableCell>${item.unitPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-[10px] font-mono">{item.sourceInvoice}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10 font-bold"
                            onClick={() => handleOpenAssignModal(item)}
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            Asignar a Proyecto
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm(`¿Desea eliminar "${item.description}" del inventario global?`)) {
                                removeFromInventory(db, item.id)
                                toast({ title: "Producto Eliminado", description: "Removido del inventario global." })
                              }
                            }}
                            title="Eliminar de inventario"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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

      {/* Modal de Asignación de Producto a Proyecto */}
      <Dialog open={!!assigningItem} onOpenChange={(open) => !open && setAssigningItem(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <PlusCircle className="h-5 w-5 text-primary" /> Asignar Producto a Proyecto
            </DialogTitle>
            <DialogDescription>
              Transfiere este producto del inventario global al listado de un proyecto ya realizado o en curso.
            </DialogDescription>
          </DialogHeader>

          {assigningItem && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/40 rounded-lg border text-xs space-y-1">
                <div className="font-bold text-foreground text-sm flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">{assigningItem.code || 'S/C'}</Badge>
                  {assigningItem.description}
                </div>
                <div className="flex justify-between text-muted-foreground pt-1">
                  <span>En Custodia: <strong className="text-foreground">{assigningItem.quantity} unidades</strong></span>
                  <span>P. Unitario: <strong className="text-foreground">${assigningItem.unitPrice.toFixed(2)}</strong></span>
                </div>
                <div className="text-[10px] text-muted-foreground italic font-mono truncate">
                  DTE Origen: {assigningItem.sourceInvoice || 'N/A'}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Seleccionar Proyecto Destino</Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="-- Seleccione el proyecto donde se usará --" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        <span className="font-bold">{p.name}</span> ({p.customerName || 'Sin cliente'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Cantidad a Asignar</Label>
                <Input 
                  type="number"
                  min={1}
                  max={assigningItem.quantity}
                  value={assignQuantity}
                  onChange={(e) => setAssignQuantity(Math.min(assigningItem.quantity, Math.max(1, Number(e.target.value))))}
                  className="h-9 text-xs font-bold text-right"
                />
                <p className="text-[10px] text-muted-foreground text-right">
                  Monto total a transferir: <strong>${(assignQuantity * assigningItem.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </p>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Opciones de Asignación</Label>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="cb-oc" 
                    checked={addToExpectedProducts} 
                    onCheckedChange={(c) => setAddToExpectedProducts(!!c)} 
                  />
                  <label htmlFor="cb-oc" className="text-xs font-medium leading-none cursor-pointer">
                    Añadir a la Orden de Compra (Productos Esperados del Proyecto)
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="cb-cost" 
                    checked={chargeAsProjectCost} 
                    onCheckedChange={(c) => setChargeAsProjectCost(!!c)} 
                  />
                  <label htmlFor="cb-cost" className="text-xs font-medium leading-none cursor-pointer">
                    Cargar Costo al Proyecto (Registrar movimiento de compra)
                  </label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAssigningItem(null)}>Cancelar</Button>
            <Button size="sm" className="bg-primary gap-1.5 font-bold" onClick={handleConfirmAssign} disabled={!selectedProjectId || assignQuantity <= 0}>
              <Check className="h-4 w-4" /> Confirmar Asignación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
