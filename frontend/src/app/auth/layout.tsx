import Link from 'next/link'

import { Logo } from '@/components/layout/logo'

export default function AuthLayout({ children }: LayoutProps<'/auth'>) {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 font-semibold">
          <Logo size={36} />
          Redaction Tools
        </Link>
        {children}
      </div>
    </div>
  )
}
