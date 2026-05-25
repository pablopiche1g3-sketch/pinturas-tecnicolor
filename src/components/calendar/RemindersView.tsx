"use client"

import * as React from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLedgerStore, type Reminder, type Note } from "@/lib/store"
import { Plus, Trash2, Calendar as CalendarIcon, CheckCircle2, Circle, StickyNote, Bell } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format, isSameDay, startOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { useFirestore } from "@/firebase"

export function RemindersView() {
  const { projects, reminders, notes, addReminder, updateReminder, deleteReminder, addNote, deleteNote } = useLedgerStore()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const [isReminderOpen, setIsReminderOpen] = React.useState(false)
  const [newReminder, setNewReminder] = React.useState({
    projectId: '',
    title: '',
    description: '',
  })
  const [newNoteContent, setNewNoteContent] = React.useState('')

  const selectedDateStr = date ? startOfDay(date).toISOString() : ''
  const selectedReminders = reminders.filter(r => date && isSameDay(new Date(r.date), date))

  const handleAddReminder = () => {
    if (!newReminder.projectId || !newReminder.title || !date) {
      toast({ title: "Datos incompletos", description: "Seleccione un proyecto y escriba un título.", variant: "destructive" })
      return
    }
    
    const project = projects.find(p => p.id === newReminder.projectId)
    
    addReminder(db, {
      projectId: newReminder.projectId,
      projectName: project?.name,
      title: newReminder.title,
      description: newReminder.description,
      date: date.toISOString()
    })
    
    setNewReminder({ projectId: '', title: '', description: '' })
    setIsReminderOpen(false)
    toast({ title: "Recordatorio añadido" })
  }

  const handleToggleReminder = (reminder: Reminder) => {
    updateReminder(db, reminder.id, { isCompleted: !reminder.isCompleted })
  }

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNoteContent.trim()) return
    addNote(db, newNoteContent.trim())
    setNewNoteContent('')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Columna Izquierda: Calendario y Notas */}
      <div className="lg:col-span-4 space-y-6">
        <Card className="border-2">
          <CardContent className="p-4 flex justify-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              locale={es}
              className="rounded-md border-0"
            />
          </CardContent>
        </Card>

        <Card className="border-2 border-amber-200/50 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-500" /> Bloc de Notas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddNote} className="flex gap-2 mb-4">
              <Input 
                value={newNoteContent}
                onChange={e => setNewNoteContent(e.target.value)}
                placeholder="Escribe una nota rápida..." 
                className="bg-background/50 h-8 text-xs"
              />
              <Button type="submit" size="sm" className="h-8 shrink-0 bg-amber-500 hover:bg-amber-600 text-white">
                <Plus className="h-3 w-3" />
              </Button>
            </form>
            <ScrollArea className="h-[200px] pr-2">
              {notes.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center italic py-4">No hay notas guardadas.</p>
              ) : (
                <div className="space-y-2">
                  {notes.map(note => (
                    <div key={note.id} className="group relative bg-background/80 p-3 rounded-lg shadow-sm text-sm border hover:border-amber-300 transition-colors">
                      <p className="pr-6 whitespace-pre-wrap">{note.content}</p>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                        onClick={() => deleteNote(db, note.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <span className="text-[9px] text-muted-foreground block mt-1">
                        {format(new Date(note.createdAt), "dd MMM, HH:mm")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Columna Derecha: Recordatorios del día seleccionado */}
      <div className="lg:col-span-8">
        <Card className="h-full border-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5 text-primary" />
                Recordatorios del día
              </CardTitle>
              <CardDescription>
                {date ? format(date, "EEEE, d 'de' MMMM", { locale: es }) : "Seleccione una fecha"}
              </CardDescription>
            </div>
            <Dialog open={isReminderOpen} onOpenChange={setIsReminderOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2" disabled={!date}>
                  <Plus className="h-4 w-4" /> Nuevo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Añadir Recordatorio</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold">Fecha Seleccionada</label>
                    <div className="p-2 bg-muted rounded text-sm font-medium">
                      {date ? format(date, "dd/MM/yyyy") : ""}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold">Proyecto (Opcional)</label>
                    <Select value={newReminder.projectId} onValueChange={v => setNewReminder({...newReminder, projectId: v})}>
                      <SelectTrigger><SelectValue placeholder="Vincular a un proyecto..." /></SelectTrigger>
                      <SelectContent>
                        {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold">Título</label>
                    <Input 
                      placeholder="Ej. Llamar a proveedor" 
                      value={newReminder.title} 
                      onChange={e => setNewReminder({...newReminder, title: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold">Descripción / Detalles</label>
                    <Textarea 
                      placeholder="Información adicional..." 
                      value={newReminder.description}
                      onChange={e => setNewReminder({...newReminder, description: e.target.value})}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddReminder} className="w-full">Guardar Recordatorio</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {selectedReminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground opacity-50 space-y-4">
                  <CalendarIcon className="h-12 w-12" />
                  <p>No hay recordatorios para este día.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {selectedReminders.map(reminder => (
                    <div key={reminder.id} className={`p-4 flex items-start gap-4 hover:bg-muted/50 transition-colors ${reminder.isCompleted ? 'opacity-60' : ''}`}>
                      <button onClick={() => handleToggleReminder(reminder)} className="mt-1 shrink-0 text-muted-foreground hover:text-primary transition-colors">
                        {reminder.isCompleted ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={`font-semibold text-sm ${reminder.isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {reminder.title}
                          </h4>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-destructive shrink-0 opacity-50 hover:opacity-100"
                            onClick={() => deleteReminder(db, reminder.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {reminder.projectName && (
                          <Badge variant="outline" className="mt-1 text-[10px] bg-primary/5 text-primary border-primary/20">
                            {reminder.projectName}
                          </Badge>
                        )}
                        {reminder.description && (
                          <p className={`mt-2 text-xs ${reminder.isCompleted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                            {reminder.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
