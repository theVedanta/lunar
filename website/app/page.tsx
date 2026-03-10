import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";
import { CodeEditorPreview } from "@/components/code-editor-preview";
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
      <section className="container mx-auto px-4 py-12 md:py-20">
        <CodeEditorPreview />
      </section>
      <FeaturesSection />
      <RulesSection />
      <HowItWorks />
      <MCPComparisonSection />
      <CTASection />
      <Footer />
    </main>
  );
}
