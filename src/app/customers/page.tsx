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
import { Plus, Trash2, Mail, Phone, User } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function CustomersPage() {
  const { entities, addEntity, deleteEntity } = useLedgerStore()
  const [isOpen, setIsOpen] = React.useState(false)
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    phone: ''
  })

  const customers = entities.filter(e => e.type === 'customer')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) return
    addEntity({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      type: 'customer'
    })
    setFormData({ name: '', email: '', phone: '' })
    setIsOpen(false)
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Customer Directory</h3>
            <p className="text-sm text-muted-foreground">Manage institutional clients and individual buyers.</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-accent hover:bg-accent/90">
                <Plus className="h-4 w-4" /> Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="font-headline">Register Customer</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Client Name</Label>
                  <Input 
                    id="name" 
                    value={formData.name} 
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Global Tech Solutions" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Contact</Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={formData.email} 
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="billing@globaltech.com" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input 
                    id="phone" 
                    value={formData.phone} 
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 (555) 999-8888" 
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full bg-accent hover:bg-accent/90">Confirm Client</Button>
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
                  <TableHead>Client</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Registration Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length > 0 ? (
                  customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-accent" />
                          {c.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs">
                          {c.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</div>}
                          {c.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deleteEntity(c.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No customers registered in the directory.
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
