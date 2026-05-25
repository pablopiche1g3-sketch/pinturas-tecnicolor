"use client"

import * as React from "react"
import { Moon, Sun, Palette } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-xl hover:bg-accent group">
          <Palette className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Cambiar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => setTheme("light")} className={theme === "light" ? "bg-accent" : ""}>
          Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className={theme === "dark" ? "bg-accent" : ""}>
          Oscuro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("theme-emerald")} className={theme === "theme-emerald" ? "bg-accent text-emerald-500" : "text-emerald-600 dark:text-emerald-400"}>
          Esmeralda
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("theme-rose")} className={theme === "theme-rose" ? "bg-accent text-rose-500" : "text-rose-600 dark:text-rose-400"}>
          Rosa
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("theme-amber")} className={theme === "theme-amber" ? "bg-accent text-amber-500" : "text-amber-600 dark:text-amber-400"}>
          Ámbar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
