import SwiftUI

/// About & credits: what the app is, where the reference pictures come from, and
/// the one privacy sentence. The credits are read from the catalog, so a new lesson
/// brings its own credit with it.
struct AboutView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                Text("StrokeTutor teaches drawing one step at a time. Everything stays on this iPhone.")
                    .textRole(.body)
                    .foregroundStyle(Theme.ink70)
                    .fixedSize(horizontal: false, vertical: true)

                Text("Reference pictures".uppercased())
                    .textRole(.eyebrow)
                    .foregroundStyle(Theme.ink55)
                    .padding(.horizontal, 6)
                    .padding(.top, 10)

                ListCard {
                    ForEach(Array(credits.enumerated()), id: \.offset) { index, credit in
                        if index > 0 { RowDivider() }
                        SettingsRow(title: credit.title, subtitle: credit.detail)
                    }
                }
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.vertical, Theme.stackSpacing)
        }
        .background(Theme.page)
        .navigationTitle("About & credits")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var credits: [(title: String, detail: String)] {
        app.paths.flatMap(\.lessons).compactMap { lesson in
            guard let reference = lesson.reference else { return nil }
            return (lesson.title, "\(reference.source) · \(reference.license)")
        }
    }
}
