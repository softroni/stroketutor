import * as React from "react";
import {
  useDevice,
  useIntroductoryOffer,
  useProducts,
  useTranslation,
  useVariables,
} from "superwall/hooks";

/**
 * Everything the Premium paywalls say about price and the free week, read from the
 * host (the SDK on a device, the studio in `superwall dev`) and never invented.
 *
 * Apple, "Auto-renewable subscriptions"
 * (https://developer.apple.com/app-store/subscriptions/), read 2026-09-25:
 * - "In the purchase flow, the amount that will be billed must be the most
 *   prominent pricing element in the layout." `yearlyPrice` leads every page, in
 *   the largest type; nothing below may be computed without it.
 * - "In the purchase flow for a free trial, clearly indicate how long the free
 *   trial lasts and the price billed once the free trial is over." So the free week
 *   is named only when the store says this person is eligible (`eligible === true`,
 *   never "not false"), its length is known and the price it turns into is on
 *   screen: `namesTrial`. Every other case gets copy with no trial in it.
 * - Breakdowns ("about $0.38 a week", "Save 80%") are "displayed in a subordinate
 *   position and size to the annual price"; they live on the plans page only.
 *
 * Every product read is guarded; numbers arrive as strings on a device, so they
 * pass through `Number()` before any arithmetic (docs: products).
 */

export type Plan = "yearly" | "weekly";

export type Offer = {
  /** The yearly price, store-formatted ("$19.99"). The amount billed. */
  yearlyPrice?: string;
  /** The weekly price, store-formatted ("$1.99"). */
  weeklyPrice?: string;
  /** The yearly price broken down per week by the store ("$0.38"). */
  yearlyPerWeek?: string;
  /** How much less Yearly costs than 52 weeks of Weekly, floored to a ten: 80. */
  savingsPercent?: number;
  /** Whether the free week may be named: eligible, its length and price known. */
  namesTrial: boolean;
  /** The free period in days; set only while `namesTrial`. */
  trialDays?: number;
  /** When the free week ends and the yearly price is billed. */
  trialEnd?: Date;
  /** Two calendar days before `trialEnd`, when it is still to come. */
  reminder?: Date;
  /** The device's locale for dates ("en-US"), when the host reported one. */
  locale?: string;
  /** "100 lessons across 10 paths", when the app passed both counts. */
  lessonCount?: number;
  pathCount?: number;
};

/** The app schedules its own reminder two calendar days before the free week ends
 * (PremiumStore.reminderDaysBeforeTrialEnds); the timeline names that day. */
const REMINDER_DAYS_BEFORE_END = 2;

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

const positive = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
};

/** "en_US" (as the SDK reports it) to "en-US", or undefined if Intl refuses it. */
const localeTag = (value: unknown): string | undefined => {
  const raw = text(value)?.replace(/_/g, "-");
  if (!raw) return undefined;
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([raw]).length > 0 ? raw : undefined;
  } catch {
    return undefined;
  }
};

const normalizeMonth = (value: string): string => value.toLocaleLowerCase().replace(/\./g, "").trim();

const monthIndex = (name: string, locales: readonly (string | undefined)[]): number | undefined => {
  const wanted = normalizeMonth(name);
  for (const locale of locales) {
    for (let month = 0; month < 12; month += 1) {
      try {
        const short = new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2000, month, 1));
        if (normalizeMonth(short) === wanted) return month;
      } catch {
        break;
      }
    }
  }
  return undefined;
};

/**
 * The product's `trialPeriodEndDate`, which the host formats as "Oct 2, 2026" (the
 * month in the device's language). Read back into a date at the current time of
 * day; anything unreadable, past, or more than 400 days out is ignored so the
 * caller falls back to today + `trialPeriodDays`.
 */
const parseTrialEnd = (
  value: unknown,
  locales: readonly (string | undefined)[],
  now: Date,
): Date | undefined => {
  const raw = text(value)?.trim();
  if (!raw) return undefined;

  let day: Date | undefined;
  const match = /^(.+?)\s+(\d{1,2}),?\s+(\d{4})$/u.exec(raw);
  if (match) {
    const month = monthIndex(match[1] ?? "", locales);
    if (month !== undefined) day = new Date(Number(match[3]), month, Number(match[2]));
  }
  if (!day) {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) day = new Date(parsed);
  }
  if (!day || Number.isNaN(day.getTime())) return undefined;

  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), now.getHours(), now.getMinutes());
  const daysAhead = (end.getTime() - now.getTime()) / 86_400_000;
  return daysAhead > 0 && daysAhead <= 400 ? end : undefined;
};

/**
 * The offer as this paywall may state it. `trialAtPurchase` holds the free week's
 * state from the moment a purchase starts: the store reports the free week used
 * before the purchase returns, and without it the screen behind the store sheet
 * would turn into "Subscribe" as the sheet slides away (PaywallLayout).
 */
export const useOffer = (trialAtPurchase?: boolean): Offer => {
  const { getProduct } = useProducts();
  const { eligible } = useIntroductoryOffer();
  const { deviceLocale } = useDevice();
  const { locale: catalogLocale } = useTranslation();
  const { params } = useVariables();

  const yearly = getProduct("yearly")?.variables;
  const weekly = getProduct("weekly")?.variables;
  const lessonCount = positive(params.lessonCount);
  const pathCount = positive(params.pathCount);

  return React.useMemo(() => {
    const yearlyPrice = text(yearly?.price);
    const weeklyPrice = text(weekly?.price);
    const yearlyPerWeek = text(yearly?.weeklyPrice);
    const locale = localeTag(deviceLocale);

    let savingsPercent: number | undefined;
    const yearlyRaw = positive(yearly?.rawPrice);
    const weeklyRaw = positive(weekly?.rawPrice);
    const sameCurrency =
      !text(yearly?.currencyCode) || !text(weekly?.currencyCode) || yearly?.currencyCode === weekly?.currencyCode;
    if (yearlyPrice && weeklyPrice && yearlyRaw && weeklyRaw && sameCurrency) {
      const percent = Math.floor((1 - yearlyRaw / (weeklyRaw * 52)) * 10 + 1e-9) * 10;
      if (percent >= 10 && percent < 100) savingsPercent = percent;
    }

    const days = positive(yearly?.trialPeriodDays);
    const trialDays = days === undefined ? undefined : Math.trunc(days);
    const eligibleNow = trialAtPurchase ?? eligible === true;
    const namesTrial = eligibleNow && yearlyPrice !== undefined && trialDays !== undefined && trialDays > 0;

    let trialEnd: Date | undefined;
    let reminder: Date | undefined;
    if (namesTrial && trialDays !== undefined) {
      const now = new Date();
      trialEnd =
        parseTrialEnd(yearly?.trialPeriodEndDate, [locale, catalogLocale, "en-US"], now) ?? addDays(now, trialDays);
      const reminderDay = addDays(trialEnd, -REMINDER_DAYS_BEFORE_END);
      // A reminder whose day has gone is never scheduled, so never promised.
      reminder = reminderDay.getTime() > now.getTime() ? reminderDay : undefined;
    }

    return {
      yearlyPrice,
      weeklyPrice,
      yearlyPerWeek,
      savingsPercent,
      namesTrial,
      trialDays: namesTrial ? trialDays : undefined,
      trialEnd,
      reminder,
      locale,
      lessonCount,
      pathCount,
    };
  }, [yearly, weekly, eligible, trialAtPurchase, deviceLocale, catalogLocale, lessonCount, pathCount]);
};

/** "Wed, Sep 30" (or "Wednesday, September 30" with `long`), in the device's own
 * format, like the app's `date.formatted(.dateTime.weekday().month().day())`. */
export const formatDay = (date: Date, locale: string | undefined, long = false): string => {
  const options: Intl.DateTimeFormatOptions = long
    ? { weekday: "long", month: "long", day: "numeric" }
    : { weekday: "short", month: "short", day: "numeric" };
  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  }
};

/** The price a plan bills, if the store has sent it. */
export const priceOf = (offer: Offer, plan: Plan): string | undefined =>
  plan === "yearly" ? offer.yearlyPrice : offer.weeklyPrice;
