
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { 
  LayoutDashboard, 
  Users, 
  Truck, 
  Zap, 
  History, 
  ChevronLeft, 
  ChevronRight,
  Palette,
  Package,
  Menu,
  LogOut,
  Loader2,
  ShieldCheck,
  User as UserIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { useUser, useAuth, useFirestore } from "@/firebase"
import { signOut } from "firebase/auth"
import { useLedgerStore } from "@/lib/store"

const navItems = [
  { label: "Panel de Control", icon: LayoutDashboard, href: "/" },
  { label: "Institucional", icon: Zap, href: "/institutional", highlight: true },
  { label: "Inventario Global", icon: Package, href: "/inventory" },
  { label: "Proveedores", icon: Truck, href: "/suppliers" },
  { label: "Clientes", icon: Users, href: "/customers" },
  { label: "Libro Mayor", icon: History, href: "/ledger" },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isMobile = useIsMobile()
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
  
  const { user, loading } = useUser()
  const auth = useAuth()
  const db = useFirestore()
  const { initListeners } = useLedgerStore()

  // Sincronización en tiempo real con Firestore
  React.useEffect(() => {
    if (db) {
      const unsub = initListeners(db)
      return () => unsub()
    }
  }, [db, initListeners])

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth)
      router.push("/login")
    }
  }

  // Lógica de administrador (basada en el correo que solicitaste)
  const isAdmin = user?.email === 'pablopiche0399@gmail.com' || !user // En modo sin login, permitimos funciones de admin

  const getPageTitle = (path: string) => {
    switch (path) {
      case "/": return "Panel de Control";
      case "/institutional": return "Gestión Institucional";
      case "/inventory": return "Inventario de Excedentes";
      case "/suppliers": return "Directorio de Proveedores";
      case "/customers": return "Directorio de Clientes";
      case "/ledger": return "Libro de Transacciones";
      case "/login": return "Acceso";
      default: return "Tecnicolor Institucional";
    }
  }

  // No aplicar el layout en la página de login si el usuario decide ir ahí
  if (pathname === "/login") {
    return <>{children}</>
  }

  const NavContent = () => (
    <nav className="flex-1 space-y-1 p-4">
      {navItems.map((item) => (
        <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
          <div
            className={cn(
              "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all cursor-pointer",
              pathname === item.href 
                ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20" 
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
              item.highlight && pathname !== item.href && "bg-accent/50 text-foreground"
            )}
          >
            <item.icon className={cn(
              "h-5 w-5 shrink-0 transition-colors",
              pathname === item.href ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )} />
            {(!isCollapsed || isMobile) && <span>{item.label}</span>}
          </div>
        </Link>
      ))}
    </nav>
  )

  return (
    <div className="flex min-h-screen bg-background font-body text-foreground">
      {!isMobile && (
        <aside 
          className={cn(
            "relative z-40 flex flex-col border-r bg-card transition-all duration-300 ease-in-out shadow-sm h-screen sticky top-0",
            isCollapsed ? "w-20" : "w-64"
          )}
        >
          <div className="flex h-20 items-center justify-between px-6 border-b">
            {!isCollapsed && (
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                  <Palette className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-headline font-bold text-lg tracking-tight text-foreground">Tecnicolor</span>
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Institucional</span>
                </div>
              </div>
            )}
            {isCollapsed && (
              <div className="h-9 w-9 mx-auto rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                  <Palette className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute -right-4 top-16 h-8 w-8 rounded-full border bg-card shadow-md hidden md:flex hover:bg-accent"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
          <NavContent />
          <div className="p-4 border-t mt-auto">
            {isAdmin && !isCollapsed && (
              <div className="px-4 py-2 mb-2 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-bold uppercase text-primary">Modo Gestión Total</span>
              </div>
            )}
            {user ? (
              <Button 
                variant="ghost" 
                className={cn("w-full gap-3 justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10", isCollapsed && "px-2")}
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5" />
                {(!isCollapsed || isMobile) && <span>Cerrar Sesión</span>}
              </Button>
            ) : (
              <Link href="/login">
                <Button 
                  variant="ghost" 
                  className={cn("w-full gap-3 justify-start text-muted-foreground hover:text-primary hover:bg-primary/10", isCollapsed && "px-2")}
                >
                  <UserIcon className="h-5 w-5" />
                  {(!isCollapsed || isMobile) && <span>Iniciar Sesión</span>}
                </Button>
              </Link>
            )}
          </div>
        </aside>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b bg-background/80 px-4 md:px-8 backdrop-blur-md">
          <div className="flex items-center gap-4">
            {isMobile && (
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <div className="h-20 flex items-center gap-3 px-6 border-b">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                      <Palette className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <SheetTitle className="font-headline font-bold text-lg">Tecnicolor</SheetTitle>
                  </div>
                  <NavContent />
                  <div className="p-4 border-t">
                    {user ? (
                      <Button 
                        variant="ghost" 
                        className="w-full gap-3 justify-start text-muted-foreground hover:text-destructive"
                        onClick={handleLogout}
                      >
                        <LogOut className="h-5 w-5" />
                        <span>Cerrar Sesión</span>
                      </Button>
                    ) : (
                      <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button 
                          variant="ghost" 
                          className="w-full gap-3 justify-start text-muted-foreground hover:text-primary"
                        >
                          <UserIcon className="h-5 w-5" />
                          <span>Iniciar Sesión</span>
                        </Button>
                      </Link>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            )}
            <h2 className="font-headline text-lg md:text-2xl font-bold tracking-tight text-foreground truncate max-w-[200px] md:max-w-none">
              {getPageTitle(pathname)}
            </h2>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-foreground truncate max-w-[150px]">
                {user ? user.email : 'Acceso Libre'}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {user ? (user.email === 'pablopiche0399@gmail.com' ? 'Administrador' : 'Editor') : 'Sin Restricciones'}
              </span>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  )
}
