import SwiftUI

/// The guided first run's second stop: the Sketchbook, open on the path the first
/// lesson belongs to. The page just drawn sits in its slot — the photo, or the
/// lesson's outline with a gold camera when the photo was skipped — and every
/// other lesson of the path shows as an empty slot, so the learner sees at a glance
/// how much there is still to draw.
///
/// Not the Sketchbook tab: no Paths / Dates switch, no tab bar, no other paths, and
/// the slots are pictures rather than doors. One line from Lina and one way on,
/// "Continue", to the offer (`AppModel.startFirstRunOffer()`).
struct FirstRunSketchbookView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.stackSpacing + 4) {
                    Text("Sketchbook")
                        .textRole(.largeTitle)
                        .foregroundStyle(Theme.ink)
                        .accessibilityAddTraits(.isHeader)

                    TutorSays(pose: .point,
                              text: linaLine,
                              size: dynamicTypeSize.isAccessibilitySize ? 76 : 88)

                    if let path {
                        AlbumBand(album: SketchbookView.album(for: path, in: app),
                                  isBrowsable: false)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Theme.gutter)
                .padding(.top, 6)
                .padding(.bottom, 16)
            }
            .scrollBounceBehavior(.basedOnSize)

            Button("Continue") { app.startFirstRunOffer() }
                .buttonStyle(.primary)
                .padding(.horizontal, Theme.gutter)
                .padding(.vertical, Theme.stackSpacing)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.page.ignoresSafeArea())
        .onAppear {
            app.analytics.track(.offerScreenViewed("sketchbook_tour", entry: OfferEntry.onboarding.analyticsName))
        }
    }

    /// The first run's path, or the current one if its lesson is gone.
    private var path: PathModel? {
        app.firstRunLesson.flatMap { app.path(id: $0.pathId) } ?? app.currentPath
    }

    /// "This is your sketchbook. One down, nine to go."
    private var linaLine: String {
        guard let path else { return "This is your sketchbook. Every drawing you finish gets a place here." }
        let drawn = max(1, app.progress.drawnCount(in: path))
        let left = max(0, path.lessonCount - drawn)
        guard left > 0 else { return "This is your sketchbook. Every drawing you finish gets a place here." }
        return "This is your sketchbook. \(Self.spelled(drawn).capitalizedFirst) down, \(Self.spelled(left)) to go."
    }

    private static func spelled(_ number: Int) -> String {
        spellOut.string(from: NSNumber(value: number)) ?? "\(number)"
    }

    private static let spellOut: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .spellOut
        return formatter
    }()
}

private extension String {
    /// "one" → "One".
    var capitalizedFirst: String {
        self.prefix(1).uppercased() + self.dropFirst()
    }
}
