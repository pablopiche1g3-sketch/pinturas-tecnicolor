
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth"
import { useAuth } from "@/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Palette, Loader2, Lock, UserPlus, Shield, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export default function LoginPage() {
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [role, setRole] = React.useState("usuario")
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
        // En una implementación real, aquí guardaríamos el rol del usuario en Firestore
        await createUserWithEmailAndPassword(auth, email, password)
        toast({
          title: "Cuenta creada",
          description: `Usuario registrado exitosamente.`,
        })
      }
      router.push("/")
    } catch (error: any) {
      let message = "Ocurrió un error inesperado."
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        message = "Credenciales inválidas. Verifique su correo y contraseña."
      } else if (error.code === 'auth/email-already-in-use') {
        message = "Este correo ya está registrado en el sistema."
      } else if (error.code === 'auth/weak-password') {
        message = "La contraseña es muy débil. Use al menos 6 caracteres."
      } else if (error.code === 'auth/configuration-not-found') {
        message = "Error de configuración. Verifique que Firebase Auth esté habilitado en la consola."
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

        <Card className="border-none shadow-xl overflow-hidden">
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <div className="bg-muted/50 p-1">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                <TabsTrigger value="register">Crear Cuenta</TabsTrigger>
              </TabsList>
            </div>
            
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">
                {mode === "login" ? "Bienvenido" : "Registro de Usuario"}
              </CardTitle>
              <CardDescription>
                {mode === "login" 
                  ? "Ingrese sus credenciales para acceder." 
                  : "Complete los datos para registrarse en el sistema."}
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleAuth}>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="ejemplo@tecnicolor.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                    className="rounded-lg"
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
                    className="rounded-lg"
                  />
                </div>

                {mode === "register" && (
                  <div className="space-y-3 pt-2">
                    <Label className="text-sm font-bold">Tipo de Rol solicitado</Label>
                    <RadioGroup 
                      value={role} 
                      onValueChange={setRole}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div>
                        <RadioGroupItem
                          value="usuario"
                          id="rol-usuario"
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor="rol-usuario"
                          className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                        >
                          <User className="mb-2 h-5 w-5" />
                          <span className="text-xs font-bold uppercase">Usuario</span>
                        </Label>
                      </div>
                      <div>
                        <RadioGroupItem
                          value="admin"
                          id="rol-admin"
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor="rol-admin"
                          className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                        >
                          <Shield className="mb-2 h-5 w-5" />
                          <span className="text-xs font-bold uppercase">Admin</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}
              </CardContent>
              
              <CardFooter>
                <Button type="submit" className="w-full gap-2 h-11 rounded-lg shadow-md" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : mode === "login" ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {loading 
                    ? (mode === "login" ? "Accediendo..." : "Registrando...") 
                    : (mode === "login" ? "Acceder al Sistema" : "Registrar Usuario")}
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
