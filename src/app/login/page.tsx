
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth"
import { useAuth } from "@/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Palette, Loader2, Lock, UserPlus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function LoginPage() {
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [mode, setMode] = React.useState<"login" | "register">("login")
  const auth = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth) return
    
    setLoading(true)
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password)
        toast({
          title: "Acceso exitoso",
          description: "Bienvenido al sistema de Tecnicolor.",
        })
      } else {
        await createUserWithEmailAndPassword(auth, email, password)
        toast({
          title: "Cuenta creada",
          description: "Tu usuario ha sido registrado exitosamente.",
        })
      }
      router.push("/")
    } catch (error: any) {
      let message = "Ocurrió un error inesperado."
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        message = "Credenciales inválidas."
      } else if (error.code === 'auth/email-already-in-use') {
        message = "Este correo ya está registrado."
      } else if (error.code === 'auth/weak-password') {
        message = "La contraseña debe tener al menos 6 caracteres."
      }
      
      toast({
        variant: "destructive",
        title: mode === "login" ? "Error de acceso" : "Error de registro",
        description: message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg">
            <Palette className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">Tecnicolor</h1>
          <p className="text-xs font-bold text-primary uppercase tracking-[0.2em]">Gestión Institucional</p>
        </div>

        <Card className="border-none shadow-xl">
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <CardHeader className="space-y-1">
              <div className="flex justify-between items-center">
                <CardTitle className="text-2xl font-bold">
                  {mode === "login" ? "Bienvenido" : "Crear Cuenta"}
                </CardTitle>
                <TabsList className="grid grid-cols-2 w-32">
                  <TabsTrigger value="login">Entrar</TabsTrigger>
                  <TabsTrigger value="register">Nuevo</TabsTrigger>
                </TabsList>
              </div>
              <CardDescription>
                {mode === "login" 
                  ? "Ingrese sus credenciales para acceder al sistema." 
                  : "Regístrese para comenzar a gestionar sus proyectos."}
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleAuth}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="ejemplo@tecnicolor.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full gap-2" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : mode === "login" ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {loading 
                    ? (mode === "login" ? "Iniciando..." : "Registrando...") 
                    : (mode === "login" ? "Acceder al Sistema" : "Crear mi Usuario")}
                </Button>
              </CardFooter>
            </form>
          </Tabs>
        </Card>
        
        <p className="text-center text-xs text-muted-foreground italic">
          &copy; {new Date().getFullYear()} Pinturas Tecnicolor de El Salvador
        </p>
      </div>
    </div>
  )
}
