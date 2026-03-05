'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChevronLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <Card className="bg-card border-border p-8 max-w-md text-center">
        <div className="mb-6">
          <h1 className="text-6xl font-bold text-primary mb-2">404</h1>
          <p className="text-muted-foreground">Page not found</p>
        </div>

        <p className="text-muted-foreground mb-8">
          Sorry, the page you are looking for does not exist or has been moved.
        </p>

        <Link href="/">
          <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
            <ChevronLeft className="w-4 h-4" />
            Back to Home
          </Button>
        </Link>
      </Card>
    </main>
  )
}
