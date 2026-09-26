import { useTranslation } from "superwall/hooks";
import type { Notice } from "./usePremiumActions";

/** Apple's standard licence and Softroni's privacy policy (LegalLinks). */
export const TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
export const PRIVACY_URL = "https://softroni.com/privacy-policy.html";

/**
 * A buy button (PurchaseLabel on the tactile primary): what it does, and under it
 * the price it bills — "Start my free week / then $19.99/year". A button that names
 * the free week always names the price that follows it; without a price it names
 * no trial at all (the caller passes the non-trial title).
 */
export function PrimaryButton({
  title,
  price,
  onClick,
}: {
  title: string;
  price?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="pc-primary" onClick={onClick}>
      <span className="pc-primary-title">{title}</span>
      {price ? <span className="pc-primary-price">{price}</span> : null}
    </button>
  );
}

/** "Restore" in the bar (RestoreButton). */
export function RestoreButton({ onRestore }: { onRestore: () => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" className="pc-bar-button" aria-label={t("premium.restoreLabel")} onClick={onRestore}>
      {t("premium.restore")}
    </button>
  );
}

/** "Continue with free lessons": the way out, right under the buy button. */
export function ContinueFreeButton({ onContinue }: { onContinue: () => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" className="pc-quiet" onClick={onContinue}>
      {t("premium.continueFree")}
    </button>
  );
}

/** Terms of Use and Privacy (LegalLinksRow), through openUrl, never an <a href>. */
export function LegalLinks({ onOpen }: { onOpen: (url: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="pc-legal">
      <button type="button" onClick={() => onOpen(TERMS_URL)}>
        {t("premium.terms")}
      </button>
      <button type="button" onClick={() => onOpen(PRIVACY_URL)}>
        {t("premium.privacy")}
      </button>
    </div>
  );
}

/** A failed purchase or an empty restore, said once, above the buy button. */
export function NoticeLine({ notice }: { notice?: Notice }) {
  const { t } = useTranslation();
  if (!notice) return null;
  return (
    <p className={`pc-notice${notice === "purchaseFailed" ? " pc-notice--error" : ""}`} role="status">
      {notice === "purchaseFailed" ? t("premium.purchaseFailed") : t("premium.restoreFailed")}
    </p>
  );
}
