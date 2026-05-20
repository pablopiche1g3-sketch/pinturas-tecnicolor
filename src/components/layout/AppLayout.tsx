
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  Users, 
  Truck, 
  Zap, 
  History, 
  ChevronLeft,
  ChevronRight,
  Palette,
  Package
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ThemeToggle"

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
  const [isCollapsed, setIsCollapsed] = React.useState(false)

  const getPageTitle = (path: string) => {
    switch (path) {
      case "/": return "Panel de Control";
      case "/institutional": return "Gestión Institucional";
      case "/inventory": return "Inventario de Excedentes";
      case "/suppliers": return "Directorio de Proveedores";
      case "/customers": return "Directorio de Clientes";
      case "/ledger": return "Libro de Transacciones";
      default: return "Tecnicolor Institucional";
    }
  }

  return (
    <div className="flex min-h-screen bg-background font-body text-foreground">
      <aside 
        className={cn(
          "relative z-40 flex flex-col border-r bg-card transition-all duration-300 ease-in-out shadow-sm",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <div className="flex h-20 items-center justify-between px-6 border-b">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-200">
                <Palette className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-headline font-bold text-lg tracking-tight text-foreground">Tecnicolor</span>
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Institucional</span>
              </div>
            </div>
          )}
          {isCollapsed && (
             <div className="h-9 w-9 mx-auto rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-200">
                <Palette className="h-5 w-5 text-white" />
             </div>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute -right-4 top-16 h-8 w-8 rounded-full border bg-card shadow-md md:flex hidden hover:bg-accent"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
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
                {!isCollapsed && <span>{item.label}</span>}
              </div>
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b bg-background/80 px-8 backdrop-blur-md">
           <h2 className="font-headline text-2xl font-bold tracking-tight text-foreground">
            {getPageTitle(pathname)}
           </h2>
           <div className="flex items-center gap-4">
              <ThemeToggle />
           </div>
        </header>
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
