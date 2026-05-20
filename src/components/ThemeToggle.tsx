"use client"

import * as React from "react"
import { Moon, Sun, Palette, Check } from "lucide-react"
import { useTheme } from "next-themes"
import { useLedgerStore, type ThemeColor } from "@/lib/store"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const { themeColor, setThemeColor } = useLedgerStore()

  const colors: { name: string; value: ThemeColor; class: string }[] = [
    { name: "Institucional (Azul)", value: "blue", class: "bg-blue-500" },
    { name: "Industrial (Naranja)", value: "orange", class: "bg-orange-500" },
    { name: "Ecológico (Verde)", value: "green", class: "bg-green-600" },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-xl hover:bg-accent group">
          <Palette className="h-[1.2rem] w-[1.2rem] transition-transform group-hover:rotate-12" />
          <span className="sr-only">Personalizar</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl p-2">
        <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground pb-2">Brillo</DropdownMenuLabel>
        <div className="grid grid-cols-3 gap-1 mb-2">
          <Button 
            variant={theme === 'light' ? 'default' : 'ghost'} 
            size="sm" 
            className="h-8 text-[10px]" 
            onClick={() => setTheme("light")}
          >
            <Sun className="h-3 w-3 mr-1" /> Claro
          </Button>
          <Button 
            variant={theme === 'dark' ? 'default' : 'ghost'} 
            size="sm" 
            className="h-8 text-[10px]" 
            onClick={() => setTheme("dark")}
          >
            <Moon className="h-3 w-3 mr-1" /> Oscuro
          </Button>
          <Button 
            variant={theme === 'system' ? 'default' : 'ghost'} 
            size="sm" 
            className="h-8 text-[10px]" 
            onClick={() => setTheme("system")}
          >
            Auto
          </Button>
        </div>

        <DropdownMenuSeparator />
        
        <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-2">Color de Marca</DropdownMenuLabel>
        <div className="space-y-1">
          {colors.map((color) => (
            <DropdownMenuItem 
              key={color.value} 
              onClick={() => setThemeColor(color.value)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className={cn("h-3 w-3 rounded-full", color.class)} />
                <span className="text-xs">{color.name}</span>
              </div>
              {themeColor === color.value && <Check className="h-3 w-3 text-primary" />}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
