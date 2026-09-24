import Foundation
import Observation
import OSLog
import StoreKit
import UserNotifications

/// Paper Coach Premium, through StoreKit 2: the two subscriptions, whether the
/// learner's Apple account holds one, and buying or restoring it.
///
/// One subscription group with two plans. **Yearly** carries the introductory
/// offer, a free week; **Weekly** has none. Both are Family Sharing, so one
/// grown-up's purchase unlocks every learner on every device in the family. The
/// ids below must match App Store Connect exactly; `PaperCoach.storekit` at the
/// repository root mirrors them for testing in Xcode (Scheme › Run › Options ›
/// StoreKit Configuration).
///
/// Premium belongs to the device's Apple account, not to a learner: every profile
/// on the device shares it. The last answer is cached in `UserDefaults` so a launch
/// shows the right crowns before StoreKit has answered, and is then corrected.
@Observable
@MainActor
final class PremiumStore {

    enum ProductID {
        static let yearly = "com.softroni.papercoach.premium.yearly"
        static let weekly = "com.softroni.papercoach.premium.weekly"
        static let all: Set<String> = [yearly, weekly]
    }

    /// The free week on Yearly. The screens say "7 days", so this is the one number
    /// to change with the offer in App Store Connect.
    static let trialDays = 7
    /// The reminder promised on the offer screens comes this many days before the
    /// trial ends: day 5 of 7.
    static let reminderDaysBeforeTrialEnds = 2

    enum Plan: String, CaseIterable, Identifiable {
        case yearly, weekly
        var id: String { rawValue }
    }

    enum PurchaseOutcome: Equatable {
        /// The subscription is active now.
        case purchased
        /// Ask to Buy: a family organizer has to approve it first.
        case pending
        /// "Restore" found an active subscription on this Apple account.
        case restored
        case cancelled
        case failed
    }

    enum LoadState: Equatable {
        case idle, loading, loaded, failed
    }

    /// True while the Apple account holds an active subscription, trial included.
    private(set) var isPremium: Bool {
        didSet { defaults.set(isPremium, forKey: Self.cacheKey) }
    }
    private(set) var yearly: Product?
    private(set) var weekly: Product?
    private(set) var loadState: LoadState = .idle
    /// Whether this Apple account can still have the free week. Assumed true until
    /// StoreKit says otherwise, so the offer screens are not wrong while it loads.
    private(set) var isEligibleForTrial = true
    /// When the free week in use ends, for the reminder; nil outside a trial.
    private(set) var trialEndsAt: Date?
    private(set) var isPurchasing = false

    @ObservationIgnored private var updatesTask: Task<Void, Never>?
    private let defaults: UserDefaults
    private static let log = Logger(subsystem: "com.softroni.papercoach", category: "premium")

    static let cacheKey = "premiumActive"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        isPremium = defaults.bool(forKey: Self.cacheKey)
    }

    // MARK: - Starting

    /// Listens for transactions made elsewhere — an Ask to Buy approved on a
    /// parent's phone, a renewal, a refund — and loads the products and the
    /// entitlement once. Called by `AppRoot` at launch; safe to call again.
    func start() {
        guard updatesTask == nil else { return }
        updatesTask = Task { [weak self] in
            for await update in Transaction.updates {
                if case let .verified(transaction) = update {
                    await transaction.finish()
                }
                await self?.refreshEntitlements()
            }
        }
        Task {
            await refreshEntitlements()
            await loadProducts()
        }
    }

    // MARK: - Products

    func product(for plan: Plan) -> Product? {
        switch plan {
        case .yearly: return yearly
        case .weekly: return weekly
        }
    }

    /// Loads both plans. A failure leaves the paywall showing a retry, never a
    /// price it made up.
    func loadProducts() async {
        guard loadState != .loading else { return }
        loadState = .loading
        do {
            let products = try await Product.products(for: Array(ProductID.all))
            yearly = products.first { $0.id == ProductID.yearly }
            weekly = products.first { $0.id == ProductID.weekly }
            if let subscription = yearly?.subscription, subscription.introductoryOffer != nil {
                isEligibleForTrial = await subscription.isEligibleForIntroOffer
            } else if yearly != nil {
                isEligibleForTrial = false
            }
            loadState = (yearly == nil && weekly == nil) ? .failed : .loaded
        } catch {
            Self.log.error("Products could not be loaded: \(error.localizedDescription, privacy: .public)")
            loadState = .failed
        }
    }

    /// "$19.99", Yearly's price as the App Store writes it for this storefront.
    var yearlyPrice: String? { yearly?.displayPrice }

    /// Whether a price block may name the free week: only beside the price it turns
    /// into. Apple (https://developer.apple.com/app-store/subscriptions/, read
    /// 2026-09-24): "the amount that will be billed must be the most prominent
    /// pricing element", and a free trial must state "the price billed once the free
    /// trial is over". With the App Store unreachable there is no price, so no trial
    /// claim either.
    var canNameFreeWeek: Bool { isEligibleForTrial && yearlyPrice != nil }

    /// Yearly divided by 52, in the same currency: "$0.38", to set beside
    /// Weekly's price.
    var yearlyPricePerWeek: String? {
        guard let yearly else { return nil }
        return (yearly.price / 52).formatted(yearly.priceFormatStyle)
    }

    /// "$1.99".
    var weeklyPrice: String? { weekly?.displayPrice }

    /// How much less Yearly costs than 52 weeks of Weekly, rounded down to a
    /// whole ten: "80" for $19.99 against $1.99. Nil without both prices, or when
    /// the saving is too small to mention.
    var yearlySavingsPercent: Int? {
        guard let yearly, let weekly, weekly.price > 0 else { return nil }
        let ratio = NSDecimalNumber(decimal: yearly.price / (weekly.price * 52)).doubleValue
        let percent = Int((1 - ratio) * 10) * 10
        return percent >= 10 ? percent : nil
    }

    // MARK: - Entitlement

    /// Reads what the Apple account holds right now, and keeps the trial reminder
    /// in step with it.
    func refreshEntitlements() async {
        var active = false
        var trialEnd: Date?
        for await result in Transaction.currentEntitlements {
            guard case let .verified(transaction) = result,
                  ProductID.all.contains(transaction.productID),
                  transaction.revocationDate == nil else { continue }
            active = true
            if transaction.offerType == .introductory {
                trialEnd = transaction.expirationDate
            }
        }
        isPremium = active
        trialEndsAt = trialEnd
        await TrialReminder.sync(trialEndsAt: trialEnd)
    }

    // MARK: - Buying

    func purchase(_ product: Product) async -> PurchaseOutcome {
        guard !isPurchasing else { return .cancelled }
        isPurchasing = true
        defer { isPurchasing = false }
        do {
            let result = try await product.purchase()
            switch result {
            case let .success(verification):
                guard case let .verified(transaction) = verification else {
                    Self.log.error("A purchase could not be verified.")
                    return .failed
                }
                await transaction.finish()
                await refreshEntitlements()
                return .purchased
            case .pending:
                return .pending
            case .userCancelled:
                return .cancelled
            @unknown default:
                return .failed
            }
        } catch {
            Self.log.error("Purchase failed: \(error.localizedDescription, privacy: .public)")
            return .failed
        }
    }

    /// "Restore": asks the App Store for this account's purchases, then reads them.
    /// Returns whether Premium is active afterwards.
    @discardableResult
    func restore() async -> Bool {
        do {
            try await AppStore.sync()
        } catch {
            Self.log.warning("Restore did not finish: \(error.localizedDescription, privacy: .public)")
        }
        await refreshEntitlements()
        return isPremium
    }
}

// MARK: - The trial reminder

/// The one notification the offer screens promise: two days before the free week
/// ends. It is only scheduled once permission is given — asked on the reminder
/// screen of onboarding, or when a grown-up starts the week — and is taken away as
/// soon as there is no trial to remind about.
enum TrialReminder {

    static let identifier = "trial-ending"

    /// Asks for permission if it has never been asked, then schedules. For the
    /// moment a trial has just begun.
    static func requestAndSchedule(trialEndsAt: Date?) async {
        // No trial, nothing to remind about: never ask for a permission this
        // purchase does not need.
        if trialEndsAt != nil, await PracticeReminderScheduler.authorization() == .notDetermined {
            _ = await PracticeReminderScheduler.requestAuthorization()
        }
        await sync(trialEndsAt: trialEndsAt)
    }

    /// Makes what is pending match the trial: one request at the right moment, or
    /// none. Never shows the permission prompt.
    static func sync(trialEndsAt: Date?) async {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
        guard let trialEndsAt else { return }
        let fireDate = trialEndsAt.addingTimeInterval(-Double(PremiumStore.reminderDaysBeforeTrialEnds) * 86_400)
        guard fireDate > Date() else { return }
        guard await PracticeReminderScheduler.authorization() == .allowed else { return }

        let content = UNMutableNotificationContent()
        content.title = "Your free week ends soon"
        content.body = body(trialEndsAt: trialEndsAt)
        content.sound = .default

        let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate)
        let request = UNNotificationRequest(identifier: identifier,
                                            content: content,
                                            trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false))
        do {
            try await center.add(request)
        } catch {
            Logger(subsystem: "com.softroni.papercoach", category: "premium")
                .warning("Could not schedule the trial reminder: \(error.localizedDescription, privacy: .public)")
        }
    }

    /// "Paper Coach Premium starts on Thursday. Keep drawing with Lina, or cancel
    /// any time before then in Settings."
    static func body(trialEndsAt: Date) -> String {
        "Paper Coach Premium starts on \(weekday.string(from: trialEndsAt)). Keep drawing with Lina, or cancel any time before then in Settings."
    }

    private static let weekday: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("EEEE")
        return formatter
    }()
}
