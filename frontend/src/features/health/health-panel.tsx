'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useHealth } from '@/lib/api/generated/core/core'

export function HealthPanel() {
  const { data, isPending } = useHealth()

  if (isPending) {
    return (
      <Card className="max-w-md space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
      </Card>
    )
  }

  // The API reports a degraded database with a 200 and a body field, not a 5xx.
  const healthy = data?.status === 'ok'

  return (
    <Card className="max-w-md">
      <CardTitle>API status</CardTitle>
      <CardDescription className="mt-1">Live response from /api/v1/health.</CardDescription>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">status</dt>
          <dd data-testid="health-status">
            <Badge tone={healthy ? 'ok' : 'warn'}>{data?.status}</Badge>
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">database</dt>
          <dd data-testid="health-database">
            <Badge tone={data?.database === 'ok' ? 'ok' : 'warn'}>{data?.database}</Badge>
          </dd>
        </div>
      </dl>
    </Card>
  )
}
