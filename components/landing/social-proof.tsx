"use client";

import { Star, Github, Users, Zap } from "lucide-react";
import { motion } from "framer-motion";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Full-stack Developer",
    company: "TechCorp",
    content:
      "Dreamschemas saved me hours of manual schema design. The AI suggestions were spot-on and the visual editor made refinements effortless.",
    avatar: "SC",
  },
  {
    name: "Marcus Rodriguez",
    role: "Data Engineer",
    company: "DataFlow Inc",
    content:
      "Finally, a tool that understands my CSV data better than I do. The relationship detection is incredibly accurate.",
    avatar: "MR",
  },
  {
    name: "Emily Watson",
    role: "Product Manager",
    company: "StartupXYZ",
    content:
      "Our team went from CSV to production database in under 10 minutes. This tool is a game-changer for rapid prototyping.",
    avatar: "EW",
  },
];

const stats = [
  {
    icon: Github,
    value: "2.1k",
    label: "GitHub Stars",
    color: "text-yellow-500",
  },
  {
    icon: Users,
    value: "500+",
    label: "Developers",
    color: "text-blue-500",
  },
  {
    icon: Zap,
    value: "10k+",
    label: "Schemas Generated",
    color: "text-green-500",
  },
];

export function SocialProof() {
  return (
    <section className="py-24" id="social-proof">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Trusted by developers{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              building on Supabase
            </span>
          </h2>

          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mt-12">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="flex justify-center mb-2">
                  <stat.icon className={`h-8 w-8 ${stat.color}`} />
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              viewport={{ once: true }}
              className="group"
            >
              <div className="bg-card border border-border rounded-2xl p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                {/* Stars */}
                <div className="flex space-x-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>

                {/* Content */}
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  &quot;{testimonial.content}&quot;
                </p>

                {/* Author */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">
                      {testimonial.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {testimonial.role} at {testimonial.company}
                    </div>
                  </div>
                </div>

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
