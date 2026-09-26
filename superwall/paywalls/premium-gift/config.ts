import { definePaywall } from "superwall/config";

/**
 * Paper Coach Premium as a gift: `index` (the gift moment), then `paywall` (the
 * same page as `premium`'s index) and its `plans` page. Components, strings and art
 * are shared with `premium` from superwall/components, messages and assets.
 *
 * No `notifications.trialReminder`: the app schedules its own reminder.
 * No `introductoryOfferEligibility`: the store decides ("automatic").
 */
export default definePaywall({
  name: "Premium — gift",
  products: {
    yearly: "com.softroni.papercoach.premium.yearly",
    weekly: "com.softroni.papercoach.premium.weekly",
  },
  // The app is light only: white behind the paywall in both schemes.
  background: { light: "#FFFFFF", dark: "#FFFFFF" },
});
