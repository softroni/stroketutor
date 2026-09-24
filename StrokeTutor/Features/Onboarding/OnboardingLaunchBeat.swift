import SwiftUI

/// `ob-splash` — the launch beat. White page, the first lesson drawing itself in a
/// 292 pt square, the wordmark under it and one quiet line. The product before a
/// word of copy: no gradient, no logo lockup.
///
/// It holds for at least 0.9 s and then goes on as soon as the catalog is ready,
/// mid-drawing if need be — the v3 note is explicit that the drawing may be cut off
/// rather than the learner kept waiting for it.
struct OnboardingLaunchBeat: View {

    let lesson: Lesson?
    let onFinished: () -> Void

    @Environment(AppModel.self) private var app

    /// The shortest time the launch may be on screen. Below this it reads as a flash
    /// rather than as the app opening.
    private let minimumHold: Duration = .seconds(0.9)

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)

            VStack(spacing: 4) {
                SelfDrawingView.lesson(lesson?.tutorial,
                                       duration: 3.45,
                                       delay: 0.25,
                                       // The launch drawing is bolder than a lesson
                                       // thumbnail on purpose (v3 note, ob-splash).
                                       lineWidthScale: 1.35)
                    .frame(width: 292, height: 292)

                Text("Paper Coach")
                    .scaledFont(40, .heavy, relativeTo: .largeTitle)
                    .tracking(-1)
                    .foregroundStyle(Theme.ink)

                Text("Pen, paper, five minutes.")
                    .textRole(.body)
                    .foregroundStyle(Theme.ink55)
            }
            .padding(.horizontal, Theme.gutter)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Paper Coach")
            .accessibilityAddTraits(.isHeader)

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.page.ignoresSafeArea())
        .task {
            try? await Task.sleep(for: minimumHold)
            // The catalog is loaded before the cover is presented; this is the
            // belt-and-braces case where it is not yet.
            while !app.hasLoadedContent && !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(50))
            }
            guard !Task.isCancelled else { return }
            onFinished()
        }
    }
}
