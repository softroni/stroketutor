import * as React from "react";
import { useHaptics, useTranslation } from "superwall/hooks";
import { useRouter } from "superwall/navigation";
import { ContinueFreeButton, LegalLinks, NoticeLine, PrimaryButton } from "./Controls";
import { CloseIcon } from "./icons";
import { type Offer, type Plan, priceOf, useOffer } from "./offer";
import { usePremiumActions } from "./usePremiumActions";

/**
 * "View more plans" (PaywallPlansSheet): Yearly (with the free week, when there is
 * one) and Weekly, Yearly chosen. The button says what the chosen plan does and
 * names the amount it bills.
 *
 * This page can buy on its own, so it keeps the paywall's rule (Apple,
 * https://developer.apple.com/app-store/subscriptions/, read 2026-09-25: "the
 * amount that will be billed must be the most prominent pricing element"): each
 * card's billed price is 1.5rem (24 px) heavy ink, larger than the 1.25rem (20 px)
 * title on the button, and every size is rem so the order holds at any text size.
 * The weekly equivalent and "Save 80%" sit smaller, beside and under it. The
 * subscription's name sits over the plans, since this page names what is bought.
 */
export function PlansScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const haptics = useHaptics();
  const actions = usePremiumActions();
  const offer = useOffer(actions.trialAtPurchase);
  const [selected, setSelected] = React.useState<Plan>("yearly");

  const plans = (["yearly", "weekly"] as const).filter((plan) => priceOf(offer, plan) !== undefined);
  const chosen: Plan | undefined = plans.includes(selected) ? selected : plans[0];
  const chosenPrice = chosen ? priceOf(offer, chosen) : undefined;

  const choose = (plan: Plan) => {
    if (plan !== chosen) haptics.selection();
    setSelected(plan);
  };

  const closePlans = () => {
    haptics.light();
    if (router.canGoBack()) router.back();
    else router.replace("index");
  };

  return (
    <main className="pc-page">
      <header className="pc-bar pc-bar--plans">
        <div className="pc-plans-heading">
          <h1 className="pc-plans-title">{t("premium.plans.title")}</h1>
          <p className="pc-plans-subtitle">{t("premium.plans.subtitle")}</p>
        </div>
        <button type="button" className="pc-bar-button" aria-label={t("premium.plans.close")} onClick={closePlans}>
          <CloseIcon />
        </button>
      </header>

      <div className="pc-content pc-content--top">
        <div className="pc-plans" role="radiogroup" aria-label={t("premium.plans.title")}>
          {plans.map((plan) => (
            <PlanCard key={plan} plan={plan} offer={offer} checked={plan === chosen} onChoose={choose} />
          ))}
        </div>
      </div>

      <footer className="pc-footer">
        {chosen && chosenPrice ? <p className="pc-plans-terms">{terms(t, chosen, chosenPrice, offer)}</p> : null}
        <NoticeLine notice={actions.notice} />
        <PrimaryButton
          title={buttonTitle(t, chosen, offer)}
          price={chosen && chosenPrice ? buttonPrice(t, chosen, chosenPrice, offer) : undefined}
          onClick={() => void actions.buy(chosen ?? "yearly", offer.namesTrial)}
        />
        <ContinueFreeButton onContinue={actions.continueFree} />
        <LegalLinks onOpen={actions.open} />
      </footer>
    </main>
  );
}

type Translate = ReturnType<typeof useTranslation>["t"];

function PlanCard({
  plan,
  offer,
  checked,
  onChoose,
}: {
  plan: Plan;
  offer: Offer;
  checked: boolean;
  onChoose: (plan: Plan) => void;
}) {
  const { t } = useTranslation();
  const price = priceOf(offer, plan);
  if (!price) return null;

  const isYearly = plan === "yearly";
  const tag = isYearly && offer.savingsPercent ? t("premium.plans.save", { percent: offer.savingsPercent }) : undefined;
  const billed = t(isYearly ? "premium.plans.yearlyPrice" : "premium.plans.weeklyPrice", { price });

  return (
    <button type="button" role="radio" aria-checked={checked} className="pc-plan" onClick={() => onChoose(plan)}>
      <span className="pc-plan-radio" aria-hidden="true" />
      <span className="pc-plan-body">
        <span className="pc-plan-top">
          <span className="pc-plan-name">
            <span className="pc-plan-title">{t(isYearly ? "premium.plans.yearly" : "premium.plans.weekly")}</span>
            {tag ? <span className="pc-plan-tag">{tag}</span> : null}
          </span>
          <span className="pc-plan-price">{billed}</span>
        </span>
        <span className="pc-plan-detail">{isYearly ? yearlyDetail(t, offer) : t("premium.plans.weeklyDetail")}</span>
      </span>
    </button>
  );
}

/** "7 days free, then billed yearly · about $0.38 a week": the weekly figure is a
 * breakdown of the yearly price, so it sits in the card's small print. */
function yearlyDetail(t: Translate, offer: Offer): string {
  const billing =
    offer.namesTrial && offer.trialDays
      ? offer.trialDays === 1
        ? t("premium.plans.yearlyTrialDetailOneDay")
        : t("premium.plans.yearlyTrialDetail", { days: offer.trialDays })
      : t("premium.plans.yearlyDetail");
  return offer.yearlyPerWeek ? t("premium.plans.withPerWeek", { detail: billing, perWeek: offer.yearlyPerWeek }) : billing;
}

function terms(t: Translate, plan: Plan, price: string, offer: Offer): string {
  if (plan === "weekly") return t("premium.plans.termsWeekly", { price });
  return offer.namesTrial ? t("premium.plans.termsYearlyTrial", { price }) : t("premium.plans.termsYearly", { price });
}

function buttonTitle(t: Translate, plan: Plan | undefined, offer: Offer): string {
  if (plan === "weekly") return t("premium.cta.subscribeWeekly");
  if (plan === "yearly") {
    if (!offer.namesTrial) return t("premium.cta.subscribeYearly");
    return offer.trialDays === 7 ? t("premium.cta.trialWeek") : t("premium.cta.trial");
  }
  return t("premium.cta.subscribe");
}

/** The amount the chosen plan bills, on the button itself. */
function buttonPrice(t: Translate, plan: Plan, price: string, offer: Offer): string {
  if (plan === "weekly") return t("premium.cta.perWeek", { price });
  return t(offer.namesTrial ? "premium.cta.thenPerYear" : "premium.cta.perYear", { price });
}
