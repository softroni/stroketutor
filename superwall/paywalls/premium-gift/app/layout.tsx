import type { PropsWithChildren } from "react";
import { PremiumShell } from "@/components/premium/PremiumShell";

export default function Layout({ children }: PropsWithChildren) {
  return <PremiumShell>{children}</PremiumShell>;
}
