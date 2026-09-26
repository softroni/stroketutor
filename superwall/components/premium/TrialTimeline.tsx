import type { ReactNode } from "react";
import { useTranslation } from "superwall/hooks";
import { BellIcon, CardIcon, LockOpenIcon } from "./icons";
import { formatDay, type Offer } from "./offer";

/**
 * The free week, day by day (TrialTimeline): today, the day the reminder comes and
 * the day the price starts, each with its real date in the device's own format.
 *
 * Apple (https://developer.apple.com/app-store/subscriptions/, read 2026-09-25):
 * "clearly indicate how long the free trial lasts and the price billed once the
 * free trial is over" — the last row gives both, with a date. Breakdowns and extras
 * sit "in a subordinate position and size to the annual price", so nothing here is
 * larger than 0.9375rem (15 px): the price above stays the largest pricing element.
 *
 * Every row is a promise, so each says only what will happen: the reminder row
 * appears only while its day is still to come, and says "if you allow
 * notifications" because the app asks for that permission after the free week
 * starts; the last row says to cancel "at least a day before", as Apple advises
 * (https://support.apple.com/en-us/118428: "at least 24 hours before").
 *
 * Rendered only while the free week can be named (`offer.namesTrial`).
 */
export function TrialTimeline({ offer }: { offer: Offer }) {
  const { t } = useTranslation();
  const { yearlyPrice, trialEnd, reminder, locale } = offer;
  if (!offer.namesTrial || !yearlyPrice || !trialEnd) return null;

  return (
    <ul className="pc-timeline">
      <Row icon={<LockOpenIcon />} tone="green" when={t("premium.timeline.today")}>
        {t("premium.timeline.todayDetail")}
      </Row>
      {reminder ? (
        <Row
          icon={<BellIcon />}
          tone="gold"
          when={formatDay(reminder, locale)}
          spokenWhen={formatDay(reminder, locale, true)}
        >
          {t("premium.timeline.reminderDetail")}
        </Row>
      ) : null}
      <Row
        icon={<CardIcon />}
        tone="ink"
        when={formatDay(trialEnd, locale)}
        spokenWhen={formatDay(trialEnd, locale, true)}
      >
        {t("premium.timeline.endDetail", { price: yearlyPrice })}
      </Row>
    </ul>
  );
}

function Row({
  icon,
  tone,
  when,
  spokenWhen,
  children,
}: {
  icon: ReactNode;
  tone: "green" | "gold" | "ink";
  when: string;
  spokenWhen?: string;
  children: ReactNode;
}) {
  return (
    <li className="pc-timeline-row">
      <span className={`pc-timeline-icon pc-timeline-icon--${tone}`}>{icon}</span>
      <span className="pc-timeline-text">
        <span className="pc-timeline-when">
          <span aria-hidden={spokenWhen ? true : undefined}>{when}</span>
          {spokenWhen ? <span className="pc-visually-hidden">{spokenWhen}</span> : null}
        </span>
        <span className="pc-timeline-what">{children}</span>
      </span>
    </li>
  );
}
