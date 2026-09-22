import SwiftUI

/// `hp-paths` — every path, as a card with a drawing of the subject, what has been
/// drawn in it, and the current path outlined in green.
///
/// Switching costs nothing: progress is kept per path, so a learner can leave one
/// half-drawn and come back to it (BRIEF §6). Pushed on the Path tab from its title;
/// opening a card makes that path current and returns to the tab's root, which
/// then shows it (`AppModel.open(_:)`).
///
/// When the catalog groups its paths into levels — Starter, Core, Advanced — the
/// cards are listed under those names, easiest first. A level only groups and
/// recommends: nothing here is locked, dimmed or numbered, and a learner may open
/// any card in any section. A catalog without levels is one plain list, as before.
///
/// The mockup also shows a soft "Coming later" list under the cards. The catalog has
/// no way to declare an unpublished path (`shared/catalog.schema.json`), and the app
/// never invents content, so that list appears here only once the schema carries it.
struct PathsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            InlineNavBar(title: "Paths") { dismiss() }

            ScrollView {
                VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                    Text("Choose what you want to draw. Switch any time — each path keeps its place.")
                        .textRole(.bodyRegular)
                        .foregroundStyle(Theme.ink55)
                        .fixedSize(horizontal: false, vertical: true)

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
                            ForEach(section.paths) { path in
                                PathCard(path: path,
                                         drawn: app.progress.drawnCount(in: path),
                                         nextTitle: app.progress.nextLesson(in: path)?.title,
                                         isCurrent: path.id == app.currentPath?.id) {
                                    app.open(path)
                                }
                            }
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

    /// A level's name in the screen's section type, with its one line underneath.
    /// One accessibility element, read as a heading, so VoiceOver announces the
    /// group before the cards in it rather than as two stray labels.
    private func levelHeader(_ level: CatalogLevel) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(level.title)
                .textRole(.title3)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)

            if let description = level.description {
                Text(description)
                    .textRole(.footnote)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 2)
        .padding(.top, 10)
        .accessibilityElement(children: .combine)
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

/// One path (`.hp-pcard`): a 72 pt sheet of paper with the subject drawn on it, the
/// title and description, then a bar with a count or a "Not started" chip. The card
/// carries a 2 pt border with a 3 pt edge; the current path's border is green.
private struct PathCard: View {
    let path: PathModel
    let drawn: Int
    let nextTitle: String?
    let isCurrent: Bool
    let action: () -> Void

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Button(action: action) {
            content
                .padding(.init(top: 14, leading: 14, bottom: 14, trailing: 16))
                .frame(minHeight: 100)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
                        .fill(Theme.card)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
                        .strokeBorder(isCurrent ? Theme.green : Theme.line,
                                      lineWidth: isCurrent ? 2.5 : 2)
                )
                .background(alignment: .bottom) {
                    RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
                        .fill(isCurrent ? Theme.greenSoft : Theme.line)
                        .offset(y: 3)
                }
                .padding(.bottom, 3)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(.isButton)
    }

    /// At accessibility sizes the card stacks the thumbnail above the text, so the
    /// words get the full width instead of a 72 pt column of nothing.
    @ViewBuilder
    private var content: some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 14) {
                thumbnail
                details
            }
        } else {
            HStack(spacing: 14) {
                thumbnail
                details
                Image(systemName: "chevron.right")
                    .scaledFont(17, .bold, design: .default)
                    .foregroundStyle(Theme.ink25)
            }
        }
    }

    /// The path is introduced by what the learner will draw: its first lesson.
    private var thumbnail: some View {
        DrawingThumbnail(tutorial: path.lessons.first?.tutorial, size: 58)
            .frame(width: 72, height: 72)
            .background(
                RoundedRectangle(cornerRadius: Theme.thumbCornerRadius, style: .continuous)
                    .fill(Theme.paper)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Theme.thumbCornerRadius, style: .continuous)
                    .strokeBorder(Theme.line, lineWidth: 2)
            )
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(path.title)
                .textRole(.title3)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)

            if let description = path.description {
                Text(description)
                    .textRole(.footnote)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if drawn > 0 {
                ProgressBar(value: Double(drawn) / Double(max(path.lessonCount, 1)), isThin: true)
                    .padding(.top, 4)
                    .accessibilityHidden(true)
                Text("\(drawn) of \(path.lessonCount) drawn")
                    .textRole(.footnote)
                    .foregroundStyle(Theme.ink55)
            } else {
                Chip(text: "Not started · \(path.lessonCount) \(path.lessonCount == 1 ? "lesson" : "lessons")")
                    .padding(.top, 4)
            }
        }
        .multilineTextAlignment(.leading)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The bar is hidden from VoiceOver because this label already says it.
    private var accessibilityLabel: String {
        var parts = [path.title]
        if let description = path.description { parts.append(description) }
        if drawn > 0 {
            parts.append("\(drawn) of \(path.lessonCount) drawn")
            if let nextTitle { parts.append("next \(nextTitle)") }
        } else {
            parts.append("not started, \(path.lessonCount) \(path.lessonCount == 1 ? "lesson" : "lessons")")
        }
        if isCurrent { parts.append("your current path") }
        return parts.joined(separator: ", ")
    }
}
