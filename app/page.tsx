import { PortfolioBuilder } from "@/components/portfolio-builder";
import { Suspense } from "react";

function PortfolioPage() {
  return (
    <PortfolioBuilder
      baseDomain={process.env.CPANEL_ROOT_DOMAIN || "voiceresume.xyz"}
    />
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PortfolioPage />
    </Suspense>
  );
}
