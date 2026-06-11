import { PortfolioBuilder } from "@/components/portfolio-builder";

export default function Home() {
  return (
    <PortfolioBuilder
      baseDomain={process.env.CPANEL_ROOT_DOMAIN || "voiceresume.xyz"}
    />
  );
}
