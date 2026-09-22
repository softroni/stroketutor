import SwiftUI
import UIKit

/// `sk-entry` — one kept page: the photograph large on a band in its path's tint,
/// with the lesson it was drawn from in color in the corner, then the lesson's name,
/// one short line ("Plants · Sep 22"), the gold "Drawn" chip, a note, the green way to
/// draw it again, and the quiet actions. Delete always asks.
///
/// Plan §32: "Associate the image with lesson, path, and completion date." The only
/// forward action is to draw it again; the rest is quiet.
struct SketchbookEntryView: View {
    let pageId: UUID

    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    @State private var note = ""
    @State private var didLoadNote = false
    @State private var isConfirmingDelete = false
    /// A JPEG in the temporary directory, written so the share sheet hands over a
    /// real file rather than a re-rendered bitmap.
    @State private var shareURL: URL?

    @FocusState private var isEditingNote: Bool

    private var page: SketchbookPage? { app.sketchbook.page(id: pageId) }

    var body: some View {
        VStack(spacing: 0) {
            // The v3 bar (`sk-entry`): a bare chevron, "Sketchbook" 17/heavy, and
            // the share button as the one trailing control — the same bar the Home
            // group draws, rather than the system one.
            InlineNavBar(title: "Sketchbook", onBack: { dismiss() }) {
                if let shareURL, let page {
                    ShareLink(item: shareURL, preview: SharePreview(shareTitle(page))) {
                        Image(systemName: "square.and.arrow.up")
                            .scaledFont(19, .semibold, design: .default)
                            .foregroundStyle(Theme.ink)
                            .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                            .contentShape(Rectangle())
                    }
                    .accessibilityLabel("Share")
                }
            }

            if let page {
                content(page)
            } else {
                missing
            }
        }
        .background(Theme.page.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        #if DEBUG
        // Screenshot-harness only: `DebugScreenHarness`'s `entry-delete` case sets
        // this flag because the confirmation alert is behind this view's own
        // private `@State`, which a launch argument cannot reach directly.
        .onAppear {
            guard DebugScreenHarness.raiseDeleteConfirmation else { return }
            DebugScreenHarness.raiseDeleteConfirmation = false
            isConfirmingDelete = true
        }
        #endif
    }

    // MARK: - The page

    private func content(_ page: SketchbookPage) -> some View {
        let lesson = app.lesson(id: page.lessonId)

        return ScrollView {
            VStack(spacing: Theme.stackSpacing) {
                photoBand(page, lesson: lesson)

                facts(page, lesson: lesson)

                noteField

                if let lesson {
                    Button {
                        app.showPreview(of: lesson)
                    } label: {
                        Label("Draw it again", systemImage: "pencil")
                    }
                    .buttonStyle(.primary)
                    .padding(.top, 4)
                }

                quietActions(page)
            }
            .padding(.horizontal, Theme.gutter)
            // The same 20 pt under the bar that `hp-preview` leaves.
            .padding(.top, 20)
            .padding(.bottom, 46)
        }
        .scrollDismissesKeyboard(.interactively)
        .task(id: page.id) {
            guard !didLoadNote else { return }
            note = page.note ?? ""
            didLoadNote = true
            shareURL = makeShareFile(for: page)
        }
        .onChange(of: isEditingNote) { _, editing in
            if !editing { saveNote() }
        }
        .onDisappear { saveNote() }
        .alert("Delete this page?", isPresented: $isConfirmingDelete) {
            Button("Delete", role: .destructive) {
                app.sketchbook.delete(page)
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The photo and your note are removed from this iPhone. Finishing the lesson still counts.")
        }
    }

    /// The photograph on the path's soft tint, with the tint's deeper edge under it
    /// as the path cards have, and the lesson's own drawing in its badge.
    private func photoBand(_ page: SketchbookPage, lesson: Lesson?) -> some View {
        let tint = (app.path(forLesson: page.lessonId) ?? app.path(id: page.pathId))
            .map { app.tint(for: $0) }
        let shape = RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous)

        // A screen-sized copy, decoded once: the full photo is only read to share it.
        return SketchbookShot(image: app.sketchbook.thumbnail(for: page, maxPixelSize: 1400),
                              tutorial: lesson?.tutorial)
            .lessonBadge(lesson?.tutorial)
            .accessibilityElement()
            .accessibilityLabel("Your \(lesson?.title ?? "page"), \(SketchbookDate.spoken(page.completedAt))")
            .accessibilityAddTraits(.isImage)
            .padding(12)
            .background(shape.fill(tint?.soft ?? Theme.surface))
            .background(alignment: .bottom) {
                shape.fill(tint?.edge ?? Theme.line).offset(y: 5)
            }
            .padding(.bottom, 5)
    }

    /// Title, one short line, and the gold "Drawn" chip. Above the accessibility
    /// sizes the chip drops below the text.
    private func facts(_ page: SketchbookPage, lesson: Lesson?) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: Theme.stackSpacing) {
                factsText(page, lesson: lesson)
                Chip(text: "Drawn", systemImage: "checkmark", style: .gold)
                    .padding(.top, 2)
            }

            VStack(alignment: .leading, spacing: 8) {
                factsText(page, lesson: lesson)
                Chip(text: "Drawn", systemImage: "checkmark", style: .gold)
            }
        }
        .padding(.top, 4)
    }

    private func factsText(_ page: SketchbookPage, lesson: Lesson?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(lesson?.title ?? "Lesson removed")
                .textRole(.title2)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)

            Text(metaLine(page))
                .textRole(.subhead)
                .foregroundStyle(Theme.ink55)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityLabel(spokenMetaLine(page))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// "Plants · Sep 22": the path, when the catalog still has it, and the day.
    private func metaLine(_ page: SketchbookPage) -> String {
        let day = SketchbookDate.short(page.completedAt)
        guard let path = app.path(forLesson: page.lessonId) ?? app.path(id: page.pathId) else { return day }
        return "\(path.title) · \(day)"
    }

    private func spokenMetaLine(_ page: SketchbookPage) -> String {
        let day = SketchbookDate.spoken(page.completedAt)
        guard let path = app.path(forLesson: page.lessonId) ?? app.path(id: page.pathId) else { return day }
        return "\(path.title), \(day)"
    }

    /// One calm surface row. The placeholder steers the note towards observation
    /// rather than self-criticism.
    private var noteField: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "pencil")
                .scaledFont(18, .semibold, design: .default)
                .foregroundStyle(Theme.ink40)
                .frame(width: 22, height: 22)
                .padding(.top, 2)
                .accessibilityHidden(true)

            // A vertical TextField truncates its own placeholder to one line; the
            // mockup's prompt is two. So the placeholder is drawn behind it.
            ZStack(alignment: .topLeading) {
                if note.isEmpty {
                    Text("Add a note. What you noticed, what to try next time.")
                        .textRole(.body)
                        .foregroundStyle(Theme.ink40)
                        .fixedSize(horizontal: false, vertical: true)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }

                TextField("", text: $note, axis: .vertical)
                    .textFieldStyle(.plain)
                    .textRole(.body)
                    .foregroundStyle(Theme.ink)
                    .tint(Theme.green)
                    .focused($isEditingNote)
                    .submitLabel(.done)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 14)
        .padding(.horizontal, 16)
        .frame(minHeight: Theme.minimumTapTarget, alignment: .top)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Theme.surface))
        .accessibilityLabel(note.isEmpty ? "Add a note" : "Note")
    }

    /// Share and Delete as visible quiet buttons, so nobody has to discover an
    /// ellipsis. Delete is destructive and always confirmed.
    private func quietActions(_ page: SketchbookPage) -> some View {
        HStack(spacing: Theme.stackSpacing) {
            Group {
                if let shareURL {
                    ShareLink(item: shareURL, preview: SharePreview(shareTitle(page))) {
                        Label("Share", systemImage: "square.and.arrow.up")
                            .textRole(.headline)
                            .foregroundStyle(Theme.ink70)
                            .frame(maxWidth: .infinity, minHeight: 48)
                    }
                } else {
                    Color.clear.frame(maxWidth: .infinity, minHeight: 48)
                }
            }

            Button(role: .destructive) {
                isConfirmingDelete = true
            } label: {
                Label("Delete", systemImage: "trash")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.quietDanger)
        }
    }

    private var missing: some View {
        VStack(spacing: Theme.stackSpacing) {
            Text("This page is no longer in your sketchbook.")
                .textRole(.body)
                .foregroundStyle(Theme.ink55)
                .multilineTextAlignment(.center)
        }
        .padding(Theme.gutter)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Doing it

    private func saveNote() {
        guard didLoadNote else { return }
        app.sketchbook.update(note: note, for: pageId)
    }

    private func shareTitle(_ page: SketchbookPage) -> String {
        app.lesson(id: page.lessonId)?.title ?? "Your page"
    }

    /// A private export: the JPEG itself, to Messages, Mail, Files or AirDrop. No
    /// in-app sharing, no link, no post.
    private func makeShareFile(for page: SketchbookPage) -> URL? {
        guard let image = app.sketchbook.image(for: page),
              let data = SketchbookStore.jpegData(from: image) else { return nil }
        let name = shareTitle(page).replacingOccurrences(of: "/", with: "-")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(name).jpg")
        do {
            try data.write(to: url, options: .atomic)
            return url
        } catch {
            return nil
        }
    }
}
