import SwiftUI

/// About, credits and privacy — the v1 `st-about` restyled to v3, as one page
/// rather than three, because there is not enough of it to justify three pushes.
///
/// The photo credits are read from the bundled catalog at runtime, never from a
/// generated list, so a lesson added in the Studio brings its own credit with it and
/// the two can never drift apart. A lesson with no reference still gets a row: the
/// list is an audit of what shipped, not a selection.
struct AboutView: View {
    /// Which part of the page the push lands on. Settings has two rows into here.
    enum Section: Hashable {
        case about
        case privacy
    }

    var opensAt: Section = .about

    @Environment(AppModel.self) private var app

    private let privacyAnchor = "privacy"

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                    identity
                    whatItIs
                    credits
                    privacy
                    contact

                    Text("Made by Softroni")
                        .textRole(.footnote)
                        .foregroundStyle(Theme.ink40)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 10)
                        .padding(.bottom, 4)
                }
                .padding(.horizontal, Theme.gutter)
                .padding(.top, 4)
                .padding(.bottom, 16)
            }
            .background(Theme.page)
            .settingsNavigationBar("About & credits")
            .onAppear {
                guard opensAt == .privacy else { return }
                proxy.scrollTo(privacyAnchor, anchor: .top)
            }
        }
    }

    // MARK: - What the app is

    private var identity: some View {
        VStack(spacing: 8) {
            // `.thumb`: a small square of white paper with a drawing on it.
            Group {
                if let tutorial = firstTutorial {
                    DrawingThumbnail(tutorial: tutorial, size: 88)
                } else {
                    Image(systemName: "pencil")
                        .scaledFont(34, .semibold, design: .default)
                        .foregroundStyle(Theme.ink40)
                        .frame(width: 88, height: 88)
                }
            }
            .cardBackground(fill: Theme.paper, border: Theme.line, cornerRadius: 22)
            .accessibilityHidden(true)

            Text("StrokeTutor")
                .textRole(.title2)
                .foregroundStyle(Theme.ink)
            Text("Version \(SettingsFormat.version())")
                .textRole(.footnote)
                .foregroundStyle(Theme.ink55)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
        .padding(.bottom, 4)
        .accessibilityElement(children: .combine)
    }

    private var firstTutorial: PreparedTutorial? {
        app.currentPath?.lessons.first?.tutorial
            ?? app.paths.first(where: { !$0.isEmpty })?.lessons.first?.tutorial
    }

    private var whatItIs: some View {
        SettingsCard {
            Text("StrokeTutor teaches you to draw on real paper. Each lesson animates one small step, then stops and waits while you draw that step yourself.")
                .textRole(.bodyRegular)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Photo credits

    @ViewBuilder
    private var credits: some View {
        SettingsSectionHeader("Photo credits")
        SettingsCaption("Every reference picture used in a lesson, with its source and licence.")

        if app.paths.allSatisfy(\.isEmpty) {
            SettingsCard(isSoft: true) {
                Text("No lessons are installed, so there is nothing to credit.")
                    .textRole(.bodyRegular)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
            }
        } else {
            ForEach(app.paths.filter { !$0.isEmpty }) { path in
                SettingsSectionHeader(path.title)
                ListCard {
                    ForEach(Array(path.lessons.enumerated()), id: \.element.id) { index, lesson in
                        if index > 0 { RowDivider() }
                        SettingsCustomRow(title: lesson.title,
                                          subtitle: Self.creditLine(for: lesson)) {
                            // The lesson's own drawing, not the reference picture:
                            // at 40 pt a photograph is a smudge, and the drawing is
                            // what the reader is looking for the credit of.
                            SettingsIconTile(tint: .neutral) {
                                DrawingThumbnail(tutorial: lesson.tutorial, size: 32)
                            }
                        } trailing: {
                            EmptyView()
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }

        SettingsCaption("Pictures are used as references for the drawings only.")
    }

    /// "Pixabay · Pixabay Content License", or the honest line for a drawing that
    /// started from nothing.
    static func creditLine(for lesson: Lesson) -> String {
        guard let reference = lesson.reference else {
            return "Drawn from scratch · no photograph"
        }
        return "\(sourceName(reference.source)) · \(reference.license)"
    }

    /// `reference.source` is a slug today and sometimes a URL. Show a name a reader
    /// recognises, and fall back to the raw string rather than hiding a source.
    static func sourceName(_ source: String) -> String {
        let trimmed = source.trimmingCharacters(in: .whitespacesAndNewlines)
        let host = URL(string: trimmed)?.host?
            .replacingOccurrences(of: "www.", with: "")
            .components(separatedBy: ".").first
        let slug = (host ?? trimmed).lowercased()
        switch slug {
        case "pixabay": return "Pixabay"
        case "unsplash": return "Unsplash"
        case "pexels": return "Pexels"
        case "wikimedia", "commons": return "Wikimedia Commons"
        case "": return trimmed
        default: return slug.prefix(1).uppercased() + slug.dropFirst()
        }
    }

    // MARK: - Privacy

    @ViewBuilder
    private var privacy: some View {
        SettingsSectionHeader("Privacy")
            .id(privacyAnchor)

        Text("Everything stays on this iPhone.")
            .textRole(.title2)
            .foregroundStyle(Theme.ink)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 4)
            .accessibilityAddTraits(.isHeader)

        ListCard {
            statement("No account, no sign-in",
                      "There is nothing to create and nothing to log in to.",
                      symbol: "lock.fill")
            RowDivider()
            statement("Your sketchbook is yours",
                      "Photos of your pages are stored inside the app on this iPhone. Turn on “Also save to Photos” if you also want them in your photo library.",
                      symbol: "book")
            RowDivider()
            statement("Nothing is measured",
                      "No analytics, no tracking, no advertising identifiers.",
                      symbol: "eye")
            RowDivider()
            statement("Nothing leaves the app",
                      "StrokeTutor makes no network connection at all.",
                      symbol: "doc")
            RowDivider()
            statement("Deleting the app deletes everything",
                      "Including your sketchbook, unless you saved copies to Photos.",
                      symbol: "trash",
                      tint: .neutral)
        }

        SettingsCard(isSoft: true) {
            VStack(alignment: .leading, spacing: 8) {
                Text("The camera")
                    .textRole(.headline)
                    .foregroundStyle(Theme.ink)
                Text("The camera is used in one place: photographing your finished page. The photo goes straight into your sketchbook on this iPhone.")
                    .textRole(.bodyRegular)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    /// The privacy list is read as statements. They do nothing, so they are not
    /// buttons.
    private func statement(_ title: String,
                           _ detail: String,
                           symbol: String,
                           tint: SettingsRow.Tint = .green) -> some View {
        SettingsCustomRow(title: title, subtitle: detail) {
            SettingsIconTile(symbol: symbol, tint: tint)
        } trailing: {
            EmptyView()
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - Contact

    @ViewBuilder
    private var contact: some View {
        SettingsSectionHeader("Contact")
        ListCard {
            // TODO (creator): App Store review requires a real, monitored address.
            // Put it here — and in the App Store listing — before the first
            // submission. Nothing else on this screen is a placeholder.
            SettingsCustomRow(title: "Contact",
                              subtitle: "TODO: the creator has not chosen a support address yet.") {
                SettingsIconTile(symbol: "envelope", tint: .neutral)
            } trailing: {
                EmptyView()
            }
            .accessibilityElement(children: .combine)
        }
        SettingsCaption("A hosted privacy policy and a support address are both required by the App Store, and neither is written yet.")
    }
}

#Preview {
    let model = AppModel()
    return NavigationStack { AboutView() }
        .environment(model)
        .task { model.loadContent() }
}
