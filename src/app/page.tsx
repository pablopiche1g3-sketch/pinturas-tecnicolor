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

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Metric Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-headline">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-accent inline-flex items-center">
                  <ArrowUpRight className="w-3 h-3 mr-1" /> +12.5%
                </span> from last period
              </p>
            </CardContent>
            <div className="absolute bottom-0 left-0 h-1 bg-accent/30 w-full" />
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
              <TrendingDown className="w-4 h-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-headline">${totalCosts.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Processed across {transactions.length} records
              </p>
            </CardContent>
            <div className="absolute bottom-0 left-0 h-1 bg-destructive/30 w-full" />
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              <TrendingUp className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-headline">${totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Institutional efficiency at 84%
              </p>
            </CardContent>
            <div className="absolute bottom-0 left-0 h-1 bg-primary/30 w-full" />
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
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
              <CardTitle>Financial Activity</CardTitle>
              <CardDescription>Visualizing recent institutional purchase and sales flows.</CardDescription>
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
                    No transactions available for visualization.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Recent Insights</CardTitle>
              <CardDescription>Key findings from mapped data.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                <div className="flex items-center">
                  <Activity className="h-9 w-9 text-accent mr-3" />
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">Automated Mapping</p>
                    <p className="text-xs text-muted-foreground">
                      AI successfully mapped 100% of last invoice.
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Truck className="h-9 w-9 text-primary mr-3" />
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">Supplier Growth</p>
                    <p className="text-xs text-muted-foreground">
                      Added 3 new institutional partners this week.
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Users className="h-9 w-9 text-accent mr-3" />
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">Client Retention</p>
                    <p className="text-xs text-muted-foreground">
                      Top 5 clients contributing 45% of total gains.
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
