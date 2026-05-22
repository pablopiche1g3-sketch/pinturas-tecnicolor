
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirigir automáticamente al panel principal ya que el login ha sido desactivado
    router.push("/")
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground animate-pulse">Cargando interfaz...</p>
    </div>
  )
}
