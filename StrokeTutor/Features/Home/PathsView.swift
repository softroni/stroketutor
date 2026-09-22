import SwiftUI

/// `hp-paths` — every path as a big picture card in a two-column grid: the path's
/// first drawing in color on white paper, its name, and a tiny count. Each path wears
/// its own color (`PathTint`), and the current path is outlined in green with a "Now"
/// badge. Words are kept to the names; the descriptions are read by VoiceOver only.
///
/// Switching costs nothing: progress is kept per path, so a learner can leave one
/// half-drawn and come back to it (BRIEF §6). Pushed on the Path tab from its title;
/// opening a card makes that path current and returns to the tab's root, which
/// then shows it (`AppModel.open(_:)`).
///
/// When the catalog groups its paths into levels — Starter, Core, Advanced — the
/// cards are listed under those names, big and bold, easiest first. A level only groups and
/// recommends: nothing here is locked, dimmed or numbered, and a learner may open
/// any card in any section. A catalog without levels is one plain list, as before.
///
/// The mockup also shows a soft "Coming later" list under the cards. The catalog has
/// no way to declare an unpublished path (`shared/catalog.schema.json`), and the app
/// never invents content, so that list appears here only once the schema carries it.
struct PathsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(spacing: 0) {
            InlineNavBar(title: "Paths") { dismiss() }

            ScrollView {
                VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                    if sections.isEmpty {
                        Text("No lessons are installed.")
                            .textRole(.body)
                            .foregroundStyle(Theme.ink55)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(Theme.cardPadding)
                            .cardBackground()
                    } else {
                        ForEach(sections) { section in
                            if let level = section.level {
                                levelHeader(level)
                            }
                            PictureGrid(columns: dynamicTypeSize.isAccessibilitySize ? 1 : 2,
                                        spacing: 16,
                                        centersLastRow: false) {
                                ForEach(section.paths) { path in
                                    PathCard(path: path,
                                             tint: app.tint(for: path),
                                             drawn: app.progress.drawnCount(in: path),
                                             nextTitle: app.progress.nextLesson(in: path)?.title,
                                             isCurrent: path.id == app.currentPath?.id) {
                                        app.open(path)
                                    }
                                }
                            }
                            .padding(.bottom, 8)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Theme.gutter)
                .padding(.bottom, 16)
            }
        }
        .background(Theme.page)
        .toolbar(.hidden, for: .navigationBar)
    }

    /// The cards, in the order and the groups the screen draws them: the catalog's
    /// level sections, each ordered on its own, and a last section without a heading
    /// for the paths that belong to no level. A catalog with no levels leaves exactly
    /// one unheaded section, which is the list this screen has always shown.
    private var sections: [PathsSection] {
        app.catalog.pathSections.compactMap { section in
            let shipped = section.paths.compactMap { app.path(id: $0.id) }.filter { !$0.isEmpty }
            guard !shipped.isEmpty else { return nil }
            return PathsSection(level: section.level, paths: ordered(shipped))
        }
    }

    /// Started paths first, most recently finished at the top, then the untouched
    /// ones in catalog order. A path with no lessons in the bundle is not offered.
    private func ordered(_ paths: [PathModel]) -> [PathModel] {
        let started = paths.filter { app.progress.drawnCount(in: $0) > 0 }
        let fresh = paths.filter { app.progress.drawnCount(in: $0) == 0 }
        return started.sorted { lastDrawn(in: $0) > lastDrawn(in: $1) } + fresh
    }

    /// A level's name, big and bold, over its cards. The catalog's line about the
    /// level is not shown — the cards speak for it — but VoiceOver still reads it,
    /// with the name, as one heading before the cards in the group.
    private func levelHeader(_ level: CatalogLevel) -> some View {
        Text(level.title)
            .textRole(.title1)
            .foregroundStyle(Theme.ink)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 2)
            .padding(.top, 8)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel([level.title, level.description].compactMap { $0 }.joined(separator: ". "))
            .accessibilityAddTraits(.isHeader)
    }

    private func lastDrawn(in path: PathModel) -> Date {
        path.lessons
            .compactMap { app.progress.progress(for: $0.id)?.completedAt }
            .max() ?? .distantPast
    }
}

/// One heading's worth of the list: a level and the cards drawn under it, or no
/// level at all for the paths the catalog does not group.
private struct PathsSection: Identifiable {
    let level: CatalogLevel?
    let paths: [PathModel]

    /// A level id is never empty, so the unheaded section cannot collide with one.
    var id: String { level?.id ?? "" }
}

/// One path (`.hp-pcard`): a chunky card in the path's soft tint with a 4 pt deeper
/// edge under it, the first lesson drawn large and in color on white paper, the
/// path's name, and one tiny line — "10 lessons" before it is started, a thin bar
/// in the path's deep color with "2/10" after. The current path gets a green border
/// and edge and a "Now" badge. The card fills the height its grid row offers, so
/// two cards side by side stay equal when one name wraps.
private struct PathCard: View {
    let path: PathModel
    let tint: PathTint
    let drawn: Int
    let nextTitle: String?
    let isCurrent: Bool
    let action: () -> Void

    private var isComplete: Bool { drawn >= path.lessonCount && path.lessonCount > 0 }

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                picture

                Text(path.title)
                    .scaledFont(18, .heavy, relativeTo: .headline)
                    .tracking(-0.2)
                    .foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity)

                Spacer(minLength: 0)

                progressLine
            }
            .padding(.init(top: 10, leading: 10, bottom: 12, trailing: 10))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(
                RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
                    .fill(tint.soft)
            )
            .overlay {
                if isCurrent {
                    RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
                        .strokeBorder(Theme.green, lineWidth: 3)
                }
            }
            .background(alignment: .bottom) {
                RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
                    .fill(isCurrent ? Theme.greenDeep : tint.edge)
                    .offset(y: 4)
            }
            .overlay(alignment: .topTrailing) {
                if isCurrent { nowBadge }
            }
            .padding(.bottom, 4)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(isCurrent ? [.isButton, .isSelected] : .isButton)
    }

    /// The path is introduced by what the learner will draw first, in its own
    /// colors. Drawings assume white paper, so the tint never shows through.
    private var picture: some View {
        DrawingThumbnail(tutorial: path.lessons.first?.tutorial,
                         strokeColor: nil,
                         showsFills: true)
            .frame(maxWidth: 108)
            .frame(height: 104)
            .padding(10)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: Theme.thumbCornerRadius, style: .continuous)
                    .fill(Theme.paper)
            )
    }

    @ViewBuilder
    private var progressLine: some View {
        if drawn > 0 {
            HStack(spacing: 8) {
                ProgressBar(value: Double(drawn) / Double(max(path.lessonCount, 1)),
                            tint: isComplete ? Theme.gold : tint.deep,
                            track: Theme.paper,
                            isThin: true)
                HStack(spacing: 3) {
                    if isComplete {
                        Image(systemName: "checkmark")
                            .scaledFont(12, .heavy, relativeTo: .footnote, design: .default)
                    }
                    Text("\(drawn)/\(path.lessonCount)")
                        .scaledFont(14, .heavy, relativeTo: .footnote)
                        .monospacedDigit()
                }
                .foregroundStyle(isComplete ? Theme.goldDeep : tint.deep)
                .fixedSize()
            }
            .padding(.horizontal, 4)
        } else {
            Text("\(path.lessonCount) \(path.lessonCount == 1 ? "lesson" : "lessons")")
                .scaledFont(14, .bold, relativeTo: .footnote)
                .foregroundStyle(tint.deep)
        }
    }

    /// "Now" on a green capsule sitting on the card's top edge: the path the Path
    /// tab is showing.
    private var nowBadge: some View {
        HStack(spacing: 4) {
            Image(systemName: "pencil")
                .scaledFont(12, .heavy, relativeTo: .footnote, design: .default)
            Text("Now")
                .scaledFont(14, .heavy, relativeTo: .footnote)
        }
        .foregroundStyle(.white)
        .padding(.vertical, 5)
        .padding(.horizontal, 10)
        .background(Capsule().fill(Theme.green))
        .overlay(Capsule().strokeBorder(Theme.paper, lineWidth: 2.5))
        .padding(.trailing, 12)
        .offset(y: -12)
    }

    /// Everything the card no longer prints — the description and the next lesson —
    /// is still here for VoiceOver. The bar is hidden because this says it.
    private var accessibilityLabel: String {
        var parts = [path.title]
        if isCurrent { parts.append("your current path") }
        if let description = path.description { parts.append(description) }
        if drawn > 0 {
            parts.append("\(drawn) of \(path.lessonCount) drawn")
            if let nextTitle { parts.append("next \(nextTitle)") }
        } else {
            parts.append("not started, \(path.lessonCount) \(path.lessonCount == 1 ? "lesson" : "lessons")")
        }
        return parts.joined(separator: ", ")
    }
}
