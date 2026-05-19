"use client"

import * as React from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card"
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ArrowUpRight, 
  Activity, 
  Target,
  Truck,
  Users
} from "lucide-react"
import { useLedgerStore } from "@/lib/store"
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell 
} from "recharts"

export default function Dashboard() {
  const { transactions } = useLedgerStore()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])
  
  const totalRevenue = transactions
    .filter(t => t.type === 'sale')
    .reduce((acc, curr) => acc + curr.totalAmount, 0)
    
  const totalCosts = transactions
    .reduce((acc, curr) => {
      if (curr.type === 'purchase') return acc + curr.totalAmount
      return acc + (curr.costBasis || 0)
    }, 0)
    
  const totalProfit = transactions
    .filter(t => t.type === 'sale')
    .reduce((acc, curr) => acc + curr.gain, 0)
    
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  const chartData = transactions.slice(-10).map(t => ({
    name: t.invoiceNumber,
    value: t.totalAmount,
    type: t.type
  }))

  if (!mounted) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Activity className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Metric Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <DollarSign className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-headline">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-accent inline-flex items-center">
                  <ArrowUpRight className="w-3 h-3 mr-1" /> +12.5%
                </span> desde el último periodo
              </p>
            </CardContent>
            <div className="absolute bottom-0 left-0 h-1 bg-accent/30 w-full" />
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Costos Totales</CardTitle>
              <TrendingDown className="w-4 h-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-headline">${totalCosts.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Procesado en {transactions.length} registros
              </p>
            </CardContent>
            <div className="absolute bottom-0 left-0 h-1 bg-destructive/30 w-full" />
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Beneficio Neto</CardTitle>
              <TrendingUp className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-headline">${totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Eficiencia institucional al 84%
              </p>
            </CardContent>
            <div className="absolute bottom-0 left-0 h-1 bg-primary/30 w-full" />
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Margen de Beneficio</CardTitle>
              <Target className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-headline">{profitMargin.toFixed(1)}%</div>
              <div className="w-full bg-secondary h-2 rounded-full mt-3">
                <div 
                  className="bg-accent h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${Math.min(profitMargin, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart Section */}
        <div className="grid gap-4 md:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Actividad Financiera</CardTitle>
              <CardDescription>Visualización de los flujos recientes de compras y ventas institucionales.</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <div className="h-[300px] w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis 
                        dataKey="name" 
                        stroke="#888888" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <YAxis 
                        stroke="#888888" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        itemStyle={{ color: 'hsl(var(--primary))' }}
                        labelFormatter={(label) => `Factura: ${label}`}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.type === 'purchase' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    No hay transacciones disponibles para visualización.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Análisis Reciente</CardTitle>
              <CardDescription>Hallazgos clave de los datos procesados.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                <div className="flex items-center">
                  <Activity className="h-9 w-9 text-accent mr-3" />
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">Mapeo Automatizado</p>
                    <p className="text-xs text-muted-foreground">
                      La IA mapeó con éxito el 100% de la última factura.
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Truck className="h-9 w-9 text-primary mr-3" />
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">Crecimiento de Proveedores</p>
                    <p className="text-xs text-muted-foreground">
                      3 nuevos socios institucionales añadidos esta semana.
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Users className="h-9 w-9 text-accent mr-3" />
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">Retención de Clientes</p>
                    <p className="text-xs text-muted-foreground">
                      Los 5 principales clientes aportan el 45% de las ganancias.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
