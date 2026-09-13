import SwiftUI

/// `sk-book` — the Sketchbook tab: the learner's private record of finished pages,
/// two to a row, grouped by month, newest first.
///
/// Plan §32: "Allow browsing by path/date without turning it into a social feed."
/// A gallery, not a feed: no likes, no other people, no sharing prompt, and one
/// promise at the foot of it.
struct SketchbookView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Group {
            if app.sketchbook.isEmpty {
                empty
            } else {
                filled
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.page.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
    }

    // MARK: - filled

    private var filled: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Theme.stackSpacing, pinnedViews: []) {
                titleRow

                ForEach(months, id: \.key) { month in
                    monthHeader(month)

                    LazyVGrid(columns: columns, alignment: .leading, spacing: 16) {
                        ForEach(month.pages) { page in
                            cell(page)
                        }
                    }
                }

                Text("Kept on this iPhone. Nothing here is uploaded or shared.")
                    .textRole(.footnote)
                    .foregroundStyle(Theme.ink40)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.top, 6)
            .padding(.bottom, 20)
        }
    }

    /// 36/800 with the gold count chip on the right, the same chip as on Learn — a
    /// fact, not a score. Above the accessibility sizes the chip drops below.
    private var titleRow: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline) {
                Text("Sketchbook")
                    .textRole(.largeTitle)
                    .foregroundStyle(Theme.ink)
                Spacer(minLength: Theme.stackSpacing)
                countChip
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Sketchbook")
                    .textRole(.largeTitle)
                    .foregroundStyle(Theme.ink)
                countChip
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    private var countChip: some View {
        Chip(text: app.sketchbook.count == 1 ? "1 drawing" : "\(app.sketchbook.count) drawings",
             systemImage: "book",
             style: .gold)
    }

    private func monthHeader(_ month: Month) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(month.title)
                .textRole(.title3)
                .foregroundStyle(Theme.ink)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: Theme.stackSpacing)
            Text(month.pages.count == 1 ? "1 page" : "\(month.pages.count) pages")
                .textRole(.footnote)
                .foregroundStyle(Theme.ink55)
        }
        .padding(.horizontal, 2)
        .padding(.top, 10)
    }

    /// One kept page: the photograph, the lesson's name, and the day it was drawn.
    private func cell(_ page: SketchbookPage) -> some View {
        let lesson = app.lesson(id: page.lessonId)
        return Button {
            app.push(.sketchbookEntry(pageId: page.id))
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                SketchbookShot(image: app.sketchbook.image(for: page), tutorial: lesson?.tutorial)

                Text(lesson?.title ?? "Lesson removed")
                    .font(.system(size: 16, weight: .heavy, design: .rounded))
                    .tracking(-0.2)
                    .foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.leading)
                    .padding(.horizontal, 2)

                Text(subtitle(for: page))
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(Theme.ink55)
                    .multilineTextAlignment(.leading)
                    .padding(.horizontal, 2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Your \(lesson?.title ?? "page"), \(Self.spokenDate.string(from: page.completedAt))")
        .accessibilityHint("Opens the page")
        .accessibilityAddTraits(.isButton)
    }

    /// "Fri 11 Sep · Trees".
    private func subtitle(for page: SketchbookPage) -> String {
        let day = Self.dayMonth.string(from: page.completedAt)
        guard let path = app.path(id: page.pathId) else { return day }
        return "\(day) · \(path.title)"
    }

    /// One column above the accessibility sizes, two otherwise.
    private var columns: [GridItem] {
        let count = dynamicTypeSize.isAccessibilitySize ? 1 : 2
        return Array(repeating: GridItem(.flexible(), spacing: 12, alignment: .top), count: count)
    }

    // MARK: - empty

    /// "A door, not an apology": one sentence, a blank page with the next lesson's
    /// drawing ghosted on it, and the way in.
    @ViewBuilder
    private var empty: some View {
        // Spacers only do their work outside a scroll view, and this state is short
        // enough to fit — until the accessibility sizes, where it has to scroll.
        if dynamicTypeSize.isAccessibilitySize {
            ScrollView { emptyStack }
        } else {
            emptyStack
        }
    }

    private var emptyStack: some View {
        let next = suggestedLesson

        return VStack(spacing: Theme.stackSpacing) {
                VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                    Text("Sketchbook")
                        .textRole(.largeTitle)
                        .foregroundStyle(Theme.ink)
                        .accessibilityAddTraits(.isHeader)

                    Text("Every page you photograph is kept here, on this iPhone.")
                        .textRole(.bodyRegular)
                        .foregroundStyle(Theme.ink55)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Spacer(minLength: 28)

                PageThumb(tutorial: next?.tutorial, strokeColor: Theme.ink25)
                    .frame(width: 150)
                    .overlay(alignment: .bottom) {
                        Image(systemName: "camera")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(Theme.ink55)
                            .frame(width: 40, height: 40)
                            .background(Circle().fill(Theme.surface))
                            .overlay(Circle().strokeBorder(Theme.paper, lineWidth: 4))
                            .offset(y: 18)
                    }
                    .accessibilityHidden(true)

                VStack(spacing: 4) {
                    Text("Nothing here yet.")
                        .textRole(.headline)
                        .foregroundStyle(Theme.ink)

                    Text(emptyLine(next))
                        .textRole(.bodyRegular)
                        .foregroundStyle(Theme.ink55)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 24 + 18)

                if let next {
                    Button {
                        app.showPreview(of: next)
                    } label: {
                        Label("Start a lesson", systemImage: "pencil")
                    }
                    .buttonStyle(.secondary)
                    .padding(.top, 8)
                }

                Spacer(minLength: 20)
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.top, 6)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// The lesson the empty state offers: the next one of the path the learner is
    /// on, or — when that path is finished — the first one still to draw anywhere,
    /// or simply the first lesson there is. The state is a door, so it should always
    /// have something behind it.
    private var suggestedLesson: Lesson? {
        if let next = app.nextLessonInCurrentPath { return next }
        for path in app.paths {
            if let next = app.progress.nextLesson(in: path) { return next }
        }
        return app.paths.first(where: { !$0.isEmpty })?.lessons.first
    }

    private func emptyLine(_ next: Lesson?) -> String {
        let opening = "Finish a lesson, photograph the page, and it appears here."
        guard let next else { return opening }
        return "\(opening) Your next one is \(next.title)."
    }

    // MARK: - Grouping

    private struct Month: Identifiable {
        let key: Date
        let title: String
        let pages: [SketchbookPage]

        var id: Date { key }
    }

    /// Newest first, grouped by `Calendar.dateComponents([.year, .month])`. A lesson
    /// drawn twice produces two cells; they are not collapsed.
    private var months: [Month] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: app.sketchbook.pages) { page in
            calendar.date(from: calendar.dateComponents([.year, .month], from: page.completedAt))
                ?? page.completedAt
        }
        return grouped.keys.sorted(by: >).map { key in
            Month(key: key,
                  title: Self.monthYear.string(from: key),
                  pages: (grouped[key] ?? []).sorted { $0.completedAt > $1.completedAt })
        }
    }

    // MARK: - Dates

    /// "September 2026".
    private static let monthYear: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("MMMM y")
        return formatter
    }()

    /// "Fri 11 Sep".
    private static let dayMonth: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("E d MMM")
        return formatter
    }()

    /// "11 September", for VoiceOver.
    private static let spokenDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("d MMMM")
        return formatter
    }()
}
