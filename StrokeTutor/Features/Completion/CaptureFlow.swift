import SwiftUI

/// `sk-capture` — photograph the page: the primer with its three promises, the
/// camera (or the photo picker in the simulator), the review, and the saved state.
///
/// Phase 1 is the shell that lets the flow be walked: it explains what will happen
/// and leads on to the sketchbook. Nothing is written to the sketchbook yet, and no
/// camera or library permission is requested until Phase 2 builds the real flow.
struct CaptureFlow: View {
    let lesson: Lesson

    @Environment(AppModel.self) private var app

    var body: some View {
        VStack(spacing: Theme.stackSpacing) {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                    Text("Photograph your page")
                        .textRole(.title1)
                        .foregroundStyle(Theme.ink)
                    Text("The photo stays on this iPhone. It goes in your sketchbook, not to Photos, unless you ask.")
                        .textRole(.body)
                        .foregroundStyle(Theme.ink55)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("The camera opens here once this screen is built.")
                        .textRole(.subhead)
                        .foregroundStyle(Theme.ink40)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, Theme.stackSpacing)
            }

            Button("Open your sketchbook") {
                app.dismissCover()
                app.selectedTab = .sketchbook
            }
            .buttonStyle(.primary)

            Button("Done") { app.dismissCover() }
                .buttonStyle(.quiet)
                .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, Theme.gutter)
        .padding(.bottom, Theme.stackSpacing)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.page.ignoresSafeArea())
    }
}
