/**
 * Paper Couch Premium, shared by both paywalls (US English, as the app). Prices are
 * never written here: they come from the store, formatted for the person's region,
 * and are interpolated as {price}. Every line that names the free week has a
 * sibling without it, for anyone the store says is not eligible.
 */
export default {
  premium: {
    restore: "Restore",
    restoreLabel: "Restore purchases",
    restoreFailed: "We couldn't find a Paper Couch Premium purchase to restore.",
    purchaseFailed: "That did not go through. Please try again.",

    price: "{price} per year",
    unpricedTitle: "Paper Couch Premium",
    trialLine: "Your first {days} days are free",
    trialLineOneDay: "Your first day is free",
    planLine: "Paper Couch Premium · renews yearly",
    planLineUnpriced: "Renews yearly",
    familySharing: "Family Sharing: up to 6 people",

    timeline: {
      today: "Today",
      todayDetail: "Every lesson unlocks. No payment now.",
      reminderDetail: "We send a reminder to this device if you allow notifications.",
      endDetail: "{price}/year starts. Cancel at least a day before to pay nothing.",
    },

    benefits: {
      lessons: "{lessons} lessons across {paths} paths",
      lessonsGeneric: "Every lesson on every path",
      lina: "Lina coaching every stroke",
      cancel: "Cancel anytime in Settings",
    },

    viewPlans: "View more plans",
    continueFree: "Continue with free lessons",
    terms: "Terms of Use",
    privacy: "Privacy",

    cta: {
      trialWeek: "Start my free week",
      trial: "Start my free trial",
      subscribe: "Subscribe",
      subscribeYearly: "Subscribe yearly",
      subscribeWeekly: "Subscribe weekly",
      thenPerYear: "then {price}/year",
      perYear: "{price}/year",
      perWeek: "{price}/week",
    },

    plans: {
      title: "Choose a plan",
      subtitle: "Paper Couch Premium · auto-renewing",
      close: "Close plans",
      yearly: "Yearly",
      weekly: "Weekly",
      save: "Save {percent}%",
      yearlyPrice: "{price}/year",
      weeklyPrice: "{price}/week",
      yearlyTrialDetail: "{days} days free, then billed yearly",
      yearlyTrialDetailOneDay: "1 day free, then billed yearly",
      yearlyDetail: "Billed every year",
      withPerWeek: "{detail} · about {perWeek} a week",
      weeklyDetail: "Billed every week",
      termsYearlyTrial: "Nothing to pay today. Then {price}/year. Cancel anytime.",
      termsYearly: "{price}/year. Cancel anytime.",
      termsWeekly: "{price}/week, starting today. Cancel anytime.",
    },
  },
} as const;
