import { AppLayout } from "@/components/layout/AppLayout"
import { RemindersView } from "@/components/calendar/RemindersView"

export default function CalendarPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold font-headline text-foreground">Calendario y Recordatorios</h3>
          <p className="text-sm text-muted-foreground">Gestione eventos, notas rápidas y recordatorios diarios vinculados a proyectos.</p>
        </div>
        
        <RemindersView />
      </div>
    </AppLayout>
  )
}
