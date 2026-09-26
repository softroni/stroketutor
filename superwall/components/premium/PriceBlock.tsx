import { useTranslation } from "superwall/hooks";
import { PeopleIcon } from "./icons";
import type { Offer } from "./offer";

/**
 * The prices, in the order Apple asks for (PriceBlock): the amount billed first and
 * largest, "$19.99 per year" at 2rem heavy ink; then the free week at 1.125rem,
 * only while it can be named; then the plan's name and length, and Family Sharing.
 * No breakdown here: the weekly equivalent lives on the plans page, beside the plan
 * it breaks down.
 *
 * Until the store answers there is no price, so the block names the plan and
 * nothing else: no free week, no number.
 */
export function PriceBlock({ offer, familySharing = true }: { offer: Offer; familySharing?: boolean }) {
  const { t } = useTranslation();
  const { yearlyPrice, namesTrial, trialDays } = offer;

  return (
    <div className="pc-price-block">
      {yearlyPrice ? (
        <h1 className="pc-price">{t("premium.price", { price: yearlyPrice })}</h1>
      ) : (
        <h1 className="pc-price pc-price--title">{t("premium.unpricedTitle")}</h1>
      )}
      {namesTrial && yearlyPrice && trialDays ? (
        <p className="pc-trial-line">
          {trialDays === 1 ? t("premium.trialLineOneDay") : t("premium.trialLine", { days: trialDays })}
        </p>
      ) : null}
      <p className="pc-plan-line">{yearlyPrice ? t("premium.planLine") : t("premium.planLineUnpriced")}</p>
      {familySharing ? (
        <p className="pc-chip">
          <PeopleIcon />
          {t("premium.familySharing")}
        </p>
      ) : null}
    </div>
  );
}
