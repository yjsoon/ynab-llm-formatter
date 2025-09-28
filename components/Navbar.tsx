'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, TestTube } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex h-14 items-center">
          {/* Logo and Title */}
          <Link href="/" className="flex items-center gap-2 mr-8">
            <CreditCard className="h-5 w-5" />
            <span className="font-semibold">YNAB Formatter</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                pathname === "/" ? "text-foreground" : "text-muted-foreground"
              )}
            >
              Converter
            </Link>
            <Link
              href="/test"
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary",
                pathname === "/test" ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <TestTube className="h-4 w-4" />
              Test Models
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}