import lina from "@/assets/lina-wave.svg";
import { ContinueFreeButton, LegalLinks, NoticeLine, PrimaryButton, RestoreButton } from "@/components/premium/Controls";
import { PriceBlock } from "@/components/premium/PriceBlock";
import { useOffer } from "@/components/premium/offer";
import { usePremiumActions } from "@/components/premium/usePremiumActions";
import { useHaptics, useTranslation } from "superwall/hooks";
import { useRouter } from "superwall/navigation";
import gift from "../assets/gift.svg";
import "./gift.css";

/**
 * The gift moment, before the paywall: Lina with a gift, what Premium costs, and
 * one line of what it gives. Calm, and generous with white space.
 *
 * The same rules as the paywall (Apple, "Auto-renewable subscriptions",
 * https://developer.apple.com/app-store/subscriptions/, read 2026-09-25): the
 * billed amount, "$19.99 per year", is the largest text on the page (2rem heavy
 * ink); the free week (1.125rem, green) is said only when the store reports this
 * person eligible and its length and price are known, with the plan's name and
 * renewal under it; for anyone else the page carries no trial claim at all. The
 * button, "Continue", names no trial and buys nothing: it opens the paywall, which
 * carries the full terms. "Continue with free lessons" is the way out, right
 * under it.
 */
export default function Gift() {
  const { t } = useTranslation();
  const router = useRouter();
  const haptics = useHaptics();
  const actions = usePremiumActions();
  const offer = useOffer();

  return (
    <main className="pc-page">
      <header className="pc-bar">
        <RestoreButton onRestore={actions.restorePurchases} />
      </header>

      <div className="pc-content gift-content">
        <div className="gift-art" aria-hidden="true">
          <img className="gift-lina" src={lina} alt="" draggable={false} />
          <img className="gift-box" src={gift} alt="" draggable={false} />
        </div>
        <PriceBlock offer={offer} familySharing={false} />
        <p className="gift-body">{t("gift.body")}</p>
      </div>

      <footer className="pc-footer">
        <NoticeLine notice={actions.notice} />
        <PrimaryButton
          title={t("gift.continue")}
          onClick={() => {
            haptics.light();
            router.push("paywall");
          }}
        />
        <ContinueFreeButton onContinue={actions.continueFree} />
        <LegalLinks onOpen={actions.open} />
      </footer>
    </main>
  );
}
