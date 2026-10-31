'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { AssistantView } from '@/features/assistant/view'

function AssistantPageInner() {
  const params = useSearchParams()
  const address = params.get('address') ?? undefined
  return <AssistantView address={address} />
}

export default function AssistantPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading explainer.</p>}>
      <AssistantPageInner />
    </Suspense>
  )
}
