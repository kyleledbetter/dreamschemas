import { AuthButton } from "@/components/auth-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogoIcon } from "@/components/ui/icons";
import { hasEnvVars } from "@/lib/utils";
import { Database, Github, Sparkles, Twitter } from "lucide-react";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background size-full flex flex-col relative">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-6 max-w-7xl mx-auto">
          {/* Logo and Navigation */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-3 font-bold text-xl"
            >
              <LogoIcon className="w-40 h-auto" />

              <Badge
                variant="outline"
                className="text-xs bg-primary/25 border-primary/20 text-primary dark:text-accent/80 dark:bg-accent/10 dark:border-accent/20 relative top-0.5"
              >
                Alpha
              </Badge>
            </Link>

            <nav className="hidden items-center gap-1">
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
                  href="https://github.com/kyleledbetter/dreamschemas"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </a>
                <a
                  href="https://x.com/askdreamai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Twitter className="h-4 w-4" />
                  Twitter
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted-foreground">
              © 2025 Dream, Inc. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Powered by Supabase &amp; Google Gemini</span>
            </div>
          </div>
        </div>
      </footer>
      <div className="fixed bottom-4 right-4 z-50">
        <a
          href="https://bolt.new/?rid=os72mi"
          target="_blank"
          rel="noopener noreferrer"
          className="block transition-all duration-300 hover:shadow-2xl"
        >
          <img
            src="https://storage.bolt.army/white_circle_360x360.png"
            alt="Built with Bolt.new badge"
            className="w-20 h-20 md:w-28 md:h-28 rounded-full shadow-lg  bolt-badge bolt-badge-intro"
          />
        </a>
      </div>
    </div>
  );
}
