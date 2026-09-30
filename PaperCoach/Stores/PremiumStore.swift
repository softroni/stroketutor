import Foundation
import Observation
import OSLog
import StoreKit
import UserNotifications

/// Paper Coach Premium, through StoreKit 2: the two subscriptions and Lifetime,
/// whether the learner's Apple account holds one, and buying or restoring it.
///
/// One subscription group with two plans. **Yearly** carries the introductory
/// offer, a free week; **Weekly** has none. **Lifetime** is a one-time purchase
/// (a non-consumable) outside the group: one payment, Premium for good, and what
/// friends and family get from a free code. All three are Family Sharing, so one
/// grown-up's purchase unlocks every learner on every device in the family. The
/// ids below must match App Store Connect exactly; `PaperCoach.storekit` at the
/// repository root mirrors them for testing in Xcode (Scheme › Run › Options ›
/// StoreKit Configuration).
///
/// **Any product in the group unlocks Premium**, not only these two: a price test
/// adds products to it (a $39.99 yearly, say) that Superwall's paywalls sell, and
/// what they charge for must unlock (`Holding.unlocksPremium`).
///
/// Premium belongs to the device's Apple account, not to a learner: every profile
/// on the device shares it. The last answer is cached in `UserDefaults` so a launch
/// shows the right crowns before StoreKit has answered, and is then corrected.
@Observable
@MainActor
final class PremiumStore {

    /// The three plans the app's own paywalls sell.
    enum ProductID {
        static let yearly = "com.softroni.papercoach.premium.yearly"
        static let weekly = "com.softroni.papercoach.premium.weekly"
        /// Non-consumable, in no subscription group: it counts by its id.
        static let lifetime = "com.softroni.papercoach.premium.lifetime"
        static let all: Set<String> = [yearly, weekly, lifetime]
    }

    /// Premium's subscription group in App Store Connect, "Paper Coach Premium"
    /// (`docs/app-store/listing.md`). `PaperCoach.storekit` uses the same id, so a
    /// run in Xcode unlocks the same way.
    nonisolated static let subscriptionGroupID = "22413930"

    /// The free week on Yearly. The screens say "7 days", so this is the one number
    /// to change with the offer in App Store Connect.
    nonisolated static let trialDays = 7
    /// The reminder promised on the offer screens comes this many days before the
    /// trial ends: day 5 of 7.
    nonisolated static let reminderDaysBeforeTrialEnds = 2

    /// In the order the plans sheet lists them (`PaywallPlansSheet`).
    enum Plan: String, CaseIterable, Identifiable {
        case yearly, weekly, lifetime
        var id: String { rawValue }

        /// The plan a product belongs to, for a purchase that started from a
        /// product rather than a plan (a Superwall paywall's). A subscription's is
        /// read from how often it renews, not its id: a price test's yearly product
        /// is Yearly too.
        init?(_ product: Product) {
            if product.id == ProductID.lifetime {
                self = .lifetime
                return
            }
            guard let period = product.subscription?.subscriptionPeriod else { return nil }
            self.init(period: period)
        }

        /// Yearly for a year, Weekly for a week; nil for any other period.
        init?(period: Product.SubscriptionPeriod) {
            switch (period.unit, period.value) {
            case (.year, 1): self = .yearly
            // StoreKit 1 could give a week as seven days.
            case (.week, 1), (.day, 7): self = .weekly
            default: return nil
            }
        }
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

    enum RestoreOutcome: Equatable {
        /// The account holds Premium.
        case restored
        /// The App Store answered, and there is nothing to restore.
        case nothingToRestore
        /// The App Store could not be asked: offline, or sign-in cancelled.
        case failed
    }

    enum LoadState: Equatable {
        case idle, loading, loaded, failed
    }

    /// True while the Apple account holds an active subscription, trial included.
    /// In a debug build, the override in Settings can say otherwise
    /// (`debugOverride`).
    var isPremium: Bool {
        #if DEBUG
        switch debugOverride {
        case .appStore: break
        case .locked: return false
        case .unlocked: return true
        }
        #endif
        return holdsPremium
    }

    /// What StoreKit last said about the Apple account, whatever the override: an
    /// active subscription, or Lifetime.
    private(set) var holdsPremium: Bool {
        didSet {
            defaults.set(holdsPremium, forKey: Self.cacheKey)
            onPremiumChange?()
        }
    }

    /// Called whenever `isPremium` may have changed: after every read of the
    /// entitlement, and when the development override moves. `SuperwallPaywalls`
    /// keeps Superwall's subscription status in step through it. It runs straight
    /// away, not later, so a purchase or restore has told Superwall before it
    /// returns — the SDK checks the status the moment its purchase controller answers.
    @ObservationIgnored var onPremiumChange: (() -> Void)?

    /// Called once for each code that brings Premium: redeemed in the app ("Redeem a
    /// code" in Settings) or from a link in the App Store, including by someone in the
    /// family. With the plan it brought (`Plan.rawValue`), or the product id for a
    /// product that is none of the three. `AppModel` sends it as `premium_from_code`.
    @ObservationIgnored var onPremiumFromCode: ((String) -> Void)?

    /// Development only: "Premium" in Settings can lock or unlock every lesson
    /// without buying anything, to try both sides of the paywall. Always
    /// `.appStore` in a release build, which never reads or writes it.
    enum DebugOverride: String, CaseIterable, Identifiable {
        case appStore, locked, unlocked
        var id: String { rawValue }
    }
    private(set) var debugOverride: DebugOverride = .appStore
    private(set) var yearly: Product?
    private(set) var weekly: Product?
    private(set) var lifetime: Product?
    private(set) var loadState: LoadState = .idle
    /// Whether this Apple account can still have the free week. Assumed true until
    /// StoreKit says otherwise, but never named on screen before it has: the products,
    /// and so the price the free week must sit beside (`canNameFreeWeek`), are set only
    /// once this is known (`loadProducts()`).
    private(set) var isEligibleForTrial = true
    /// When the free week in use ends, for the reminder; nil outside a trial.
    private(set) var trialEndsAt: Date?
    /// The product the free week in use was started on, for the price it turns into
    /// (`priceAfterTrial`); nil outside a trial, or if the App Store could not name it.
    private(set) var trialProduct: Product?
    private(set) var isPurchasing = false

    @ObservationIgnored private var updatesTask: Task<Void, Never>?
    /// Every product StoreKit has handed over, by id: the two plans, and whatever a
    /// Superwall paywall sold. So a free week's product is named without asking again.
    @ObservationIgnored private var knownProducts: [Product.ID: Product] = [:]
    private let defaults: UserDefaults
    private static let log = Logger(subsystem: "com.softroni.papercoach", category: "premium")

    static let cacheKey = "premiumActive"
    static let debugOverrideKey = "premiumDebugOverride"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        holdsPremium = defaults.bool(forKey: Self.cacheKey)
        #if DEBUG
        debugOverride = defaults.string(forKey: Self.debugOverrideKey)
            .flatMap(DebugOverride.init(rawValue:)) ?? .appStore
        #endif
    }

    #if DEBUG
    /// Sets the development override and keeps it across launches.
    func setDebugOverride(_ choice: DebugOverride) {
        debugOverride = choice
        defaults.set(choice.rawValue, forKey: Self.debugOverrideKey)
        onPremiumChange?()
    }
    #endif

    // MARK: - Starting

    /// Listens for transactions made elsewhere — an Ask to Buy approved on a
    /// parent's phone, a renewal, a refund — and loads the products and the
    /// entitlement once. Called by `AppRoot` at launch; safe to call again.
    func start() {
        guard updatesTask == nil else { return }
        updatesTask = Task { [weak self] in
            for await update in Transaction.updates {
                switch update {
                case let .verified(transaction):
                    await transaction.finish()
                    await self?.reportIfFromCode(transaction)
                case let .unverified(transaction, error):
                    // It unlocks nothing, but left unfinished it would be delivered
                    // again on every launch.
                    Self.log.error("An unverified transaction was ignored: \(error.localizedDescription, privacy: .public)")
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
        case .lifetime: return lifetime
        }
    }

    /// Loads the three plans. A failure leaves the paywall showing a retry, never a
    /// price it made up.
    func loadProducts() async {
        guard loadState != .loading else { return }
        loadState = .loading
        do {
            let products = try await Product.products(for: Array(ProductID.all))
            let loadedYearly = products.first { $0.id == ProductID.yearly }
            // Eligibility first, then the products: the moment a price is on screen,
            // so is the right answer about the free week. The other way round, an
            // account that has used it would see "First 7 days free" for as long as
            // StoreKit took to say so.
            if let loadedYearly {
                isEligibleForTrial = await Self.trialEligibility(of: loadedYearly)
            }
            for product in products { knownProducts[product.id] = product }
            yearly = loadedYearly
            weekly = products.first { $0.id == ProductID.weekly }
            lifetime = products.first { $0.id == ProductID.lifetime }
            // Yearly is the plan every paywall leads with; without it there is
            // nothing to show but the retry.
            loadState = yearly == nil ? .failed : .loaded
        } catch {
            Self.log.error("Products could not be loaded: \(error.localizedDescription, privacy: .public)")
            loadState = .failed
        }
    }

    /// Asks StoreKit whether this account can still have the free week. Called when
    /// the products load and whenever the entitlement changes, so a trial used or
    /// refunded during this launch is not offered again.
    private func refreshTrialEligibility() async {
        guard let yearly else { return }
        isEligibleForTrial = await Self.trialEligibility(of: yearly)
    }

    /// Whether Yearly carries a free week this account can still have.
    private static func trialEligibility(of yearly: Product) async -> Bool {
        guard let subscription = yearly.subscription, subscription.introductoryOffer != nil else { return false }
        return await subscription.isEligibleForIntroOffer
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

    /// "$99.99", paid once.
    var lifetimePrice: String? { lifetime?.displayPrice }

    /// "$29.99/year": what the free week in use turns into, from the product it was
    /// started on, since a price test's product may cost more or less than Yearly.
    /// Yearly's outside a trial (the debug harness's made-up week). Nil when that
    /// product could not be loaded, or renews other than yearly or weekly: the screen
    /// then names the plan rather than a price it was not given.
    var priceAfterTrial: String? {
        guard let product = trialEndsAt == nil ? yearly : trialProduct,
              let period = product.subscription?.subscriptionPeriod else { return nil }
        return Self.price(product.displayPrice, per: period)
    }

    /// "$39.99/year" for a yearly product, "$2.99/week" for a weekly one; nil for any
    /// other period.
    nonisolated static func price(_ displayPrice: String, per period: Product.SubscriptionPeriod) -> String? {
        switch Plan(period: period) {
        case .yearly: return "\(displayPrice)/year"
        case .weekly: return "\(displayPrice)/week"
        case .lifetime, nil: return nil
        }
    }

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
        var holdings: [Holding] = []
        for await result in Transaction.currentEntitlements {
            guard case let .verified(transaction) = result else { continue }
            holdings.append(Holding(transaction))
        }
        let entitlement = Entitlement(holdings)
        holdsPremium = entitlement.isActive
        // The product before the date: "trial started" shows once the date is set,
        // and names this product's price.
        trialProduct = await product(id: entitlement.trialProductID)
        trialEndsAt = entitlement.trialEndsAt
        await refreshTrialEligibility()
        await TrialReminder.sync(trialEndsAt: entitlement.trialEndsAt)
    }

    /// A verified transaction the Apple account holds, as far as Premium cares:
    /// plain values, so the rules below are tested without buying anything.
    struct Holding: Equatable {
        let productID: String
        let subscriptionGroupID: String?
        let revocationDate: Date?
        /// Bought with the introductory offer: a free week.
        let isFreeTrial: Bool
        /// When a subscription's period ends; nil for Lifetime.
        let expirationDate: Date?
        /// Shared by someone in the family rather than bought on this Apple account.
        /// It counts the same: every product is Family Sharing.
        var isFamilyShared = false
        /// Redeemed with an offer code rather than bought.
        var isFromCode = false
        /// A subscription renewing, rather than a purchase or a redemption.
        var isRenewal = false

        /// Any product in Premium's subscription group unlocks it, whatever its id or
        /// price, and so does Lifetime, unless refunded or revoked. The three plans
        /// count by id (Lifetime is in no group), so nothing a subscriber holds today
        /// rests on the group id alone.
        var unlocksPremium: Bool {
            guard revocationDate == nil else { return false }
            return subscriptionGroupID == PremiumStore.subscriptionGroupID || ProductID.all.contains(productID)
        }

        /// A code that has just brought Premium: reported once, not again with each
        /// renewal a code's free months may carry.
        var bringsPremiumFromCode: Bool {
            isFromCode && !isRenewal && unlocksPremium
        }
    }

    /// What the holdings add up to: Premium or not, and the free week in use, with
    /// the product it was started on. Only what unlocks Premium counts.
    struct Entitlement: Equatable {
        let isActive: Bool
        let trialEndsAt: Date?
        let trialProductID: String?

        init(_ holdings: [Holding]) {
            let premium = holdings.filter(\.unlocksPremium)
            let trial = premium.last { $0.isFreeTrial }
            isActive = !premium.isEmpty
            trialEndsAt = trial?.expirationDate
            trialProductID = trial?.productID
        }
    }

    /// Tells `onPremiumFromCode` of a code that has just brought Premium, with the
    /// plan it brought.
    private func reportIfFromCode(_ transaction: Transaction) async {
        guard Holding(transaction).bringsPremiumFromCode else { return }
        let plan = await product(id: transaction.productID).flatMap(Plan.init)
        onPremiumFromCode?(plan?.rawValue ?? transaction.productID)
    }

    /// A product by id: one StoreKit has already handed over, or asked for.
    private func product(id: Product.ID?) async -> Product? {
        guard let id else { return nil }
        if let known = knownProducts[id] { return known }
        do {
            let product = try await Product.products(for: [id]).first
            knownProducts[id] = product
            return product
        } catch {
            Self.log.warning("The product \(id, privacy: .public) could not be loaded: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    // MARK: - Buying

    /// Buys `product`. Both paywalls come here: the native ones with no options, and
    /// Superwall's through `SuperwallPurchaseController`, which passes the options
    /// its product carries (an introductory-offer eligibility token, a billing plan).
    func purchase(_ product: Product, options: Set<Product.PurchaseOption> = []) async -> PurchaseOutcome {
        guard !isPurchasing else { return .cancelled }
        isPurchasing = true
        defer { isPurchasing = false }
        knownProducts[product.id] = product
        do {
            let result = try await product.purchase(options: options)
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
    /// Says whether the account holds Premium afterwards, whatever the development
    /// override says, or that the App Store could not be asked at all.
    @discardableResult
    func restore() async -> RestoreOutcome {
        var synced = true
        do {
            try await AppStore.sync()
        } catch {
            synced = false
            Self.log.warning("Restore did not finish: \(error.localizedDescription, privacy: .public)")
        }
        await refreshEntitlements()
        if holdsPremium { return .restored }
        return synced ? .nothingToRestore : .failed
    }
}

extension PremiumStore.Holding {
    init(_ transaction: Transaction) {
        let isFromCode: Bool
        if #available(iOS 17.2, *) {
            isFromCode = transaction.offer?.type == .code
        } else {
            isFromCode = transaction.offerType == .code
        }
        self.init(productID: transaction.productID,
                  subscriptionGroupID: transaction.subscriptionGroupID,
                  revocationDate: transaction.revocationDate,
                  isFreeTrial: transaction.offerType == .introductory,
                  expirationDate: transaction.expirationDate,
                  isFamilyShared: transaction.ownershipType == .familyShared,
                  isFromCode: isFromCode,
                  isRenewal: transaction.reason == .renewal)
    }
}

// MARK: - The trial reminder

/// The one notification the offer screens promise: two days before the free week
/// ends. It is only scheduled once permission is given — asked on the "trial
/// started" screen (`TrialStartedView`), the first time a free week really begins,
/// and never before — and is taken away as soon as there is no trial to remind about.
enum TrialReminder {

    static let identifier = "trial-ending"

    /// When the reminder comes: `PremiumStore.reminderDaysBeforeTrialEnds` calendar
    /// days before the free week ends, at the same time of day — so across a change
    /// to or from daylight saving it still falls on the day the screens name ("two
    /// days before"). The screens that name the date use this too, so what they
    /// promise is what is scheduled.
    static func reminderDate(trialEndsAt: Date, calendar: Calendar = .current) -> Date {
        calendar.date(byAdding: .day, value: -PremiumStore.reminderDaysBeforeTrialEnds, to: trialEndsAt)
            ?? trialEndsAt.addingTimeInterval(-Double(PremiumStore.reminderDaysBeforeTrialEnds) * 86_400)
    }

    /// Asks for permission if it has never been asked, then schedules. For the
    /// moment a trial has just begun: the one button of `TrialStartedView`.
    static func requestAndSchedule(trialEndsAt: Date?) async {
        // No trial, or a reminder whose day has already gone (the App Store
        // sandbox's free week lasts minutes): nothing to remind about, so never ask
        // for a permission this purchase does not need.
        if let trialEndsAt,
           TrialSchedule(endingAt: trialEndsAt).remindsAfter(Date()),
           await PracticeReminderScheduler.authorization() == .notDetermined {
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
        let fireDate = reminderDate(trialEndsAt: trialEndsAt)
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

    /// "Paper Coach Premium starts on Thursday. Keep drawing with Lina, or cancel in
    /// Settings at least a day before." A day, not "any time before then": Apple
    /// (https://support.apple.com/en-us/118428, read 2026-09-25) says to cancel a
    /// trial "at least 24 hours before the trial ends".
    static func body(trialEndsAt: Date) -> String {
        "Paper Coach Premium starts on \(weekday.string(from: trialEndsAt)). Keep drawing with Lina, or cancel in Settings at least a day before."
    }

    private static let weekday: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("EEEE")
        return formatter
    }()
}

/// The free week's dates, as the offer screens name them: the day the reminder
/// comes and the day the price starts. Plain values, so the tests read the same
/// dates as the screens.
struct TrialSchedule: Equatable {
    /// The reminder, `PremiumStore.reminderDaysBeforeTrialEnds` days before the end.
    let reminder: Date
    /// The end of the free week: the yearly price is billed from here.
    let end: Date

    /// A free week that would start at `start`: what the paywall's timeline lays
    /// out before anything is bought.
    init(startingAt start: Date, calendar: Calendar = .current) {
        let end = calendar.date(byAdding: .day, value: PremiumStore.trialDays, to: start)
            ?? start.addingTimeInterval(Double(PremiumStore.trialDays) * 86_400)
        self.init(endingAt: end)
    }

    /// A free week that has started and ends at `end`, the date StoreKit gives
    /// (`PremiumStore.trialEndsAt`).
    init(endingAt end: Date, calendar: Calendar = .current) {
        self.end = end
        reminder = TrialReminder.reminderDate(trialEndsAt: end, calendar: calendar)
    }

    /// Whether the reminder is still to come at `now`. It is not when the free week
    /// ends within two days: in the App Store sandbox, where App Review and TestFlight
    /// buy and a week lasts about three minutes, or for a free week already under
    /// way. `TrialReminder.sync` schedules nothing then, so no screen may promise it.
    func remindsAfter(_ now: Date) -> Bool {
        reminder > now
    }
}
