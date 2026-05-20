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
  Target
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
  
  const validTransactions = transactions.filter(t => !t.isVoided)

  const totalRevenue = validTransactions
    .filter(t => t.type === 'sale')
    .reduce((acc, curr) => acc + curr.totalAmount, 0)
    
  const totalCosts = validTransactions
    .reduce((acc, curr) => {
      if (curr.type === 'purchase') return acc + curr.totalAmount
      return acc + (curr.costBasis || 0)
    }, 0)
    
  const totalProfit = validTransactions
    .filter(t => t.type === 'sale')
    .reduce((acc, curr) => acc + curr.gain, 0)
    
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  const chartData = validTransactions.slice(-10).map(t => ({
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
                Procesado en {validTransactions.length} registros válidos
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
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Actividad Financiera Reciente</CardTitle>
            <CardDescription>Visualización de los últimos flujos de compras y ventas institucionales.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[400px] w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis 
                      dataKey="name" 
                      stroke="#888888" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      stroke="#888888" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--primary))' }}
                      labelFormatter={(label) => `Factura: ${label}`}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.type === 'purchase' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                  No hay transacciones disponibles para visualización en el gráfico.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
