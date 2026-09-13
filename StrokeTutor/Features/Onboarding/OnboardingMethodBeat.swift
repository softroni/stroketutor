import SwiftUI

/// `ob-2` — "Watch · Draw · Tap 'I drew it'". The core loop of the whole product in
/// three tiles that play out in order: a step draws itself, the learner copies it on
/// paper, the green button is pressed.
///
/// Six seconds, once, then everything holds. Continue is live from the first frame;
/// nothing here gates on the animation.
struct OnboardingMethodBeat: View {

    let lesson: Lesson?
    let rail: OnboardingRail
    let onContinue: () -> Void

    var body: some View {
        OnboardingBeatFrame(rail: rail) {
            TutorSays(pose: .pen,
                      text: "I draw one small step. You copy it onto your paper. Nothing moves until you say so.")

            VStack(spacing: Theme.stackSpacing) {
                MethodTile(eyebrow: "1 · Watch",
                           headline: "One step draws itself.",
                           footnote: "Then it stops and waits.") {
                    // The lesson's own opening shapes, at the tile's weight.
                    SelfDrawingView.lesson(lesson?.tutorial,
                                           steps: 2,
                                           duration: 2.4,
                                           delay: 0.4,
                                           lineWidthScale: 1.4)
                        .padding(8)
                }

                MethodTile(eyebrow: "2 · Draw",
                           headline: "You copy it on paper.",
                           footnote: "Take as long as you like.") {
                    HandDrawnSquare()
                }

                MethodTile(eyebrow: "3 · Tap",
                           headline: "Tap \"I drew it\".",
                           footnote: "The next step begins.") {
                    MiniDrewItButton()
                }
            }

            OnboardingNote("No timer. No countdown. The pace is yours.")
        } footer: {
            Button("Continue", action: onContinue)
                .buttonStyle(.primary)
        }
    }
}

// MARK: - One tile

/// A soft tile with an 88 pt piece of art on the left and three lines on the right
/// (`.ob-tile`). One VoiceOver element: the art carries nothing the words do not.
private struct MethodTile<Art: View>: View {
    let eyebrow: String
    let headline: String
    let footnote: String
    @ViewBuilder let art: () -> Art

    var body: some View {
        HStack(spacing: 16) {
            PaperTile { art() }
                .frame(width: 88, height: 88)

            VStack(alignment: .leading, spacing: 4) {
                Text(eyebrow)
                    .textRole(.eyebrow)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.green)
                Text(headline)
                    .textRole(.headline)
                    .foregroundStyle(Theme.ink)
                Text(footnote)
                    .textRole(.footnote)
                    .foregroundStyle(Theme.ink55)
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.leading, 12)
        .padding(.trailing, 16)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Theme.surface)
        )
        .accessibilityElement(children: .ignore)
        // "1, Watch. One step draws itself. Then it stops and waits."
        .accessibilityLabel("\(eyebrow.replacingOccurrences(of: " · ", with: ", ")). \(headline) \(footnote)")
    }
}

// MARK: - Tile two: the learner's own hand

/// A slightly wobbly square — the learner's hand, not the app's — drawing itself,
/// and the pen badge that pops just before it starts. The `d` is the mockup's.
private struct HandDrawnSquare: View {
    @Environment(\.onboardingReducesMotion) private var reducesMotion
    @State private var showsBadge = false

    var body: some View {
        SelfDrawingView.art([
            ArtStroke(d: "M 26 34 C 42 32 58 33 74 33 C 75 48 74 62 73 76 C 58 77 42 76 27 76 C 26 62 27 48 26 34 Z",
                      lineWidth: 4, start: 3.0, duration: 1.8)
        ])
        .overlay(alignment: .bottomTrailing) {
            Image(systemName: "pencil")
                .scaledFont(13, .bold, design: .default)
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(Circle().fill(Theme.ink))
                .padding(6)
                .scaleEffect(showsBadge ? 1 : 0.6)
                .opacity(showsBadge ? 1 : 0)
        }
        .task {
            guard !reducesMotion else {
                showsBadge = true
                return
            }
            try? await Task.sleep(for: .seconds(2.9))
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) { showsBadge = true }
        }
    }
}

// MARK: - Tile three: the player's own control

/// The player's primary button at 76 × 40, pressing itself once at 5.6 s so the
/// learner recognises the control on sight in their first lesson. Not tappable: a
/// tappable thing inside a beat would teach the wrong habit.
private struct MiniDrewItButton: View {
    @Environment(\.onboardingReducesMotion) private var reducesMotion
    @State private var isPressed = false

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "checkmark")
                .scaledFont(11, .heavy, design: .default)
            Text("I drew it")
                .scaledFont(13, .heavy)
                .fixedSize()
        }
        .foregroundStyle(.white)
        .frame(width: 76, height: 40)
        .background(
            RoundedRectangle(cornerRadius: 13, style: .continuous).fill(Theme.green)
        )
        .background(alignment: .bottom) {
            RoundedRectangle(cornerRadius: 13, style: .continuous)
                .fill(Theme.greenDeep)
                .frame(width: 76, height: 40)
                .offset(y: isPressed ? 0 : 4)
        }
        .offset(y: isPressed ? 4 : 0)
        .padding(.bottom, 4)
        .accessibilityHidden(true)
        .task {
            guard !reducesMotion else { return }
            try? await Task.sleep(for: .seconds(5.6))
            withAnimation(.easeInOut(duration: 0.14)) { isPressed = true }
            try? await Task.sleep(for: .milliseconds(140))
            withAnimation(.easeInOut(duration: 0.14)) { isPressed = false }
        }
    }
}
