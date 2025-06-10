"use client";

import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Play,
  FileSpreadsheet,
  Brain,
  Database,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Vortex } from "@/components/ui/vortex";

export function Hero() {
  return (
    <section className="relative min-h-[900px] flex items-center justify-center overflow-hidden bg-black">
      {/* Vortex Background */}
      <Vortex
        backgroundColor="black"
        rangeY={800}
        particleCount={500}
        baseHue={155}
        containerClassName="absolute inset-0 w-full h-full opacity-50"
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-16 z-10 relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="inline-flex items-center px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6"
            >
              <span className="w-2 h-2 bg-accent rounded-full mr-2 animate-pulse" />
              AI-Powered Schema Generation
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-white"
            >
              Transform CSV Data into{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Production-Ready
              </span>{" "}
              Supabase Schemas
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-xl text-white/70 mb-8 max-w-2xl"
            >
              AI-powered schema generation with visual editing and one-click
              deployment. From spreadsheet to database in minutes, not hours.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Button
                asChild
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl hover:shadow-2xl transition-all group"
              >
                <Link href="/auth/login">
                  Connect Supabase Account
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="group bg-black border-white/20 text-white hover:bg-white/10"
              >
                <Link href="#demo">
                  <Play className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
                  View Demo
                </Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-8 text-sm text-white/60"
            >
              No credit card required • Free to start • Deploy in minutes
            </motion.div>
          </motion.div>

          {/* Hero Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative"
          >
            <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">
              {/* Flow Diagram */}
              <div className="flex items-center justify-between">
                {/* CSV */}
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  className="flex flex-col items-center space-y-2"
                >
                  <div className="w-16 h-16 bg-green-500/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-green-500/30">
                    <FileSpreadsheet className="h-8 w-8 text-green-400" />
                  </div>
                  <span className="text-xs font-medium text-white/70">
                    CSV Files
                  </span>
                </motion.div>

                {/* Arrow 1 */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.8 }}
                  className="flex-1 flex justify-center"
                >
                  <ArrowRight className="h-6 w-6 text-white/60" />
                </motion.div>

                {/* AI Brain */}
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.7 }}
                  className="flex flex-col items-center space-y-2"
                >
                  <div className="w-16 h-16 bg-primary/20 backdrop-blur-sm rounded-xl flex items-center justify-center relative border border-primary/30">
                    <Brain className="h-8 w-8 text-primary" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-pulse" />
                  </div>
                  <span className="text-xs font-medium text-white/70">
                    AI Analysis
                  </span>
                </motion.div>

                {/* Arrow 2 */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.4, delay: 1.0 }}
                  className="flex-1 flex justify-center"
                >
                  <ArrowRight className="h-6 w-6 text-white/60" />
                </motion.div>

                {/* Database */}
                <motion.div
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.9 }}
                  className="flex flex-col items-center space-y-2"
                >
                  <div className="w-16 h-16 bg-blue-500/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-blue-500/30">
                    <Database className="h-8 w-8 text-blue-400" />
                  </div>
                  <span className="text-xs font-medium text-white/70">
                    Schema
                  </span>
                </motion.div>
              </div>

              {/* Sample Schema Preview */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.2 }}
                className="mt-8 p-4 bg-black/20 backdrop-blur-sm rounded-lg border border-white/10"
              >
                <div className="text-xs font-mono text-white/80 space-y-1">
                  <div>CREATE TABLE users (</div>
                  <div className="ml-4">id UUID PRIMARY KEY,</div>
                  <div className="ml-4">email TEXT UNIQUE NOT NULL,</div>
                  <div className="ml-4">
                    created_at TIMESTAMPTZ DEFAULT NOW()
                  </div>
                  <div>);</div>
                </div>
              </motion.div>
            </div>

            {/* Floating Elements */}
            <motion.div
              animate={{ y: [-10, 10, -10] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-4 -right-4 w-8 h-8 bg-primary/30 backdrop-blur-sm rounded-full border border-primary/50"
            />
            <motion.div
              animate={{ y: [10, -10, 10] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-4 -left-4 w-6 h-6 bg-accent/30 backdrop-blur-sm rounded-full border border-accent/50"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
