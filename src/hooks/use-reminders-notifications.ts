"use client"

import { useEffect, useRef } from 'react'
import { useLedgerStore } from '@/lib/store'
import { isSameDay } from 'date-fns'
import { useToast } from '@/hooks/use-toast'

export function useRemindersNotifications() {
  const { reminders } = useLedgerStore()
  const { toast } = useToast()
  
  // Use a ref to keep track of the last time we notified to avoid spamming if reminders change frequently
  const lastNotifiedRef = useRef<number>(0)

  useEffect(() => {
    // Solo en cliente
    if (typeof window === 'undefined') return

    // Solicitar permiso de notificaciones nativas
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const checkAndNotify = () => {
      const now = new Date()
      const hour = now.getHours()
      
      // Entre 8:00 AM (8) y 5:00 PM (17)
      if (hour >= 8 && hour <= 17) {
        const todaysReminders = reminders.filter(
          r => !r.isCompleted && isSameDay(new Date(r.date), now)
        )

        // Evitar notificar si no hay nada o si ya notificamos hace menos de 50 minutos (por si cambia el estado)
        const timeSinceLast = now.getTime() - lastNotifiedRef.current
        if (todaysReminders.length > 0 && timeSinceLast > 50 * 60 * 1000) {
          
          lastNotifiedRef.current = now.getTime()
          const title = `Tienes ${todaysReminders.length} recordatorio(s) para hoy`
          const body = todaysReminders.map(r => r.title).join(', ')

          // Notificación in-app
          toast({
            title: title,
            description: body,
            duration: 10000,
          })

          // Notificación del sistema operativo
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { 
              body, 
              icon: '/favicon.ico',
              tag: 'reminders-notification' 
            })
          }
        }
      }
    }

    // Comprobar al montar el hook (cuando se abre la app)
    // Usamos un timeout corto para asegurarnos de que la UI ya cargó
    const initialTimeout = setTimeout(checkAndNotify, 3000)

    // Comprobar cada 1 hora (3600000 ms)
    const interval = setInterval(checkAndNotify, 60 * 60 * 1000)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [reminders, toast])
}
