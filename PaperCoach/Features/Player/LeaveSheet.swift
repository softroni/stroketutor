import SwiftUI

/// `pl-leave` — the sheet the close button opens. It asks once, makes one promise —
/// your place is kept — and the app keeps it. Not a guilt gate: no "give up?", no
/// streak, no count of what is unfinished.
///
/// **Keep drawing** is ink rather than green: green is reserved for going forward,
/// and staying is the safe default, not progress. **Leave** is a quiet text button
/// in no destructive colour, because nothing is destroyed.
struct LeaveSheet: View {
    /// The step the learner is on, one-based — the number the button on the preview
    /// will show them.
    let stepNumber: Int
    let onKeepDrawing: () -> Void
    let onLeave: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Text("Leave this drawing?")
                .textRole(.title2)
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)

            Text("Your place is kept. You can come back to step \(stepNumber) whenever you like.")
                .textRole(.bodyRegular)
                .foregroundStyle(Theme.ink55)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            Button("Keep drawing", action: onKeepDrawing)
                .buttonStyle(.inkFilled)
                .padding(.top, 10)

            Button("Leave", action: onLeave)
                .buttonStyle(.quiet)
                .frame(maxWidth: .infinity)
                .accessibilityLabel("Leave this lesson. Your place is kept.")
        }
        .padding(.top, 20)
        .padding(.horizontal, Theme.gutter)
        .padding(.bottom, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.card)
    }
}
