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
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const navItems = [
  { label: "Panel de Control", icon: LayoutDashboard, href: "/" },
  { label: "Institucional", icon: Zap, href: "/institutional", highlight: true },
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
      case "/suppliers": return "Directorio de Proveedores";
      case "/customers": return "Directorio de Clientes";
      case "/ledger": return "Libro de Transacciones";
      default: return "Vantage Ledger";
    }
  }

  return (
    <div className="flex min-h-screen bg-background font-body">
      {/* Sidebar */}
      <aside 
        className={cn(
          "relative z-40 flex flex-col border-r bg-card transition-all duration-300 ease-in-out",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <div className="flex h-20 items-center justify-between px-6 border-b">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="font-headline font-bold text-white text-lg">V</span>
              </div>
              <span className="font-headline font-bold text-xl tracking-tight">Vantage</span>
            </div>
          )}
          {isCollapsed && (
             <div className="h-8 w-8 mx-auto rounded-lg bg-primary flex items-center justify-center">
                <span className="font-headline font-bold text-white text-lg">V</span>
             </div>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute -right-4 top-16 h-8 w-8 rounded-full border bg-card shadow-md md:flex hidden"
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
                  "group flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors cursor-pointer",
                  pathname === item.href 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  item.highlight && "ring-1 ring-accent/20 bg-accent/5"
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5 shrink-0",
                  pathname === item.href ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {!isCollapsed && <span>{item.label}</span>}
                {!isCollapsed && item.highlight && (
                  <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground font-bold uppercase tracking-wider">
                    Nuevo
                  </span>
                )}
              </div>
            </Link>
          ))}
        </nav>

        <div className="border-t p-4">
          <div className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer",
            isCollapsed && "justify-center"
          )}>
            <Settings className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>Configuración</span>}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b bg-background/80 px-8 backdrop-blur-md">
           <h2 className="font-headline text-2xl font-bold tracking-tight">
            {getPageTitle(pathname)}
           </h2>
           <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center border">
                <span className="text-sm font-bold">JD</span>
              </div>
           </div>
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
