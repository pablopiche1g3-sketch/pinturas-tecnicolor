
"use client"

import * as React from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { useLedgerStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Plus, Trash2, Mail, Phone, Truck, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useFirestore } from "@/firebase"

export default function SuppliersPage() {
  const { entities, addEntity, deleteEntity } = useLedgerStore()
  const db = useFirestore()
  const [isOpen, setIsOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    phone: ''
  })

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const suppliers = entities.filter(e => e.type === 'supplier')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) return
    addEntity(db, {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      type: 'supplier'
    })
    setFormData({ name: '', email: '', phone: '' })
    setIsOpen(false)
  }

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
            <h3 className="text-lg font-medium">Proveedores Institucionales</h3>
            <p className="text-sm text-muted-foreground">Administre y registre las entidades que proporcionan bienes o servicios.</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Añadir Proveedor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="font-headline">Registrar Proveedor</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Proveedor</Label>
                  <Input 
                    id="name" 
                    value={formData.name} 
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="ej. Acme Corp" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo de Contacto</Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={formData.email} 
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="contacto@acme.com" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Número de Teléfono</Label>
                  <Input 
                    id="phone" 
                    value={formData.phone} 
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 (555) 000-0000" 
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full">Guardar Entidad</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Información de Contacto</TableHead>
                  <TableHead>Fecha de Registro</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.length > 0 ? (
                  suppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-primary" />
                          {s.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs">
                          {s.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" /> {s.email}</div>}
                          {s.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {s.phone}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deleteEntity(db, s.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No hay proveedores registrados todavía.
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
