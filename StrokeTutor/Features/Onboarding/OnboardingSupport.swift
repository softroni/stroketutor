import SwiftUI

// MARK: - Motion

private struct OnboardingReducesMotionKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    /// True when the flow must hold still: the system's Reduce Motion setting, or
    /// the app's own override in Settings. `OnboardingFlow` resolves the two once
    /// and every beat reads this instead of asking twice.
    var onboardingReducesMotion: Bool {
        get { self[OnboardingReducesMotionKey.self] }
        set { self[OnboardingReducesMotionKey.self] = newValue }
    }
}

// MARK: - The rail

/// The onboarding rail (`.ob-rail`): a 44 pt back chevron, a 14 pt green progress
/// bar, and "Skip" on the beats that may be skipped. 56 pt tall, 4 pt in from the
/// left so the chevron's tap target reaches the edge.
///
/// The bar is the learner's only sense of how long this is; it never goes backwards
/// without the chevron being pressed.
struct OnboardingRail: View {

    /// 0...1.
    let progress: Double
    /// What VoiceOver reads for the bar: "Step 2 of 6".
    let stepLabel: String
    var onBack: (() -> Void)?
    var onSkip: (() -> Void)?

    @Environment(\.onboardingReducesMotion) private var reducesMotion

    var body: some View {
        HStack(spacing: 12) {
            Button {
                onBack?()
            } label: {
                Image(systemName: "chevron.left")
                    .scaledFont(20, .bold, design: .default)
                    .foregroundStyle(Theme.ink)
                    .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            // The launch beat is not a place the learner can return to, so beat one
            // keeps the chevron's space and hides the control itself.
            .opacity(onBack == nil ? 0 : 1)
            .disabled(onBack == nil)
            .accessibilityHidden(onBack == nil)

            track

            if let onSkip {
                Button {
                    onSkip()
                } label: {
                    Text("Skip")
                        .scaledFont(15, .bold)
                        .foregroundStyle(Theme.ink55)
                        .padding(.horizontal, 8)
                        .frame(minHeight: Theme.navTapTarget)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint("Goes straight to choosing a path")
            }
        }
        .padding(.leading, 4)
        .padding(.trailing, 12)
        .frame(height: 56)
    }

    private var track: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.surface2)
                Capsule()
                    .fill(Theme.green)
                    .frame(width: geometry.size.width * min(max(progress, 0), 1))
            }
        }
        .frame(height: 14)
        .frame(maxWidth: .infinity)
        .animation(reducesMotion ? nil : .easeOut(duration: 0.3), value: progress)
        .accessibilityElement()
        .accessibilityLabel(stepLabel)
    }
}

// MARK: - The beat frame

/// The shape every onboarding beat after the launch takes: the rail, a body that
/// scrolls only when it has to, and the buttons pinned to the bottom
/// (`.screen-body.ob-body` over `.bottom-area`).
///
/// The body is always inside a `ScrollView` with a minimum height of the space
/// available, so spacers still push things apart at ordinary text sizes and the
/// whole thing scrolls at the accessibility ones — with the buttons never moving.
struct OnboardingBeatFrame<Content: View, Footer: View>: View {

    let rail: OnboardingRail
    @ViewBuilder var content: () -> Content
    @ViewBuilder var footer: () -> Footer

    var body: some View {
        VStack(spacing: 0) {
            rail

            GeometryReader { geometry in
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        content()
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Theme.gutter)
                    .padding(.vertical, 8)
                    .frame(minHeight: geometry.size.height, alignment: .top)
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

// MARK: - Lina and her line

/// Lina beside what she is saying (`.tutor-says`): her portrait and a speech bubble
/// with the tail pointing at her.
///
/// At the accessibility text sizes there is no room for both side by side, so the
/// bubble takes the full width and Lina stands underneath it — the tail then points
/// down at her, which is also the order VoiceOver should read them in.
struct TutorSays: View {
    let pose: LinaView.Pose
    let text: String
    /// Her drawn height. 192 on beat one (`lina--lg`), 124 elsewhere (`lina--md`).
    var size: CGFloat = 124

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        if typeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                SpeechBubble(text: text, tail: .below)
                LinaView(pose: pose, size: 76)
            }
        } else {
            HStack(alignment: .top, spacing: Theme.stackSpacing) {
                LinaView(pose: pose, size: size)
                SpeechBubble(text: text)
            }
        }
    }
}

// MARK: - Small shared pieces

/// A line of quiet body copy centred under a beat's illustration — "No timer. No
/// countdown. The pace is yours." 17/medium at `--ink-55`.
struct OnboardingNote: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .textRole(.body)
            .foregroundStyle(Theme.ink55)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity)
    }
}

extension PathModel {
    /// The subject glyph the path wears in onboarding, matching the icons of
    /// `ob-path`. A path the catalog adds later gets the neutral mark rather than a
    /// wrong one.
    var onboardingSymbol: String {
        switch id {
        case "houses": return "house"
        case "trees": return "tree"
        case "cars": return "car"
        case "flowers": return "camera.macro"
        case "mountains": return "mountain.2"
        case "streets", "streets-and-places": return "signpost.right"
        default: return "scribble"
        }
    }
}

/// A sheet of white paper with a drawing on it (`.thumb`, `.ob-tile-art`): white,
/// a 2 pt `--line` border, and the picture inside.
struct PaperTile<Content: View>: View {
    var cornerRadius: CGFloat = Theme.thumbCornerRadius
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(2)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(Theme.paper)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(Theme.line, lineWidth: 2)
            )
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }
}
