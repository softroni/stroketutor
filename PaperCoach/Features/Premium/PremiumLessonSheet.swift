import SwiftUI
import UIKit

/// The drawer that comes up when a crowned lesson is tapped without Premium, over
/// whatever screen it was tapped on. It can always be closed.
///
/// **For everyone 13 and over**: the lesson's drawing with its crown, "Mushroom is
/// waiting for you", one line on what Premium holds, and "Start your free week"
/// (or "Subscribe to unlock", once the free week has been used), which goes
/// straight to the paywall. "Not now" closes it.
///
/// **For a child**: no price and no trial. "Mushroom needs a grown-up", "Ask a
/// grown-up" (the way to the parental check), and "Save it for later", which puts
/// the lesson on their wish list for the grown-up's paywall to show. Once a child
/// has closed it, further crowns only nudge (`AppModel.offerPremiumIfNeeded(for:)`).
struct PremiumLessonSheet: View {
    let lessonId: String

    @Environment(AppModel.self) private var app
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

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
        .presentationDetents(dynamicTypeSize.isAccessibilitySize ? [.large] : [.height(620), .large])
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
                            .foregroundStyle(Theme.ink40)
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
                    Text(isChild ? "\(lesson.title) needs a grown-up" : "\(lesson.title) is waiting for you")
                        .textRole(.title2)
                        .foregroundStyle(Theme.ink)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                    Text(isChild ? "Ask a grown-up to unlock it, or save it to your wish list for later."
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
        }
        .scrollBounceBehavior(.basedOnSize)
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
        // "Start your free week" only while the price it turns into can be shown
        // under it (`PremiumStore.canNameFreeWeek`).
        let isTrial = app.premium.canNameFreeWeek
        Button(isTrial ? "Start your free week" : "See Premium") {
            app.continueFromDrawer(to: .premiumLesson(lessonId: lesson.id))
        }
        .buttonStyle(.primary)
        .padding(.top, 8)

        Text(smallPrint(isTrial: isTrial))
            .textRole(.footnote)
            .foregroundStyle(Theme.ink70)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)

        Button("Not now") { app.closePremiumDrawer() }
            .buttonStyle(.quiet)
    }

    /// "7 days free, then $19.99/year. No payment now."
    private func smallPrint(isTrial: Bool) -> String {
        // No price yet: no trial claim either (`PremiumStore.canNameFreeWeek`).
        guard let yearly = app.premium.yearlyPrice else { return "Cancel anytime." }
        return isTrial
            ? "\(PremiumStore.trialDays) days free, then \(yearly)/year. No payment now."
            : "\(yearly)/year. Cancel anytime."
    }

    @ViewBuilder
    private func childActions(for lesson: Lesson) -> some View {
        let isWished = app.preferences.wishList.contains(lesson.id)
        Button("Ask a grown-up") {
            app.continueFromDrawer(to: .premiumLesson(lessonId: lesson.id))
        }
        .buttonStyle(.primary)
        .padding(.top, 8)

        Button {
            app.preferences.toggleWish(lesson.id)
        } label: {
            Label(isWished ? "On your wish list" : "Save it for later",
                  systemImage: isWished ? "star.fill" : "star")
        }
        .buttonStyle(.secondary)
        .accessibilityValue(isWished ? "Saved" : "")

        Button("Not now") { app.closePremiumDrawer() }
            .buttonStyle(.quiet)
    }
}

/// What a child sees after closing the drawer once, when they tap another crown:
/// Lina's face and "Ask a grown-up to unlock Mushroom", for a moment, over the top
/// of the screen. Tapping it brings the drawer back.
struct PremiumNudgeToast: View {
    let nudge: PremiumNudge

    @Environment(AppModel.self) private var app

    var body: some View {
        Button {
            app.openDrawer(for: nudge)
        } label: {
            HStack(spacing: 10) {
                LinaFace(size: 34)
                Text("Ask a grown-up to unlock \(nudge.title)")
                    .scaledFont(15, .heavy)
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                CrownBadge(size: 26)
            }
            .padding(.vertical, 10)
            .padding(.leading, 10)
            .padding(.trailing, 14)
            .background(Capsule().fill(Theme.card))
            .overlay(Capsule().strokeBorder(Theme.line, lineWidth: 2))
            .floatShadow()
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Theme.gutter)
        .accessibilityLabel("Ask a grown-up to unlock \(nudge.title)")
        .accessibilityHint("Opens the lesson’s drawer")
        .task(id: nudge.id) {
            UIAccessibility.post(notification: .announcement,
                                 argument: "Ask a grown-up to unlock \(nudge.title)")
            try? await Task.sleep(for: .seconds(2.8))
            guard !Task.isCancelled, app.premiumNudge?.id == nudge.id else { return }
            app.premiumNudge = nil
        }
    }
}
