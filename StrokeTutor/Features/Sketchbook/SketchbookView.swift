import SwiftUI

/// `sk-book` — the Sketchbook tab: the learner's private record of finished pages,
/// told in pictures.
///
/// **Paths** (the default) is a sticker album: one band per path the learner has
/// photographed at least one page in, in the path's own tint (`PathTint`), the
/// current path first and then the most recently drawn. Each band has one slot per
/// lesson, in path order — the latest photo where there is one, and where there is
/// not, the lesson's drawing as a faint outline on a dashed slot, so the empty
/// places show what is still to collect. An open empty slot opens the lesson's
/// preview; a locked one does nothing.
///
/// **Dates** is the same pages as tinted cards grouped by month, newest first, each
/// with the lesson's name and a short date. The choice is remembered.
///
/// Every photo carries the lesson's own drawing in color in a small white badge
/// (`LessonBadge`), so what was taught sits next to what was drawn. Words are kept
/// to names; the rest is for VoiceOver.
///
/// Plan §32: "Allow browsing by path/date without turning it into a social feed."
/// A gallery, not a feed: no likes, no other people, no counts to chase. The
/// privacy line for grown-ups lives under the Sketchbook section of Settings.
struct SketchbookView: View {
    /// How the filled sketchbook is laid out; stored by raw value.
    enum Arrangement: String, CaseIterable {
        case paths, dates

        var title: String {
            switch self {
            case .paths: return "Paths"
            case .dates: return "Dates"
            }
        }
    }

    @Environment(AppModel.self) private var app
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @AppStorage(SketchbookView.arrangementKey) private var arrangement: Arrangement = .paths

    /// The `UserDefaults` key the chosen arrangement is kept under.
    static let arrangementKey = "sketchbookArrangement"

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
            VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                titleRow

                switch arrangement {
                case .paths:
                    ForEach(albums) { album in
                        AlbumBand(album: album)
                    }
                    if !loosePages.isEmpty {
                        looseSection
                    }
                case .dates:
                    ForEach(months) { month in
                        monthSection(month)
                    }
                }
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
    }

    /// The title, and the small Paths / Dates switch beside it — under it when the
    /// two no longer fit on one line.
    private var titleRow: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .center, spacing: Theme.stackSpacing) {
                title
                Spacer(minLength: 0)
                arrangementPicker
                    .frame(width: 136)
            }

            VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                title
                arrangementPicker
            }
        }
        .padding(.bottom, 4)
    }

    private var title: some View {
        Text("Sketchbook")
            .textRole(.largeTitle)
            .foregroundStyle(Theme.ink)
            .fixedSize()
            .accessibilityAddTraits(.isHeader)
    }

    private var arrangementPicker: some View {
        SegmentedPicker(options: Arrangement.allCases,
                        title: \.title,
                        selection: $arrangement)
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Show by")
    }

    // MARK: - By path

    /// Every path with at least one photographed lesson: the current path first,
    /// then the one drawn in most recently. A lesson drawn twice shows its newest
    /// photo; the older ones are still under Dates.
    private var albums: [Album] {
        let pages = app.sketchbook.pages // Newest first.
        let currentId = app.currentPath?.id
        let built: [Album] = app.paths.compactMap { path in
            let slots = path.lessons.map { lesson in
                let ofLesson = pages.filter { $0.lessonId == lesson.id }
                return AlbumSlot(lesson: lesson,
                                 page: ofLesson.first,
                                 pageCount: ofLesson.count,
                                 isDone: app.progress.isCompleted(lesson.id),
                                 isOpen: app.progress.isCompleted(lesson.id)
                                     || app.progress.isUnlocked(lesson, in: path),
                                 isNext: path.id == currentId
                                     && app.progress.nextLesson(in: path)?.id == lesson.id)
            }
            let latest = slots.compactMap(\.page?.completedAt).max()
            guard let latest else { return nil }
            return Album(path: path, tint: app.tint(for: path), slots: slots, latest: latest)
        }
        return built.sorted { lhs, rhs in
            if (lhs.path.id == currentId) != (rhs.path.id == currentId) {
                return lhs.path.id == currentId
            }
            return lhs.latest > rhs.latest
        }
    }

    /// Pages whose lesson the catalog no longer carries. They are the learner's, so
    /// they stay — in a plain group at the end rather than in no album at all.
    private var loosePages: [SketchbookPage] {
        app.sketchbook.pages.filter { app.lesson(id: $0.lessonId) == nil }
    }

    private var looseSection: some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            Text("More drawings")
                .textRole(.title2)
                .foregroundStyle(Theme.ink)
                .accessibilityAddTraits(.isHeader)
                .padding(.horizontal, 4)
            PictureGrid(columns: 3, spacing: 10, centersLastRow: false) {
                ForEach(loosePages) { page in
                    PhotoSlot(page: page, lesson: nil, pageCount: 1)
                }
            }
        }
        .padding(.top, 8)
    }

    // MARK: - By date

    private func monthSection(_ month: Month) -> some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            Text(month.title)
                .textRole(.title2)
                .foregroundStyle(Theme.ink)
                .accessibilityAddTraits(.isHeader)
                .padding(.horizontal, 4)
                .padding(.top, 8)

            PictureGrid(columns: dynamicTypeSize.isAccessibilitySize ? 1 : 2,
                        spacing: 14,
                        centersLastRow: false) {
                ForEach(month.pages) { page in
                    DateCard(page: page)
                }
            }
        }
    }

    // MARK: - empty

    /// A door, not an apology: the next lesson drawn big and in color on white
    /// paper in its path's tint, one short line, and the green way in.
    @ViewBuilder
    private var empty: some View {
        // Spacers only do their work outside a scroll view, and this state is short
        // enough to fit — until the larger sizes, where it has to scroll.
        if dynamicTypeSize >= .xxxLarge {
            ScrollView { emptyStack }
        } else {
            emptyStack
        }
    }

    private var emptyStack: some View {
        let next = suggestedLesson

        return VStack(spacing: 18) {
            Text("Sketchbook")
                .textRole(.largeTitle)
                .foregroundStyle(Theme.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityAddTraits(.isHeader)

            Spacer(minLength: 8)

            emptyPicture(next)

            Text("Your drawings go here.")
                .textRole(.title3)
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 4)

            if let next {
                Button {
                    app.showPreview(of: next)
                } label: {
                    Label("Draw \(next.title)", systemImage: "pencil")
                }
                .buttonStyle(.primary)
            }

            Label("Kept on this iPhone", systemImage: "lock.fill")
                .textRole(.footnote)
                .foregroundStyle(Theme.ink40)
                .accessibilityLabel("Kept on this iPhone. Nothing here is uploaded or shared.")

            Spacer(minLength: 16)
        }
        .padding(.horizontal, Theme.gutter)
        .padding(.top, 6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// The next lesson in color on a white page, set in its path's tint with the
    /// same pressed edge as the path cards, and a camera on the corner: this is
    /// where the photo of it will go.
    private func emptyPicture(_ next: Lesson?) -> some View {
        let tint = next.flatMap { app.path(id: $0.pathId) }.map { app.tint(for: $0) }
            ?? PathTint.forPath(at: 0)
        let band = RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous)

        return DrawingThumbnail(tutorial: next?.tutorial, strokeColor: nil, showsFills: true)
            .padding(24)
            .frame(width: 200, height: 250)
            .background(
                RoundedRectangle(cornerRadius: Theme.thumbCornerRadius, style: .continuous)
                    .fill(Theme.paper)
            )
            .overlay(alignment: .bottomTrailing) {
                Image(systemName: "camera.fill")
                    // Decoration in a fixed circle, so it keeps its size.
                    .font(.system(size: 21, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 52, height: 52)
                    .background(Circle().fill(tint.deep))
                    .overlay(Circle().strokeBorder(Theme.paper, lineWidth: 4))
                    .offset(x: 18, y: 18)
            }
            .padding(.init(top: 22, leading: 34, bottom: 30, trailing: 34))
            .background(band.fill(tint.soft))
            .background(alignment: .bottom) {
                band.fill(tint.edge).offset(y: 5)
            }
            .padding(.bottom, 5)
            .accessibilityHidden(true)
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

    // MARK: - Grouping by month

    private struct Month: Identifiable {
        let key: Date
        let title: String
        let pages: [SketchbookPage]

        var id: Date { key }
    }

    /// Newest first, grouped by `Calendar.dateComponents([.year, .month])`. A lesson
    /// drawn twice produces two cards; they are not collapsed.
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

    /// "September 2026".
    private static let monthYear: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("MMMM y")
        return formatter
    }()
}

// MARK: - The album

/// One path's page of the album.
private struct Album: Identifiable {
    let path: PathModel
    let tint: PathTint
    let slots: [AlbumSlot]
    /// When the newest photo in it was taken, for ordering.
    let latest: Date

    var id: String { path.id }
    var photographed: Int { slots.filter { $0.page != nil }.count }
}

/// One lesson's place in an album.
private struct AlbumSlot: Identifiable {
    let lesson: Lesson
    /// The newest photo of it, if any.
    let page: SketchbookPage?
    let pageCount: Int
    let isDone: Bool
    /// Finished, or next in line — something a tap can open.
    let isOpen: Bool
    /// The next lesson to draw, on the current path only.
    let isNext: Bool

    var id: String { lesson.id }
}

/// A path's band: its soft tint with the 4 pt deeper edge the path cards have, the
/// path's name big and bold with a small "3/10" (lessons photographed), and a
/// three-column grid of slots.
private struct AlbumBand: View {
    let album: Album

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)

        VStack(alignment: .leading, spacing: 12) {
            header

            PictureGrid(columns: 3, spacing: 10, centersLastRow: false) {
                ForEach(album.slots) { slot in
                    if let page = slot.page {
                        PhotoSlot(page: page, lesson: slot.lesson, pageCount: slot.pageCount)
                    } else {
                        EmptySlot(slot: slot, path: album.path, tint: album.tint)
                    }
                }
            }
        }
        .padding(.init(top: 14, leading: 12, bottom: 12, trailing: 12))
        .background(shape.fill(album.tint.soft))
        .background(alignment: .bottom) {
            shape.fill(album.tint.edge).offset(y: 4)
        }
        .padding(.bottom, 12)
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(album.path.title)
                .textRole(.title2)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text("\(album.photographed)/\(album.path.lessonCount)")
                .scaledFont(15, .heavy, relativeTo: .footnote)
                .monospacedDigit()
                .foregroundStyle(album.tint.deep)
                .padding(.vertical, 5)
                .padding(.horizontal, 11)
                .background(Capsule().fill(Theme.paper))
                .fixedSize()
        }
        .padding(.horizontal, 4)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(album.path.title), \(album.photographed) of \(album.path.lessonCount) drawings kept")
        .accessibilityAddTraits(.isHeader)
    }
}

/// A kept page: the photo with its lesson badge. A lesson drawn more than once
/// shows a second sheet peeking out behind it. Opens the page.
private struct PhotoSlot: View {
    let page: SketchbookPage
    let lesson: Lesson?
    let pageCount: Int

    @Environment(AppModel.self) private var app

    var body: some View {
        Button {
            app.push(.sketchbookEntry(pageId: page.id))
        } label: {
            SketchbookShot(image: app.sketchbook.thumbnail(for: page),
                           tutorial: lesson?.tutorial,
                           cornerRadius: 12)
                .lessonBadge(lesson?.tutorial)
                // A light lift, so a kept page sits on the band like a sticker.
                .shadow(color: .black.opacity(0.12), radius: 3, y: 2)
                .background {
                    if pageCount > 1 {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Theme.paper)
                            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .strokeBorder(Theme.line, lineWidth: 2))
                            .rotationEffect(.degrees(4))
                            .offset(x: 3, y: 1)
                    }
                }
        }
        .buttonStyle(PressableSlotStyle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint("Opens the page")
        .accessibilityAddTraits(.isButton)
    }

    private var accessibilityLabel: String {
        var label = "Your \(lesson?.title ?? "drawing"), \(SketchbookDate.spoken(page.completedAt))"
        if pageCount > 1 { label += ", drawn \(pageCount) times" }
        return label
    }
}

/// A lesson with no photo yet: its drawing as a faint outline on a dashed, half-white
/// slot. The current path's next lesson is outlined in green with a pencil (green is
/// the way forward, so only the path the learner is on gets it); one finished
/// without a photo carries a small gold check. Open slots open the lesson's preview; locked
/// ones are not controls at all.
private struct EmptySlot: View {
    let slot: AlbumSlot
    let path: PathModel
    let tint: PathTint

    @Environment(AppModel.self) private var app

    var body: some View {
        if slot.isOpen {
            Button {
                app.showPreview(of: slot.lesson)
            } label: {
                face
            }
            .buttonStyle(PressableSlotStyle())
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(accessibilityLabel)
            .accessibilityHint("Opens the lesson")
            .accessibilityAddTraits(.isButton)
        } else {
            face
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(accessibilityLabel)
        }
    }

    private var face: some View {
        let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)
        return GeometryReader { geometry in
            DrawingThumbnail(tutorial: slot.lesson.tutorial,
                             strokeColor: Theme.ink.opacity(slot.isNext ? 0.3 : 0.2))
                .padding(geometry.size.width * 0.18)
                .frame(width: geometry.size.width, height: geometry.size.height)
        }
        .aspectRatio(3.0 / 4.0, contentMode: .fit)
        .background(shape.fill(Theme.paper.opacity(slot.isNext ? 0.9 : 0.55)))
        .overlay(
            shape.strokeBorder(slot.isNext ? Theme.green : tint.deep.opacity(0.3),
                               style: StrokeStyle(lineWidth: slot.isNext ? 2.5 : 2, dash: [6, 5]))
        )
        .overlay(alignment: .topTrailing) {
            if slot.isNext {
                marker(systemImage: "pencil", fill: Theme.green)
            } else if slot.isDone {
                marker(systemImage: "checkmark", fill: Theme.gold)
            }
        }
    }

    private func marker(systemImage: String, fill: Color) -> some View {
        Image(systemName: systemImage)
            .font(.system(size: 12, weight: .heavy))
            .foregroundStyle(.white)
            .frame(width: 26, height: 26)
            .background(Circle().fill(fill))
            .overlay(Circle().strokeBorder(Theme.paper, lineWidth: 2))
            .padding(6)
    }

    private var accessibilityLabel: String {
        let title = slot.lesson.title
        if slot.isNext { return "\(title), next to draw" }
        if slot.isDone { return "\(title), drawn, no photo yet" }
        return "\(title), not drawn yet"
    }
}

/// A date card: the photo with its badge on the path's soft tint, the lesson's name
/// and a short date under it. Fills its grid row, so neighbors stay the same height.
private struct DateCard: View {
    let page: SketchbookPage

    @Environment(AppModel.self) private var app

    var body: some View {
        let lesson = app.lesson(id: page.lessonId)
        let tint = (app.path(forLesson: page.lessonId) ?? app.path(id: page.pathId))
            .map { app.tint(for: $0) }
        let shape = RoundedRectangle(cornerRadius: 20, style: .continuous)

        Button {
            app.push(.sketchbookEntry(pageId: page.id))
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                SketchbookShot(image: app.sketchbook.thumbnail(for: page),
                               tutorial: lesson?.tutorial,
                               cornerRadius: 14)
                    .lessonBadge(lesson?.tutorial)
                    .padding(.bottom, 6)

                Text(lesson?.title ?? "Drawing")
                    .scaledFont(17, .heavy, relativeTo: .headline)
                    .tracking(-0.2)
                    .foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 4)

                Text(SketchbookDate.short(page.completedAt))
                    .textRole(.footnote)
                    .foregroundStyle(tint?.deep ?? Theme.ink55)
                    .padding(.horizontal, 4)

                Spacer(minLength: 0)
            }
            .padding(.init(top: 8, leading: 8, bottom: 10, trailing: 8))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(shape.fill(tint?.soft ?? Theme.surface))
            .background(alignment: .bottom) {
                shape.fill(tint?.edge ?? Theme.line).offset(y: 4)
            }
            .padding(.bottom, 4)
        }
        .buttonStyle(PressableSlotStyle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Your \(lesson?.title ?? "drawing"), \(SketchbookDate.spoken(page.completedAt))")
        .accessibilityHint("Opens the page")
        .accessibilityAddTraits(.isButton)
    }
}

/// A slight dip while a slot is held, and none with Reduce Motion.
private struct PressableSlotStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.96 : 1)
            .opacity(configuration.isPressed && reduceMotion ? 0.7 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.1), value: configuration.isPressed)
    }
}

// MARK: - Dates

/// The two ways the Sketchbook writes a page's date.
enum SketchbookDate {
    /// "Sep 22", or "Sep 22, 2025" for a page from another year.
    static func short(_ date: Date) -> String {
        let sameYear = Calendar.current.isDate(date, equalTo: Date(), toGranularity: .year)
        return (sameYear ? dayMonth : dayMonthYear).string(from: date)
    }

    /// "September 22", for VoiceOver.
    static func spoken(_ date: Date) -> String {
        spokenFormatter.string(from: date)
    }

    private static let dayMonth: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("MMM d")
        return formatter
    }()

    private static let dayMonthYear: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("MMM d y")
        return formatter
    }()

    private static let spokenFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("MMMM d")
        return formatter
    }()
}
