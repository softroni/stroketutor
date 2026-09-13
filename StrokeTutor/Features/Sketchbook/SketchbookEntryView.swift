import SwiftUI
import UIKit

/// `sk-entry` — one kept page: the photograph large, the lesson it came from, the
/// date, a note, and the quiet actions. Delete always asks.
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
        Group {
            if let page {
                content(page)
            } else {
                missing
            }
        }
        .background(Theme.page.ignoresSafeArea())
        .navigationTitle("Sketchbook")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let shareURL, let page {
                ToolbarItem(placement: .topBarTrailing) {
                    ShareLink(item: shareURL, preview: SharePreview(shareTitle(page))) {
                        Image(systemName: "square.and.arrow.up")
                    }
                    .accessibilityLabel("Share")
                }
            }
        }
    }

    // MARK: - The page

    private func content(_ page: SketchbookPage) -> some View {
        let lesson = app.lesson(id: page.lessonId)

        return ScrollView {
            VStack(spacing: Theme.stackSpacing) {
                SketchbookShot(image: app.sketchbook.image(for: page), tutorial: lesson?.tutorial)
                    .accessibilityElement()
                    .accessibilityLabel("Your \(lesson?.title ?? "page"), \(Self.spokenDate.string(from: page.completedAt))")
                    .accessibilityAddTraits(.isImage)

                facts(page, lesson: lesson)

                noteField

                if let lesson {
                    Button {
                        app.showPreview(of: lesson)
                    } label: {
                        Label("Draw it again", systemImage: "pencil")
                    }
                    .buttonStyle(.secondary)
                    .padding(.top, 4)
                }

                quietActions(page)
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.top, Theme.stackSpacing)
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

    /// Title, the lesson's place in its path, the full date, and the gold "Drawn"
    /// chip. Above the accessibility sizes the chip drops below the text.
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
    }

    private func factsText(_ page: SketchbookPage, lesson: Lesson?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(lesson?.title ?? "Lesson removed")
                .textRole(.title2)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)

            if let meta = metaLine(page, lesson: lesson) {
                Text(meta)
                    .textRole(.subhead)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Text(page.completedAt.formatted(date: .complete, time: .omitted))
                .textRole(.footnote)
                .foregroundStyle(Theme.ink55)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// "Trees · Lesson 1 of 8 · 16 steps". Whatever the catalog can no longer tell
    /// us is simply left out rather than guessed.
    private func metaLine(_ page: SketchbookPage, lesson: Lesson?) -> String? {
        var parts: [String] = []
        let path = app.path(id: page.pathId)
        if let path { parts.append(path.title) }
        if let lesson, let path, let position = path.position(of: lesson.id) {
            parts.append("Lesson \(position) of \(path.lessonCount)")
        }
        if let lesson { parts.append(lesson.stepCountText) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// One calm surface row. The placeholder steers the note towards observation
    /// rather than self-criticism.
    private var noteField: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "pencil")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.ink40)
                .frame(width: 22, height: 22)
                .padding(.top, 2)
                .accessibilityHidden(true)

            // A vertical TextField truncates its own placeholder to one line; the
            // mockup's prompt is two. So the placeholder is drawn behind it.
            ZStack(alignment: .topLeading) {
                if note.isEmpty {
                    Text("Add a note. What you noticed, what to try next time.")
                        .font(.system(size: 17, weight: .medium, design: .rounded))
                        .foregroundStyle(Theme.ink40)
                        .fixedSize(horizontal: false, vertical: true)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }

                TextField("", text: $note, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.system(size: 17, weight: .medium, design: .rounded))
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
                            .font(.system(size: 17, weight: .bold, design: .rounded))
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

    /// "28 August", for VoiceOver.
    private static let spokenDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("d MMMM")
        return formatter
    }()
}
