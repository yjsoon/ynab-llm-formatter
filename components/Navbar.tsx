'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Receipt, Beaker, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={cn(
      "sticky top-0 z-50 w-full border-b transition-all duration-300",
      scrolled
        ? "border-primary/20 bg-card/95 backdrop-blur-lg shadow-md h-12"
        : "border-primary/15 bg-gradient-to-r from-card via-card/98 to-primary/5 backdrop-blur-md shadow-sm h-14"
    )}>
      <div className="max-w-5xl mx-auto px-4 h-full">
        <div className="flex h-full items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center mr-8 group">
            <Receipt className="h-6 w-6 text-primary transition-transform group-hover:scale-110 group-hover:rotate-3" />
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-6 flex-1">
            <Link
              href="/"
              className={cn(
                "relative flex items-center gap-1.5 text-sm font-medium transition-all px-3 py-1.5 rounded-lg",
                pathname === "/"
                  ? "text-primary-foreground bg-primary shadow-sm"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/10"
              )}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Convert
            </Link>
            <Link
              href="/test"
              className={cn(
                "relative flex items-center gap-1.5 text-sm font-medium transition-all px-3 py-1.5 rounded-lg",
                pathname === "/test"
                  ? "text-primary-foreground bg-primary shadow-sm"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/10"
              )}
            >
              <Beaker className="h-4 w-4" />
              Lab
            </Link>
          </div>

          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}