import { AuthButton } from "@/components/auth-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hasEnvVars } from "@/lib/utils";
import {
  Database,
  Github,
  MessageCircle,
  Sparkles,
  Twitter,
} from "lucide-react";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background size-full flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-6 max-w-7xl mx-auto">
          {/* Logo and Navigation */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-xl"
            >
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              Dreamschema
              <Badge variant="outline" className="text-xs">
                Beta
              </Badge>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Schema Builder
                </Link>
              </Button>
            </nav>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Auth Button */}
            {!hasEnvVars ? <EnvVarWarning /> : <AuthButton />}

            {/* Theme Switcher */}
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 size-full flex flex-col">{children}</main>

      {/* Footer */}
      <footer className="border-t bg-muted/50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 hidden">
            {/* Brand */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-bold">
                <Database className="h-5 w-5" />
                Dreamschema
              </div>
              <p className="text-sm text-muted-foreground">
                Transform CSV files into production-ready PostgreSQL schemas
                with AI-powered analysis.
              </p>
            </div>

            {/* Product */}
            <div className="space-y-3">
              <h4 className="font-semibold">Product</h4>
              <div className="space-y-2 text-sm">
                <Link
                  href="/features"
                  className="block text-muted-foreground hover:text-foreground"
                >
                  Features
                </Link>
                <Link
                  href="/pricing"
                  className="block text-muted-foreground hover:text-foreground"
                >
                  Pricing
                </Link>
                <Link
                  href="/changelog"
                  className="block text-muted-foreground hover:text-foreground"
                >
                  Changelog
                </Link>
                <Link
                  href="/roadmap"
                  className="block text-muted-foreground hover:text-foreground"
                >
                  Roadmap
                </Link>
              </div>
            </div>

            {/* Resources */}
            <div className="space-y-3">
              <h4 className="font-semibold">Resources</h4>
              <div className="space-y-2 text-sm">
                <Link
                  href="/docs"
                  className="block text-muted-foreground hover:text-foreground"
                >
                  Documentation
                </Link>
                <Link
                  href="/guides"
                  className="block text-muted-foreground hover:text-foreground"
                >
                  Guides
                </Link>
                <Link
                  href="/examples"
                  className="block text-muted-foreground hover:text-foreground"
                >
                  Examples
                </Link>
                <Link
                  href="/blog"
                  className="block text-muted-foreground hover:text-foreground"
                >
                  Blog
                </Link>
              </div>
            </div>

            {/* Community */}
            <div className="space-y-3">
              <h4 className="font-semibold">Community</h4>
              <div className="space-y-2 text-sm">
                <a
                  href="https://github.com/dreamschemas/dreamschemas"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </a>
                <a
                  href="https://twitter.com/dreamschemas"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Twitter className="h-4 w-4" />
                  Twitter
                </a>
                <Link
                  href="/discord"
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <MessageCircle className="h-4 w-4" />
                  Discord
                </Link>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted-foreground">
              © 2025 Dream, Inc. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-foreground">
                Terms of Service
              </Link>
              <span>
                Powered by{" "}
                <a
                  href="https://supabase.com/?utm_source=dreamschema&utm_medium=template&utm_term=nextjs"
                  target="_blank"
                  className="font-medium hover:text-foreground"
                  rel="noreferrer"
                >
                  Supabase
                </a>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
