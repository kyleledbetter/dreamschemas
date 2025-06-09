"use client";

import { Brain, Palette, Rocket, FileText, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Brain,
    title: "Intelligent AI Analysis",
    description:
      "Upload CSV files and let Gemini 2.5 Flash analyze your data structure. Automatically detects column types, relationships, and constraints with 90%+ accuracy.",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: Palette,
    title: "Visual Schema Editor",
    description:
      "Interactive drag-and-drop editor powered by React Flow. Modify tables, relationships, and constraints with real-time validation and instant feedback.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: Rocket,
    title: "One-Click Deployment",
    description:
      "Deploy directly to new or existing Supabase projects. Generate production-ready migrations with PostgreSQL best practices built-in.",
    gradient: "from-green-500 to-emerald-500",
  },
  {
    icon: FileText,
    title: "Migration Scripts",
    description:
      "Export declarative SQL migration files compatible with Supabase CLI. Version control your schema changes with confidence.",
    gradient: "from-orange-500 to-red-500",
  },
  {
    icon: Shield,
    title: "Secure Processing",
    description:
      "All CSV data processed client-side or in ephemeral containers. Your sensitive data never leaves your control or gets stored on our servers.",
    gradient: "from-indigo-500 to-purple-500",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description:
      "Optimized for performance with sample-based analysis. Process large datasets efficiently while maintaining accuracy and speed.",
    gradient: "from-yellow-500 to-orange-500",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Everything you need to build{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              better schemas
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            From intelligent analysis to visual editing, we&apos;ve built the
            complete toolkit for transforming your CSV data into
            production-ready database schemas.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group"
            >
              <div className="relative bg-card border border-border rounded-2xl p-8 h-full hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                {/* Icon */}
                <div className="relative mb-6">
                  <div
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} p-0.5`}
                  >
                    <div className="w-full h-full bg-card rounded-2xl flex items-center justify-center">
                      <feature.icon className="h-8 w-8 text-foreground" />
                    </div>
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary/20 rounded-full animate-pulse" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>

                {/* Hover Effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
