import { definePaywall } from "superwall/config";

/**
 * Paper Coach Premium: the web rebuild of the app's paywall
 * (PaperCoach/Features/Premium/PaywallView.swift). Pages: `index` (the paywall)
 * and `plans` (the app's "View more plans" sheet). The components, strings and art
 * are shared with `premium-gift` from superwall/components, messages and assets.
 *
 * No `notifications.trialReminder`: the app schedules its own reminder two days
 * before the free week ends (TrialReminder), and the timeline promises exactly that.
 * No `introductoryOfferEligibility`: the store decides ("automatic").
 */
export default definePaywall({
  name: "Premium",
  products: {
    yearly: "com.softroni.papercoach.premium.yearly",
    weekly: "com.softroni.papercoach.premium.weekly",
  },
  // The app is light only: white behind the paywall in both schemes.
  background: { light: "#FFFFFF", dark: "#FFFFFF" },
});
