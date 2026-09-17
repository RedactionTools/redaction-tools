'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetMe } from '@/lib/api/generated/auth/auth'

export function AccountCard() {
  const { data, isPending } = useGetMe()

  if (isPending) {
    return (
      <Card className="max-w-md space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </Card>
    )
  }

  return (
    <Card className="max-w-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <CardTitle>{data?.name || 'Your account'}</CardTitle>
          <CardDescription className="mt-1">{data?.email}</CardDescription>
        </div>
        {data?.is_staff ? <Badge>Staff</Badge> : null}
      </div>
    </Card>
  )
}
