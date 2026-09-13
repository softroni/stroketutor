import SwiftUI

/// `hp-paths` — every path, as a card with a drawing of the subject, what has been
/// drawn in it, and the current path outlined in green.
///
/// Switching costs nothing: progress is kept per path, so a learner can leave one
/// half-drawn and come back to it (BRIEF §6). Opening a card does *not* change the
/// current path — starting a lesson does.
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

                    if orderedPaths.isEmpty {
                        Text("No lessons are installed.")
                            .textRole(.body)
                            .foregroundStyle(Theme.ink55)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(Theme.cardPadding)
                            .cardBackground()
                    } else {
                        ForEach(orderedPaths) { path in
                            PathCard(path: path,
                                     drawn: app.progress.drawnCount(in: path),
                                     nextTitle: app.progress.nextLesson(in: path)?.title,
                                     isCurrent: path.id == app.currentPath?.id) {
                                app.push(.pathDetail(pathId: path.id))
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

    /// Started paths first, most recently finished at the top, then the untouched
    /// ones in catalog order. A path with no lessons in the bundle is not offered.
    private var orderedPaths: [PathModel] {
        let shipped = app.paths.filter { !$0.isEmpty }
        let started = shipped.filter { app.progress.drawnCount(in: $0) > 0 }
        let fresh = shipped.filter { app.progress.drawnCount(in: $0) == 0 }
        return started.sorted { lastDrawn(in: $0) > lastDrawn(in: $1) } + fresh
    }

    private func lastDrawn(in path: PathModel) -> Date {
        path.lessons
            .compactMap { app.progress.progress(for: $0.id)?.completedAt }
            .max() ?? .distantPast
    }
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
                    .font(.system(size: 17, weight: .bold))
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
