import { useHaptics, useTranslation } from "superwall/hooks";
import { useRouter } from "superwall/navigation";
import { ContinueFreeButton, LegalLinks, NoticeLine, PrimaryButton, RestoreButton } from "./Controls";
import { OfferBenefits } from "./OfferBenefits";
import { PaywallArt } from "./PaywallArt";
import { PriceBlock } from "./PriceBlock";
import { TrialTimeline } from "./TrialTimeline";
import { useOffer } from "./offer";
import { usePremiumActions } from "./usePremiumActions";

/**
 * The paywall (PaywallView on PaywallLayout): one recommended plan, Yearly with its
 * free week, and everything the App Store asks of a sign-up screen in plain sight.
 *
 * Top to bottom: Restore in the bar; the art; the price block, "$19.99 per year"
 * the largest text on the page; the free week as a dated timeline, or, with no free
 * week to offer, what Premium gives; pinned at the foot, "View more plans", the buy
 * button naming the price it bills, "Continue with free lessons" directly under it,
 * and the Terms of Use and Privacy links.
 *
 * Apple, "Auto-renewable subscriptions"
 * (https://developer.apple.com/app-store/subscriptions/), read 2026-09-25: "the
 * amount that will be billed must be the most prominent pricing element in the
 * layout" (App Review Guideline 3.1.2). Sizes at the default text size: price 32 px
 * heavy ink; free-week line 18 px; button title 20 px with its price line 15 px;
 * timeline 15 px. All rem, so they scale together.
 *
 * Human Interface Guidelines › Modality
 * (https://developer.apple.com/design/human-interface-guidelines/modality): "Always
 * give people an obvious way to dismiss a modal view." There is no close button:
 * the way out is "Continue with free lessons", right under the buy button.
 */
export function PaywallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const haptics = useHaptics();
  const actions = usePremiumActions();
  const offer = useOffer(actions.trialAtPurchase);
  const { yearlyPrice, namesTrial, trialDays } = offer;

  const title = namesTrial
    ? trialDays === 7
      ? t("premium.cta.trialWeek")
      : t("premium.cta.trial")
    : t("premium.cta.subscribe");
  const price = yearlyPrice
    ? t(namesTrial ? "premium.cta.thenPerYear" : "premium.cta.perYear", { price: yearlyPrice })
    : undefined;

  return (
    <main className="pc-page">
      <header className="pc-bar">
        <RestoreButton onRestore={actions.restorePurchases} />
      </header>

      <div className="pc-content">
        <PaywallArt />
        <PriceBlock offer={offer} />
        {namesTrial ? <TrialTimeline offer={offer} /> : <OfferBenefits offer={offer} />}
      </div>

      <footer className="pc-footer">
        {yearlyPrice ? (
          <button
            type="button"
            className="pc-quiet pc-quiet--plans"
            onClick={() => {
              haptics.light();
              router.push("plans");
            }}
          >
            {t("premium.viewPlans")}
          </button>
        ) : null}
        <NoticeLine notice={actions.notice} />
        <PrimaryButton title={title} price={price} onClick={() => void actions.buy("yearly", namesTrial)} />
        <ContinueFreeButton onContinue={actions.continueFree} />
        <LegalLinks onOpen={actions.open} />
      </footer>
    </main>
  );
}
