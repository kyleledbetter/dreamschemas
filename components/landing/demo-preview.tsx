"use client";

import { motion } from "framer-motion";
import { Play, Database, FileSpreadsheet, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";

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
            Watch how we transform a complex e-commerce CSV dataset into a production-ready 
            Supabase schema with relationships, constraints, and optimizations.
          </p>
          <Button size="lg" className="group">
            <Play className="mr-2 h-5 w-5 transition-transform group-hover:scale-110" />
            Watch Demo Video
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
                dreamschemas.com/editor
              </div>
            </div>

            {/* Demo Content */}
            <div className="p-8">
              {/* Schema Visualization */}
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Left Panel - File Upload */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  viewport={{ once: true }}
                  className="space-y-4"
                >
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Uploaded Files
                  </h3>
                  
                  {['users.csv', 'products.csv', 'orders.csv', 'order_items.csv'].map((file, index) => (
                    <motion.div
                      key={file}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                      viewport={{ once: true }}
                      className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg"
                    >
                      <FileSpreadsheet className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium">{file}</span>
                      <div className="ml-auto w-2 h-2 bg-green-500 rounded-full" />
                    </motion.div>
                  ))}
                </motion.div>

                {/* Center Panel - Schema Graph */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  viewport={{ once: true }}
                  className="lg:col-span-2"
                >
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">
                    Generated Schema
                  </h3>
                  
                  <div className="relative bg-muted/30 rounded-xl p-6 min-h-[300px]">
                    {/* Schema Tables */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Users Table */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.5 }}
                        viewport={{ once: true }}
                        className="bg-card border border-border rounded-lg p-4"
                      >
                        <div className="flex items-center space-x-2 mb-3">
                          <Database className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm">users</span>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div>id: UUID (PK)</div>
                          <div>email: TEXT</div>
                          <div>name: TEXT</div>
                          <div>created_at: TIMESTAMPTZ</div>
                        </div>
                      </motion.div>

                      {/* Products Table */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.6 }}
                        viewport={{ once: true }}
                        className="bg-card border border-border rounded-lg p-4"
                      >
                        <div className="flex items-center space-x-2 mb-3">
                          <Database className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm">products</span>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div>id: UUID (PK)</div>
                          <div>name: TEXT</div>
                          <div>price: DECIMAL</div>
                          <div>category: TEXT</div>
                        </div>
                      </motion.div>

                      {/* Orders Table */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.7 }}
                        viewport={{ once: true }}
                        className="bg-card border border-border rounded-lg p-4"
                      >
                        <div className="flex items-center space-x-2 mb-3">
                          <Database className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm">orders</span>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div>id: UUID (PK)</div>
                          <div>user_id: UUID (FK)</div>
                          <div>total: DECIMAL</div>
                          <div>status: TEXT</div>
                        </div>
                      </motion.div>

                      {/* Order Items Table */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.8 }}
                        viewport={{ once: true }}
                        className="bg-card border border-border rounded-lg p-4"
                      >
                        <div className="flex items-center space-x-2 mb-3">
                          <Database className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm">order_items</span>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div>id: UUID (PK)</div>
                          <div>order_id: UUID (FK)</div>
                          <div>product_id: UUID (FK)</div>
                          <div>quantity: INTEGER</div>
                        </div>
                      </motion.div>
                    </div>

                    {/* Relationship Lines */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      <motion.path
                        initial={{ pathLength: 0 }}
                        whileInView={{ pathLength: 1 }}
                        transition={{ duration: 1, delay: 1 }}
                        viewport={{ once: true }}
                        d="M 120 80 Q 150 100 180 120"
                        stroke="hsl(var(--primary))"
                        strokeWidth="2"
                        fill="none"
                        strokeDasharray="4 4"
                      />
                      <motion.path
                        initial={{ pathLength: 0 }}
                        whileInView={{ pathLength: 1 }}
                        transition={{ duration: 1, delay: 1.2 }}
                        viewport={{ once: true }}
                        d="M 180 200 Q 220 180 260 160"
                        stroke="hsl(var(--primary))"
                        strokeWidth="2"
                        fill="none"
                        strokeDasharray="4 4"
                      />
                    </svg>
                  </div>
                </motion.div>
              </div>

              {/* Bottom Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.9 }}
                viewport={{ once: true }}
                className="mt-8 grid grid-cols-3 gap-4 text-center"
              >
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">4</div>
                  <div className="text-sm text-muted-foreground">Tables Generated</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">12</div>
                  <div className="text-sm text-muted-foreground">Relationships</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">2.3s</div>
                  <div className="text-sm text-muted-foreground">Processing Time</div>
                </div>
              </motion.div>
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