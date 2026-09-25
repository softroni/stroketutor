import SwiftUI

// MARK: - The frame

/// The shape of every screen on the way to Premium: an optional 56 pt bar, a body
/// centred in the space left and scrolling only when it has to, and the buttons
/// pinned to the bottom. Like `OnboardingBeatFrame`, without the rail — these
/// screens are one message each, not steps of a questionnaire.
struct OfferScreenFrame<Top: View, Content: View, Footer: View>: View {
    private let top: () -> Top
    private let content: () -> Content
    private let footer: () -> Footer
    private let hasTop: Bool

    init(@ViewBuilder top: @escaping () -> Top,
         @ViewBuilder content: @escaping () -> Content,
         @ViewBuilder footer: @escaping () -> Footer) {
        self.top = top
        self.content = content
        self.footer = footer
        hasTop = true
    }

    var body: some View {
        VStack(spacing: 0) {
            if hasTop {
                top()
                    .padding(.horizontal, 8)
                    .frame(height: 56)
            }

            GeometryReader { geometry in
                ScrollView {
                    VStack(spacing: 18) {
                        content()
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, Theme.gutter)
                    .padding(.vertical, 12)
                    .frame(minHeight: geometry.size.height)
                }
                .scrollBounceBehavior(.basedOnSize)
            }

            VStack(spacing: Theme.stackSpacing) {
                footer()
            }
            .padding(.top, Theme.stackSpacing)
            .padding(.horizontal, Theme.gutter)
            .padding(.bottom, Theme.stackSpacing)
            .background(Theme.page)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.page.ignoresSafeArea())
    }
}

extension OfferScreenFrame where Top == EmptyView {
    init(@ViewBuilder content: @escaping () -> Content,
         @ViewBuilder footer: @escaping () -> Footer) {
        self.top = { EmptyView() }
        self.content = content
        self.footer = footer
        hasTop = false
    }
}

// MARK: - Small shared pieces

/// A green check and one line: what Premium gives.
struct OfferBenefitRow: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: "checkmark")
                .scaledFont(15, .heavy, design: .default)
                .foregroundStyle(Theme.green)
            Text(text)
                .textRole(.headline)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
    }
}

/// The three things Premium gives, the same on every paywall.
struct OfferBenefits: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            OfferBenefitRow("\(lessonCount) lessons across \(pathCount) paths")
            OfferBenefitRow("Lina coaching every stroke")
            OfferBenefitRow("Cancel anytime in Settings")
        }
    }

    private var lessonCount: Int {
        app.paths.reduce(0) { $0 + $1.lessonCount }
    }

    private var pathCount: Int {
        app.paths.filter { !$0.isEmpty }.count
    }
}

/// Restore, and the two links a subscription screen must carry: the terms of use
/// (Apple's standard licence) and the privacy policy.
enum LegalLinks {
    static let terms = URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!
    static let privacy = URL(string: "https://softroni.com/privacy-policy.html")!
}

struct LegalLinksRow: View {
    var body: some View {
        HStack(spacing: 20) {
            Link("Terms of Use", destination: LegalLinks.terms)
            Link("Privacy", destination: LegalLinks.privacy)
        }
        .scaledFont(13, .semibold)
        .foregroundStyle(Theme.ink55)
        .tint(Theme.ink55)
        .frame(maxWidth: .infinity)
    }
}

/// "Restore" in the top bar: asks the App Store for this account's purchases.
struct RestoreButton: View {
    let onRestored: () -> Void

    @Environment(AppModel.self) private var app
    @State private var isRestoring = false
    @State private var failure: RestoreFailure?

    private enum RestoreFailure {
        case nothingFound, unreachable
    }

    var body: some View {
        Button {
            guard !isRestoring else { return }
            isRestoring = true
            Task {
                let outcome = await app.premium.restore()
                isRestoring = false
                switch outcome {
                case .restored:
                    app.analytics.track(.purchaseAttempted(plan: "restore", outcome: "restored"))
                    onRestored()
                case .nothingToRestore:
                    app.analytics.track(.purchaseAttempted(plan: "restore", outcome: "nothing_found"))
                    failure = .nothingFound
                case .failed:
                    app.analytics.track(.purchaseAttempted(plan: "restore", outcome: "failed"))
                    failure = .unreachable
                }
            }
        } label: {
            Group {
                if isRestoring {
                    ProgressView()
                } else {
                    Text("Restore")
                }
            }
            .scaledFont(15, .bold)
            .foregroundStyle(Theme.ink55)
            .padding(.horizontal, 8)
            .frame(minHeight: Theme.navTapTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Restore purchases")
        .alert(failure == .unreachable ? "Could not restore" : "Nothing to restore",
               isPresented: Binding(get: { failure != nil }, set: { if !$0 { failure = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(failure == .unreachable
                 ? "The App Store could not be reached. Check the connection and try again."
                 : "This Apple Account has no Paper Coach Premium to restore.")
        }
    }
}

/// What the paywalls do with a purchase: buy the plan, report the outcome for
/// analytics, and hand it to the flow.
@MainActor
enum OfferPurchase {
    static func buy(_ plan: PremiumStore.Plan,
                    app: AppModel,
                    onOutcome: @escaping (PremiumStore.PurchaseOutcome) -> Void) {
        guard let product = app.premium.product(for: plan) else { return }
        Task {
            let outcome = await app.premium.purchase(product)
            app.analytics.track(.purchaseAttempted(plan: plan.rawValue, outcome: "\(outcome)"))
            onOutcome(outcome)
        }
    }
}

/// While the App Store has not answered, or could not be reached: a quiet line,
/// and a way to try again. The way out stays on screen either way.
struct OfferLoadingState: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        switch app.premium.loadState {
        case .failed:
            VStack(spacing: 8) {
                Text("The App Store could not be reached.")
                    .textRole(.subhead)
                    .foregroundStyle(Theme.ink55)
                    .multilineTextAlignment(.center)
                Button("Try again") {
                    Task { await app.premium.loadProducts() }
                }
                .buttonStyle(.quietLink)
            }
        default:
            ProgressView()
                .frame(minHeight: 64)
        }
    }
}
