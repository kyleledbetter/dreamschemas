import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { DemoPreview } from "@/components/landing/demo-preview";
import { HowItWorks } from "@/components/landing/how-it-works";
import { SocialProof } from "@/components/landing/social-proof";
import { CTASection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-background size-full">
      <Header />
      <main>
        <Hero />
        <Features />
        <DemoPreview />
        <HowItWorks />
        <SocialProof />
        <CTASection />
      </main>
      <Footer />
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
