"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { GitBranch, Play } from "lucide-react";
import Link from "next/link";

export function DemoPreview() {
  return (
    <section id="demo" className="py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            See Dreamschemas in{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Action
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Watch how we transform a complex e-commerce CSV dataset into a
            production-ready Supabase schema with relationships, constraints,
            and optimizations.
          </p>
          <Button size="lg" className="group" asChild>
            <Link
              href="https://youtu.be/V9WxoTdnGWQ?list=PLZuvjX26O44w6AMaXgNEk0oXSZDrVK6So"
              target="_blank"
            >
              <Play className="mr-2 h-5 w-5 transition-transform group-hover:scale-110" />
              Watch Demo Video
            </Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="relative max-w-6xl mx-auto"
        >
          {/* Main Demo Container */}
          <div className="relative bg-card border border-border rounded-3xl overflow-hidden shadow-2xl">
            {/* Browser Header */}
            <div className="bg-muted/50 border-b border-border px-6 py-4 flex items-center space-x-2">
              <div className="flex space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                <div className="w-3 h-3 bg-green-500 rounded-full" />
              </div>
              <div className="flex-1 bg-background rounded-lg px-4 py-2 text-sm text-muted-foreground ml-4">
                dreamschemas.netlify.app
              </div>
            </div>

            {/* Demo Content */}
            <div className="p-0 relative">
              {/* full embed of youtube iframe */}

              <iframe
                src="https://www.youtube.com/embed/V9WxoTdnGWQ"
                className="size-full aspect-video cover"
                title="Dreamschemas Demo"
                allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi"
                sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
              />
            </div>
          </div>

          {/* Floating Elements */}
          <motion.div
            animate={{ y: [-5, 5, -5] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-6 -right-6 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center"
          >
            <GitBranch className="h-6 w-6 text-primary" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
