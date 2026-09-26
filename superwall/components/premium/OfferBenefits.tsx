import { useTranslation } from "superwall/hooks";
import { CheckIcon } from "./icons";
import type { Offer } from "./offer";

/**
 * What Premium gives (OfferBenefits), in the timeline's place when there is no free
 * week to lay out: the store says this person is not eligible, has not said, or
 * has not sent the price. No trial is named here.
 *
 * The lesson and path counts are the app's to know; it can pass them as the
 * placement params `lessonCount` and `pathCount`. Without both, the line stays
 * generic rather than inventing a number.
 */
export function OfferBenefits({ offer }: { offer: Offer }) {
  const { t } = useTranslation();
  const { lessonCount, pathCount } = offer;
  const lessons =
    lessonCount && pathCount
      ? t("premium.benefits.lessons", { lessons: Math.trunc(lessonCount), paths: Math.trunc(pathCount) })
      : t("premium.benefits.lessonsGeneric");

  return (
    <ul className="pc-benefits pc-column">
      {[lessons, t("premium.benefits.lina"), t("premium.benefits.cancel")].map((line) => (
        <li className="pc-benefit" key={line}>
          <CheckIcon />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}
