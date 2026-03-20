import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";
import { FeaturesSection } from "@/components/features-section";
import { RulesSection } from "@/components/rules-section";
import { HowItWorks } from "@/components/how-it-works";
import { MCPComparisonSection } from "@/components/mcp-comparison-section";
import { CTASection } from "@/components/cta-section";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <RulesSection />
      <HowItWorks />
      <MCPComparisonSection />
      <CTASection />
      <Footer />
    </main>
  );
}
