import SwiftUI
import UIKit

/// `sk-entry` — one kept page: the photograph large on a band in its path's tint,
/// with the lesson it was drawn from in color in the corner, then the lesson's name,
/// one short line ("Plants · Sep 22"), the gold "Drawn" chip, a note, the green way to
/// share it, and the quiet actions: draw it again, and delete. Delete always asks.
/// Tapping the photograph shows it full screen (`SketchbookPhotoViewer`); Edit on its
/// corner makes it again from the photo as taken (`SketchbookPageEditor`).
///
/// Plan §32: "Associate the image with lesson, path, and completion date." Since
/// 2026-10-01 (the creator's call) sharing leads: a friend who sees a real drawing
/// is how Paper Coach gets found (`DrawingShare`). With no photo on the device there
/// is nothing to share, and drawing it again leads instead.
struct SketchbookEntryView: View {
    let pageId: UUID

    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    @State private var note = ""
    @State private var didLoadNote = false
    @State private var isConfirmingDelete = false
    /// The photograph at full size, while it is shown full screen.
    @State private var fullScreenPhoto: FullScreenPhoto?
    @State private var isEditingPhoto = false
    /// What the share sheet points at on iPad: the bar's button, or the green one.
    @State private var barShareAnchor = ShareAnchor()
    @State private var buttonShareAnchor = ShareAnchor()
    /// A share waiting for the grown-ups' check (a child's profile), or going
    /// straight through it.
    @State private var shareRequest: GrownUpCheckRequest?

    @FocusState private var isEditingNote: Bool

    private var page: SketchbookPage? { app.sketchbook.page(id: pageId) }

    var body: some View {
        VStack(spacing: 0) {
            // The v3 bar (`sk-entry`): a bare chevron, "Sketchbook" 17/heavy, and
            // the share button as the one trailing control — the same bar the Home
            // group draws, rather than the system one.
            InlineNavBar(title: "Sketchbook", onBack: { dismiss() }) {
                if let page, photo(for: page) != nil {
                    Button {
                        share(page, from: barShareAnchor)
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                            .scaledFont(19, .semibold, design: .default)
                            .foregroundStyle(Theme.ink)
                            .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .shareAnchor(barShareAnchor)
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
        .grownUpCheck($shareRequest)
        #if DEBUG
        // Screenshot-harness only: `DebugScreenHarness`'s `entry-delete`,
        // `entry-edit` and `entry-share` cases set these flags because the
        // confirmation alert, the editor and the share are behind this view's own
        // private `@State`, which a launch argument cannot reach directly.
        .onAppear {
            if DebugScreenHarness.raiseDeleteConfirmation {
                DebugScreenHarness.raiseDeleteConfirmation = false
                isConfirmingDelete = true
            }
            if DebugScreenHarness.raisePageEditor {
                DebugScreenHarness.raisePageEditor = false
                isEditingPhoto = true
            }
            if DebugScreenHarness.raiseShareSheet, let page {
                DebugScreenHarness.raiseShareSheet = false
                // Once the push has settled and the green button is on screen.
                Task {
                    try? await Task.sleep(for: .seconds(1))
                    share(page, from: buttonShareAnchor)
                }
            }
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

                if photo(for: page) != nil {
                    Button {
                        share(page, from: buttonShareAnchor)
                    } label: {
                        Label("Share your drawing", systemImage: "square.and.arrow.up")
                    }
                    .buttonStyle(.primary)
                    .shareAnchor(buttonShareAnchor)
                    .padding(.top, 4)
                } else if let lesson {
                    drawAgainButton(lesson)
                        .buttonStyle(.primary)
                        .padding(.top, 4)
                }

                quietActions(drawAgain: photo(for: page) != nil ? lesson : nil)
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
        }
        .onChange(of: isEditingNote) { _, editing in
            if !editing { saveNote() }
        }
        .onDisappear { saveNote() }
        .fullScreenCover(item: $fullScreenPhoto) { photo in
            SketchbookPhotoViewer(image: photo.image, accessibilityLabel: photo.label)
                .presentationBackground(.clear)
        }
        .fullScreenCover(isPresented: $isEditingPhoto) {
            SketchbookPageEditor(page: page,
                                 sketchbook: app.sketchbook,
                                 title: shareTitle(page),
                                 onClose: { isEditingPhoto = false })
        }
        .alert("Delete this page?", isPresented: $isConfirmingDelete) {
            Button("Delete", role: .destructive) {
                app.sketchbook.delete(page)
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The photo and your note are removed from this \(DeviceName.current). Finishing the lesson still counts.")
        }
    }

    /// The photograph on the path's soft tint, with the tint's deeper edge under it
    /// as the path cards have, and the lesson's own drawing in its badge. A tap
    /// shows it full screen; with no photo on the device there is nothing to show.
    private func photoBand(_ page: SketchbookPage, lesson: Lesson?) -> some View {
        let tint = (app.path(forLesson: page.lessonId) ?? app.path(id: page.pathId))
            .map { app.tint(for: $0) }
        let shape = RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous)
        let image = photo(for: page)
        let label = "Your \(lesson?.title ?? "page"), \(SketchbookDate.spoken(page.completedAt))"

        let shot = SketchbookShot(image: image, tutorial: lesson?.tutorial)
            .lessonBadge(lesson?.tutorial)

        return Group {
            if image != nil {
                Button {
                    showFullScreen(page, label: label)
                } label: {
                    shot
                }
                .buttonStyle(PressableSlotStyle())
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(label)
                .accessibilityHint("Shows it full screen")
                .accessibilityAddTraits([.isImage, .isButton])
            } else {
                shot
                    .accessibilityElement()
                    .accessibilityLabel(label)
                    .accessibilityAddTraits(.isImage)
            }
        }
            .overlay(alignment: .topTrailing) {
                if image != nil { editButton }
            }
            .padding(12)
            .background(shape.fill(tint?.soft ?? Theme.surface))
            .background(alignment: .bottom) {
                shape.fill(tint?.edge ?? Theme.line).offset(y: 5)
            }
            .padding(.bottom, 5)
    }

    /// Edit, on the photograph's corner where the eye already is: the light and
    /// the corners chosen again (`SketchbookPageEditor`).
    private var editButton: some View {
        Button {
            isEditingPhoto = true
        } label: {
            Label("Edit", systemImage: "slider.horizontal.3")
                .scaledFont(15, .bold)
                .foregroundStyle(Theme.ink)
                .padding(.horizontal, 14)
                .frame(minHeight: 36)
                .background(Capsule().fill(Theme.card))
                .shadow(color: .black.opacity(0.16), radius: 3, y: 1)
                .frame(minHeight: Theme.minimumTapTarget)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.top, 4)
        .padding(.trailing, 10)
        .accessibilityHint("Change the light or the corners of this photo")
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

    /// Back to the lesson's preview, to draw the page again.
    private func drawAgainButton(_ lesson: Lesson) -> some View {
        Button {
            app.showPreview(of: lesson)
        } label: {
            Label("Draw it again", systemImage: "pencil")
        }
    }

    /// Draw it again (when sharing leads) and Delete as visible quiet buttons, so
    /// nobody has to discover an ellipsis. Delete is destructive and always
    /// confirmed, and keeps its place on the right either way.
    private func quietActions(drawAgain lesson: Lesson?) -> some View {
        HStack(spacing: Theme.stackSpacing) {
            Group {
                if let lesson {
                    Button {
                        app.showPreview(of: lesson)
                    } label: {
                        Label("Draw it again", systemImage: "pencil")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.quiet)
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

    /// The photo for the full-screen viewer.
    private struct FullScreenPhoto: Identifiable {
        let id = UUID()
        let image: UIImage
        let label: String
    }

    /// Large enough to zoom into, still a decoded copy rather than the whole file.
    private func showFullScreen(_ page: SketchbookPage, label: String) {
        guard let image = app.sketchbook.thumbnail(for: page, maxPixelSize: 3000) else { return }
        fullScreenPhoto = FullScreenPhoto(image: image, label: label)
    }

    private func saveNote() {
        guard didLoadNote else { return }
        app.sketchbook.update(note: note, for: pageId)
    }

    private func shareTitle(_ page: SketchbookPage) -> String {
        app.lesson(id: page.lessonId)?.title ?? "Your page"
    }

    /// A screen-sized copy, decoded once and cached: what the band shows and the
    /// share card is made from. The full photo is only read to look at it full
    /// screen. Nil when the photo has gone from the device.
    private func photo(for page: SketchbookPage) -> UIImage? {
        app.sketchbook.thumbnail(for: page, maxPixelSize: 1400)
    }

    /// The card, to wherever the learner sends it (`DrawingShare`); on a child's
    /// profile, after the grown-ups' check.
    private func share(_ page: SketchbookPage, from anchor: ShareAnchor) {
        shareRequest = DrawingShare.request(sharing: page, photo: photo(for: page),
                                            app: app, entry: .sketchbook, from: anchor)
    }
}
