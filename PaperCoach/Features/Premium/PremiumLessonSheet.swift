import SwiftUI
import UIKit

/// The drawer that comes up when a crowned lesson is tapped without Premium, over
/// whatever screen it was tapped on — on every tap, never an intro screen first. It
/// can always be closed: the X, "Not now", or a swipe down. Human Interface
/// Guidelines › Modality (https://developer.apple.com/design/human-interface-guidelines/modality),
/// read 2026-09-25: "Always give people an obvious way to dismiss a modal view."
///
/// **For everyone 13 and over**: the lesson's drawing with its crown, "Mushroom is
/// waiting for you", one line on what Premium holds, then the price — "$19.99 per
/// year", with "First 7 days free" under it, smaller and green, while the free week
/// is on offer ("Cancel anytime" once it has been used) — and "See Premium", which
/// opens the paywall and starts nothing. "Not now" closes it.
///
/// The price is the largest pricing element here too. Apple, "Auto-renewable
/// subscriptions" (https://developer.apple.com/app-store/subscriptions/), read
/// 2026-09-25: "the amount that will be billed must be the most prominent pricing
/// element in the layout." The free week is never named without that price beside
/// it (`PremiumStore.canNameFreeWeek`), and before the App Store has answered there
/// is neither.
///
/// **For a child**: no price, no trial, and no appeal to go and get a grown-up to
/// buy it. An advertisement's "direct appeal to children to buy advertised products
/// or persuade their parents or other adults to buy advertised products for them"
/// is banned outright (UK Digital Markets, Competition and Consumers Act 2024,
/// Schedule 20 para 30, in force 6 April 2025; EU Unfair Commercial Practices
/// Directive, Annex I point 28). So: "Mushroom is a Premium lesson", "Save it for
/// later" (the wish list the grown-up's paywall shows), a free lesson to draw
/// instead — the next one on this lesson's own path while it has one, else one from
/// another path (`AppModel.freeLessonInstead(of:)`) — "Not now", and a quiet "For
/// grown-ups" link — the way to the parental check. Once a child has closed it,
/// further crowns only nudge (`AppModel.offerPremiumIfNeeded(for:)`).
///
/// "Save it for later" is the green button until it is pressed. Then it steps back
/// to a white "On your wish list" and the free lesson turns green: the loudest
/// button never takes the wish away, and there is always one clear next step. A
/// second tap within a moment of the first is ignored, so a young child's double tap
/// does not undo it; a deliberate tap on "On your wish list" later still does.
///
/// The drawer is as tall as what it holds (measured), so neither version leaves a
/// band of empty sheet under "Not now"; with accessibility text sizes it opens full
/// height and scrolls.
struct PremiumLessonSheet: View {
    let lessonId: String

    @Environment(AppModel.self) private var app
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    /// The height of everything in the drawer, for its detent; nil until measured.
    @State private var contentHeight: CGFloat?
    /// When the wish list last changed from this drawer, to ignore a double tap.
    @State private var lastWishChange: Date?

    var body: some View {
        Group {
            if let lesson = app.lesson(id: lessonId) {
                content(for: lesson)
            } else {
                Color.clear.onAppear { app.closePremiumDrawer() }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.card)
        .presentationDetents(detents)
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(28)
    }

    private func content(for lesson: Lesson) -> some View {
        let isChild = app.learnerIsChild
        return ScrollView {
            VStack(spacing: Theme.stackSpacing) {
                HStack {
                    Spacer()
                    Button {
                        app.closePremiumDrawer()
                    } label: {
                        Image(systemName: "xmark")
                            .scaledFont(17, .bold, design: .default)
                            .foregroundStyle(Theme.ink55)
                            .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Close")
                }
                .padding(.bottom, -20)

                picture(of: lesson)

                VStack(spacing: 8) {
                    if !isChild {
                        Chip(text: "Premium lesson", systemImage: "crown.fill", style: .gold)
                    }
                    Text(isChild ? "\(lesson.title) is a Premium lesson" : "\(lesson.title) is waiting for you")
                        .textRole(.title2)
                        .foregroundStyle(Theme.ink)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                    Text(isChild ? "Save it to your wish list, and keep drawing the free lessons."
                                 : explanation(for: lesson))
                        .textRole(.bodyRegular)
                        .foregroundStyle(Theme.ink55)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 8)

                if isChild {
                    childActions(for: lesson)
                } else {
                    actions(for: lesson)
                }
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.top, 8)
            .padding(.bottom, Theme.stackSpacing)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: {
                contentHeight = $0.rounded(.up)
            }
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    /// The drawer's height: its content's, once measured (620 pt until then), and
    /// full height on offer; full height only with accessibility text sizes.
    private var detents: Set<PresentationDetent> {
        if dynamicTypeSize.isAccessibilitySize { return [.large] }
        return [.height(contentHeight ?? 620), .large]
    }

    /// The drawing, big, on white, with its crown.
    private func picture(of lesson: Lesson) -> some View {
        DrawingThumbnail(tutorial: lesson.tutorial, strokeColor: nil, showsFills: true)
            .padding(24)
            .frame(width: 176, height: 176)
            .background(
                RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous)
                    .fill(Theme.surface)
            )
            .overlay(alignment: .bottomTrailing) {
                CrownBadge(size: 42).offset(x: 10, y: 10)
            }
            .accessibilityElement()
            .accessibilityLabel("The finished drawing of \(lesson.subject). Premium.")
    }

    /// "Lessons 4 to 10 on every path are Premium. That's 70 more drawings."
    private func explanation(for lesson: Lesson) -> String {
        let first = PremiumAccess.freeLessonsPerPath + 1
        let premiumCount = app.paths.reduce(0) { total, path in
            total + max(0, path.lessonCount - PremiumAccess.freeLessonsPerPath)
        }
        let longest = app.paths.map(\.lessonCount).max() ?? first
        return "Lessons \(first) to \(longest) on every path are Premium. That’s \(premiumCount) more drawings to make with Lina."
    }

    // MARK: - The ways on

    @ViewBuilder
    private func actions(for lesson: Lesson) -> some View {
        if let yearly = app.premium.yearlyPrice {
            price(yearly: yearly)
                .padding(.top, 4)
        }

        // "See Premium" whatever the offer: this button opens the paywall, where
        // the price and the free week are laid out; it starts nothing itself.
        Button("See Premium") {
            app.continueFromDrawer(to: .premiumLesson(lessonId: lesson.id))
        }
        .buttonStyle(.primary)
        .padding(.top, 4)

        Button("Not now") { app.closePremiumDrawer() }
            .buttonStyle(.quiet)
    }

    /// "$19.99 per year", and under it, smaller and green, "First 7 days free" while
    /// the free week is on offer, or "Cancel anytime" once it has been used. The
    /// billed amount is the largest of the two, and the only one in ink. One
    /// VoiceOver element.
    private func price(yearly: String) -> some View {
        VStack(spacing: 2) {
            Text("\(yearly) per year")
                .scaledFont(20, .heavy, relativeTo: .title3)
                .foregroundStyle(Theme.ink)
            if app.premium.canNameFreeWeek {
                Text("First \(PremiumStore.trialDays) days free")
                    .textRole(.subhead)
                    .foregroundStyle(Theme.greenDeep)
            } else {
                Text("Cancel anytime")
                    .textRole(.footnote)
                    .foregroundStyle(Theme.ink55)
            }
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private func childActions(for lesson: Lesson) -> some View {
        let isWished = app.preferences.wishList.contains(lesson.id)
        Button {
            toggleWish(lesson)
        } label: {
            Label(isWished ? "On your wish list" : "Save it for later",
                  systemImage: isWished ? "star.fill" : "star")
        }
        // Green until saved; then white, and the free lesson below takes the green.
        .buttonStyle(TactileButtonStyle(variant: isWished ? .secondary : .primary))
        .accessibilityValue(isWished ? "Saved" : "")
        .padding(.top, 4)

        if let free = app.freeLessonInstead(of: lesson) {
            Button("Draw \(free.title)") {
                app.drawFreeLesson(fromDrawer: free)
            }
            .buttonStyle(TactileButtonStyle(variant: isWished ? .primary : .secondary))
        }

        Button("Not now") { app.closePremiumDrawer() }
            .buttonStyle(.quiet)

        // For the grown-up, not the child: small, grey, last. It leads to "This
        // part is for a grown-up" and the parental check.
        Button {
            app.continueFromDrawer(to: .premiumLesson(lessonId: lesson.id))
        } label: {
            Text("For grown-ups")
                .scaledFont(15, .bold)
                .underline()
                .foregroundStyle(Theme.ink55)
                .frame(minHeight: Theme.navTapTarget)
                .padding(.horizontal, 8)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// Saves the lesson to the wish list, or takes it off — but not on a second tap
    /// within a moment of the last change, which is a double tap, not a change of
    /// mind.
    private func toggleWish(_ lesson: Lesson) {
        let now = Date()
        if let lastWishChange, now.timeIntervalSince(lastWishChange) < 1 { return }
        lastWishChange = now
        app.preferences.toggleWish(lesson.id)
        app.analytics.track(.wishListChanged(lessonId: lesson.id,
                                             added: app.preferences.wishList.contains(lesson.id)))
    }
}

/// What a child sees after closing the drawer once, when they tap another crown:
/// the crown and "Mushroom is a Premium lesson", for a moment, over the top of the
/// screen. A fact, not an appeal to go and ask for it (see `PremiumLessonSheet`).
/// Tapping it brings the drawer back.
struct PremiumNudgeToast: View {
    let nudge: PremiumNudge

    @Environment(AppModel.self) private var app

    var body: some View {
        Button {
            app.openDrawer(for: nudge)
        } label: {
            HStack(spacing: 10) {
                CrownBadge(size: 30)
                Text(message)
                    .scaledFont(15, .heavy)
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.vertical, 10)
            .padding(.leading, 10)
            .padding(.trailing, 16)
            .background(Capsule().fill(Theme.card))
            .overlay(Capsule().strokeBorder(Theme.line, lineWidth: 2))
            .floatShadow()
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Theme.gutter)
        .accessibilityLabel(message)
        .accessibilityHint("Opens the lesson’s drawer")
        .task(id: nudge.id) {
            UIAccessibility.post(notification: .announcement, argument: message)
            try? await Task.sleep(for: .seconds(2.8))
            guard !Task.isCancelled, app.premiumNudge?.id == nudge.id else { return }
            app.premiumNudge = nil
        }
    }

    /// "Mushroom is a Premium lesson".
    private var message: String { "\(nudge.title) is a Premium lesson" }
}
