import SwiftUI
import UIKit

/// `sk-complete` — the moment after the last step. The drawing is shown whole on a
/// white page, one line from Lina, two honest facts, and the invitation to keep it.
/// Nothing is graded (plan §32: "At completion, do not grade the drawing… the final
/// action is to help the learner keep evidence of progress").
///
/// Two variants, as in the mockup: the ordinary end of a lesson, and the end of the
/// whole path, where the single page becomes a contact sheet of everything drawn.
struct CompletionView: View {
    let lesson: Lesson

    @Environment(AppModel.self) private var app
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// Lina reads her closing line once, if it was recorded and narration is on.
    @State private var narration = NarrationPlayer()

    /// The path this lesson belongs to, if it is still in the catalog.
    private var path: PathModel? { app.path(id: lesson.pathId) }

    /// `path.lessonIds.last == lesson.id`: the path is finished.
    private var isPathDone: Bool {
        guard let path, let last = path.lessons.last else { return false }
        return last.id == lesson.id && path.lessons.allSatisfy { app.progress.isCompleted($0.id) }
    }

    var body: some View {
        VStack(spacing: 0) {
            if dynamicTypeSize.isAccessibilitySize {
                ScrollView { body(isScrolling: true) }
            } else {
                body(isScrolling: false)
            }

            actions
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.page.ignoresSafeArea())
        .onAppear {
            // One .success haptic and no timer (sk-complete: "No auto-dismiss, no
            // timer"). The only sound is Lina's line, said once, the same sentence
            // that is written beside her face — and only if narration is on.
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            speakLinaLine()
        }
        .onDisappear { narration.deactivate() }
    }

    // MARK: - The body

    @ViewBuilder
    private func body(isScrolling: Bool) -> some View {
        VStack(spacing: Theme.stackSpacing) {
            if isPathDone {
                // path-done leads with the eyebrow and the sentence, then the sheet
                // of everything drawn; the ordinary end of a lesson leads with the
                // page, because the drawing is the whole point of the screen.
                Spacer(minLength: 0).frame(maxHeight: 20)

                Text("Path finished")
                    .textRole(.eyebrow)
                    .foregroundStyle(Theme.gold)
                    .textCase(.uppercase)
                    .accessibilitySortPriority(11)

                headline
                    .accessibilitySortPriority(10)

                hero(isScrolling: isScrolling)
                    .accessibilitySortPriority(9)
            } else {
                hero(isScrolling: isScrolling)
                    .accessibilitySortPriority(9)

                headline
                    .accessibilitySortPriority(10)
            }

            linaLine
                .accessibilitySortPriority(8)

            tiles
                .accessibilitySortPriority(7)

            if isPathDone { Spacer(minLength: 0) }
        }
        .padding(.horizontal, Theme.gutter)
        .padding(.top, isPathDone ? 0 : Theme.stackSpacing)
    }

    /// "Your cottage is finished." / "Ten houses. The path is done."
    private var headline: some View {
        Text(headlineText)
            .textRole(.title1)
            .foregroundStyle(Theme.ink)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity)
    }

    /// The page, or the contact sheet of the whole path.
    @ViewBuilder
    private func hero(isScrolling: Bool) -> some View {
        if isPathDone {
            contactSheet
                .padding(.vertical, 2)
        } else {
            // "It takes whatever height the text leaves": the page grows into the
            // space between the headline and the tiles, down to the 200 pt floor the
            // notes give it, and takes a fixed height once the screen scrolls.
            HStack {
                Spacer(minLength: 0)
                FinishedPageView(tutorial: lesson.tutorial, chipText: chipText)
                    .padding(6)
                    .accessibilityElement()
                    .accessibilityLabel(pageAccessibilityLabel)
                    .accessibilityAddTraits(.isImage)
                Spacer(minLength: 0)
            }
            .frame(minHeight: 200, maxHeight: isScrolling ? 280 : .infinity)
            .padding(.top, 4)
        }
    }

    /// path-done: every drawing of the path as a small page, the one just finished
    /// ringed in gold with a check badge.
    private var contactSheet: some View {
        let lessons = path?.lessons ?? [lesson]
        let columns = max(1, min(5, lessons.count))
        return LazyVGrid(columns: Array(repeating: GridItem(.fixed(63), spacing: 8), count: columns),
                         spacing: 8) {
            ForEach(lessons) { entry in
                contactSheetCell(entry)
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Your \(lessons.count) drawings, in lesson order")
    }

    private func contactSheetCell(_ entry: Lesson) -> some View {
        let isNewest = entry.id == lesson.id
        // "Cells show the learner's photo when one exists, else the tutorial strokes."
        let photo = app.sketchbook.pages(forLesson: entry.id).first.flatMap { app.sketchbook.image(for: $0) }

        return Group {
            if let photo {
                Color.clear
                    .overlay(Image(uiImage: photo).resizable().scaledToFill())
                    .aspectRatio(3.0 / 4.0, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            } else {
                PageThumb(tutorial: entry.tutorial, cornerRadius: 10)
            }
        }
        .overlay {
            if isNewest {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(Theme.gold, lineWidth: 2.5)
            }
        }
        .background {
            if isNewest {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Theme.goldSoft)
                    .padding(-4)
            }
        }
        .overlay(alignment: .topTrailing) {
            if isNewest {
                Image(systemName: "checkmark")
                    .scaledFont(11, .heavy, design: .default)
                    .foregroundStyle(.white)
                    .frame(width: 22, height: 22)
                    .background(Circle().fill(Theme.gold))
                    .overlay(Circle().strokeBorder(Theme.paper, lineWidth: 3))
                    .offset(x: 6, y: -6)
            }
        }
    }

    /// Lina's round portrait and one plain line — no bubble (`.sk-lina`).
    private var linaLine: some View {
        HStack(alignment: .top, spacing: 12) {
            LinaFace(size: 48)
            Text(linaText)
                .textRole(.body)
                .foregroundStyle(Theme.ink70)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 1)
        }
        .padding(.horizontal, 2)
        .accessibilityElement(children: .combine)
    }

    /// Two `.tile`s: steps and drawing time, or drawings and the span of the path.
    private var tiles: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: Theme.stackSpacing) { tileViews }
            VStack(spacing: Theme.stackSpacing) { tileViews }
        }
    }

    @ViewBuilder
    private var tileViews: some View {
        if isPathDone {
            StatTile(value: "\(path?.lessons.count ?? 1)", label: "Drawings")
            StatTile(value: spanText, label: "First to last")
        } else {
            StatTile(value: "\(lesson.stepCount)", label: "Steps")
            StatTile(value: "\(lesson.estimatedMinutes) min", label: "Drawing time")
        }
    }

    // MARK: - The three ways on

    private var actions: some View {
        VStack(spacing: Theme.stackSpacing) {
            Button {
                app.presentCapture(lesson)
            } label: {
                Label("Add to sketchbook", systemImage: "camera")
            }
            .buttonStyle(.primary)

            if isPathDone {
                Button("Choose another path") {
                    app.dismissCover()
                    app.selectedTab = .learn
                    app.popToRoot(.learn)
                    app.push(.paths)
                }
                .buttonStyle(.secondary)
            } else if let next = app.nextLesson(after: lesson) {
                // "The secondary says only 'Next lesson' so a long localised title
                // can never break it."
                Button("Next lesson") {
                    app.dismissCover()
                    app.showPreview(of: next)
                }
                .buttonStyle(.secondary)
            }

            Button("Not now") { app.returnToPathDetail(for: lesson) }
                .buttonStyle(.quiet)
                .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, Theme.gutter)
        .padding(.top, Theme.stackSpacing)
        .padding(.bottom, Theme.stackSpacing)
    }

    // MARK: - Words

    /// "Your cottage is finished." — the plan's own sentence, with the lesson's
    /// subject in it. A title that does not read as a subject in running text (one
    /// with a number or a bracket in it) gets the generic line instead.
    private var headlineText: String {
        if isPathDone {
            return "\(pathCountPhrase). The path is done."
        }
        let subject = lesson.subject
        let readsAsSubject = !subject.isEmpty
            && subject.allSatisfy { $0.isLetter || $0.isWhitespace || $0 == "-" || $0 == "'" }
        return readsAsSubject ? "Your \(subject) is finished." : "Your drawing is finished."
    }

    /// "Ten houses" — the count spelled out, then the path's own noun.
    private var pathCountPhrase: String {
        let count = path?.lessons.count ?? 1
        let spelled = Self.spellOut.string(from: NSNumber(value: count)) ?? "\(count)"
        let noun = (path?.title ?? "drawings").lowercased()
        return "\(spelled.prefix(1).uppercased() + spelled.dropFirst()) \(count == 1 ? Self.singular(noun) : noun)"
    }

    /// "Trees" → "tree", for the one-lesson path. Anything that does not end in a
    /// plain "s" is left exactly as the catalog wrote it.
    private static func singular(_ noun: String) -> String {
        guard noun.count > 2, noun.hasSuffix("s"), !noun.hasSuffix("ss") else { return noun }
        return String(noun.dropLast())
    }

    /// "5 weeks" — first completion to last. A path drawn inside a day says so
    /// rather than rounding itself up into a week.
    private var spanText: String {
        let dates = (path?.lessons ?? [lesson])
            .compactMap { app.progress.progress(for: $0.id)?.completedAt }
            .sorted()
        guard let first = dates.first, let last = dates.last else { return "Today" }
        let days = Calendar.current.dateComponents([.day], from: first, to: last).day ?? 0
        switch days {
        case ..<1: return "Today"
        case ..<14: return days == 1 ? "1 day" : "\(days) days"
        default:
            let weeks = days / 7
            return weeks == 1 ? "1 week" : "\(weeks) weeks"
        }
    }

    /// "Drawn · 12 Sep", on the chip at the foot of the page.
    private var chipText: String {
        let date = app.progress.progress(for: lesson.id)?.completedAt ?? Date()
        return "Drawn · \(Self.dayMonth.string(from: date))"
    }

    private var pageAccessibilityLabel: String {
        let date = app.progress.progress(for: lesson.id)?.completedAt ?? Date()
        return "Your finished \(lesson.title) drawing, drawn \(Self.spokenDate.string(from: date))"
    }

    /// For a lesson with no outro of its own: one calm line from Lina, chosen by the
    /// lesson's place in its path (`CompletionLines`), and the recording of that
    /// same line when one shipped.
    private var linaLineChoice: CompletionLines.Line {
        CompletionLines.line(isPathDone: isPathDone, position: path?.position(of: lesson.id))
    }

    /// What Lina says after this lesson (`LessonBookend.outroId`), when the Studio
    /// published it: a sentence about this drawing, in the learner's own hand. The
    /// end of a whole path keeps its own line, which is about the path.
    private var lessonOutro: String? {
        guard !isPathDone else { return nil }
        return narration.lineText(lessonId: lesson.id, stepId: LessonBookend.outroId)
    }

    private var linaText: String { lessonOutro ?? linaLineChoice.text }

    /// Said once, when the screen arrives. A learner who has turned Lina off, or a
    /// line that was never recorded, ends the lesson in silence.
    private func speakLinaLine() {
        if lessonOutro != nil {
            guard app.settings.narrationEnabled else { return }
            narration.play(lessonId: lesson.id, stepId: LessonBookend.outroId)
            return
        }
        let line = linaLineChoice
        guard app.settings.narrationEnabled, narration.hasAppLine(line.id) else { return }
        narration.playAppLine(line.id)
    }

    // MARK: - Dates

    private static let spellOut: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .spellOut
        return formatter
    }()

    /// "12 Sep", in the learner's own locale.
    private static let dayMonth: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("d MMM")
        return formatter
    }()

    /// "12 September", for VoiceOver.
    private static let spokenDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("d MMMM")
        return formatter
    }()
}
