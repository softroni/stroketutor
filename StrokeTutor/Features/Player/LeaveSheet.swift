import SwiftUI

/// `pl-leave` — the sheet the close button opens. Leaving stores the step, so the
/// lesson preview can offer to continue; nothing is lost and nothing is scolded.
struct LeaveSheet: View {
    let stepNumber: Int
    let onKeepDrawing: () -> Void
    let onLeave: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            Text("Leave this lesson?")
                .textRole(.title2)
                .foregroundStyle(Theme.ink)
            Text("You are on step \(stepNumber). It will be here when you come back.")
                .textRole(.body)
                .foregroundStyle(Theme.ink55)
                .fixedSize(horizontal: false, vertical: true)

            Button("Keep drawing", action: onKeepDrawing)
                .buttonStyle(.primary)
            Button("Leave", action: onLeave)
                .buttonStyle(.quiet)
                .frame(maxWidth: .infinity)
        }
        .padding(Theme.gutter)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card)
    }
}
