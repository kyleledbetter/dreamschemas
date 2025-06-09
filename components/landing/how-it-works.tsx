"use client";

import { Upload, Brain, Edit, Rocket } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Upload CSV Files",
    description: "Drag & drop or browse to upload single or multiple CSV files. Our system supports files up to 100MB with intelligent sampling for large datasets.",
    color: "from-blue-500 to-cyan-500"
  },
  {
    number: "02",
    icon: Brain,
    title: "AI Schema Generation",
    description: "Gemini 2.5 Flash analyzes your data structure, column types, and relationships. Our AI achieves 90%+ accuracy in schema inference.",
    color: "from-purple-500 to-pink-500"
  },
  {
    number: "03",
    icon: Edit,
    title: "Visual Editing",
    description: "Review and customize the generated schema using our interactive React Flow editor. Modify tables, relationships, and constraints with real-time validation.",
    color: "from-green-500 to-emerald-500"
  },
  {
    number: "04",
    icon: Rocket,
    title: "Deploy to Supabase",
    description: "Connect your Supabase account and deploy with one click. Generate production-ready migrations with PostgreSQL best practices built-in.",
    color: "from-orange-500 to-red-500"
  }
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            From CSV to Production in{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              4 Simple Steps
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Our streamlined workflow takes you from raw CSV data to a production-ready 
            Supabase database schema in minutes, not hours.
          </p>
        </motion.div>

        <div className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-border to-transparent transform -translate-y-1/2" />
          
          <div className="grid lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="relative group"
              >
                {/* Step Card */}
                <div className="bg-card border border-border rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 hover:-translate-y-2 relative z-10">
                  {/* Step Number */}
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${step.color} flex items-center justify-center text-white text-sm font-bold`}>
                      {index + 1}
                    </div>
                  </div>

                  {/* Icon */}
                  <div className="mb-6 mt-4">
                    <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${step.color} p-0.5`}>
                      <div className="w-full h-full bg-card rounded-2xl flex items-center justify-center">
                        <step.icon className="h-8 w-8 text-foreground" />
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>

                  {/* Step Number Display */}
                  <div className="absolute top-4 right-4 text-6xl font-bold text-muted-foreground/10 group-hover:text-primary/20 transition-colors">
                    {step.number}
                  </div>
                </div>

                {/* Connection Dot */}
                <div className="hidden lg:block absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full border-4 border-background z-20" />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <div className="inline-flex items-center px-6 py-3 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <span className="w-2 h-2 bg-primary rounded-full mr-2 animate-pulse" />
            Average time: 3-5 minutes from upload to deployment
          </div>
        </motion.div>
      </div>
    </section>
  );
}