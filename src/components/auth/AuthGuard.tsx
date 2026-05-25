"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useUser } from "@/firebase/auth/use-user"
import { useRemindersNotifications } from "@/hooks/use-reminders-notifications"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()
  const router = useRouter()
  const pathname = usePathname()
  
  // Inicializar notificaciones globales solo si hay usuario logueado
  if (user) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useRemindersNotifications()
  }

  useEffect(() => {
    if (!loading && !user && pathname !== "/login") {
      router.push("/login")
    }
  }, [user, loading, pathname, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">Cargando...</p>
      </div>
    )
  }

  // Si no está cargando, no hay usuario y no estamos en login, 
  // se renderizará null brevemente antes del redirect
  if (!user && pathname !== "/login") {
    return null
  }

  return <>{children}</>
}
