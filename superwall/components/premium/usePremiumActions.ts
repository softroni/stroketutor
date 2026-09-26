import * as React from "react";
import { useActions, useHaptics, usePurchase } from "superwall/hooks";
import type { Plan } from "./offer";

export type Notice = "purchaseFailed" | "restoreFailed";

/**
 * Buying, restoring and leaving, as the app's paywall does them (OfferPurchase,
 * RestoreButton, "Continue with free lessons").
 *
 * - `purchase()` never throws for flow outcomes: completed lets the SDK dismiss
 *   (postPurchase "dismiss", the default); abandoned is an ordinary outcome and
 *   says nothing; a store failure says "That did not go through". The button is
 *   never put in a loading state: the store sheet is the feedback.
 * - `restore()` resolves "failed" both when the store failed and when there was
 *   nothing to restore (the SDK cannot tell the paywall which), so its one line of
 *   copy covers both.
 */
export const usePremiumActions = () => {
  const { purchase } = usePurchase();
  const { close, restore, openUrl } = useActions();
  const haptics = useHaptics();
  const [trialAtPurchase, setTrialAtPurchase] = React.useState<boolean>();
  const [notice, setNotice] = React.useState<Notice>();

  const buy = React.useCallback(
    async (plan: Plan, namesTrial: boolean) => {
      haptics.light();
      setNotice(undefined);
      setTrialAtPurchase(namesTrial);
      const result = await purchase(plan);
      if (result.status === "completed") {
        haptics.success();
        return; // The flow moves on; the screen holds still until it has.
      }
      setTrialAtPurchase(undefined);
      if (result.status === "failed" && !("reason" in result && result.reason === "superseded")) {
        haptics.error();
        setNotice("purchaseFailed");
      }
    },
    [haptics, purchase],
  );

  const restorePurchases = React.useCallback(async () => {
    haptics.light();
    setNotice(undefined);
    const result = await restore();
    if (result.status === "restored") haptics.success();
    else setNotice("restoreFailed");
  }, [haptics, restore]);

  const continueFree = React.useCallback(() => {
    haptics.light();
    close();
  }, [close, haptics]);

  const open = React.useCallback(
    (url: string) => {
      haptics.light();
      openUrl(url);
    },
    [haptics, openUrl],
  );

  return { buy, restorePurchases, continueFree, open, trialAtPurchase, notice };
};
