import SwiftUI
import UIKit

/// `sk-edit` — a kept page made again from the photo as it was taken: the light
/// chosen afresh, the corners moved. Opened by Edit on `sk-entry`, so a page kept
/// grey on a dim evening can be brightened the next morning. Cancel leaves the page
/// as it was; Save gives it its new picture (`SketchbookStore.edit`). The note, the
/// date and the lesson stay the page's own.
///
/// The same two choices as the capture review, and the same pieces: a `PageDraft`,
/// the `LightPicker` and the `CornerEditor`.
struct SketchbookPageEditor: View {
    let page: SketchbookPage
    /// The sketchbook the page is in, held from the moment the editor opens, so a
    /// profile switch meanwhile still saves into the right one.
    let sketchbook: SketchbookStore
    /// The lesson's name, for the bar.
    let title: String
    let onClose: () -> Void

    @Environment(\.isWideLayout) private var isWide
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// Nil until the original is read and straightened, which takes a moment.
    @State private var draft: PageDraft?
    @State private var look: PageLook
    /// The page as it is now: what shows until the draft is ready.
    @State private var pageImage: UIImage?
    @State private var isEditingCorners = false
    @State private var isSaving = false
    @State private var didFailToSave = false

    init(page: SketchbookPage, sketchbook: SketchbookStore, title: String, onClose: @escaping () -> Void) {
        self.page = page
        self.sketchbook = sketchbook
        self.title = title
        self.onClose = onClose
        _look = State(initialValue: page.look)
    }

    var body: some View {
        VStack(spacing: 0) {
            Text(title)
                .scaledFont(17, .heavy, relativeTo: .headline)
                .tracking(-0.2)
                .foregroundStyle(Theme.ink)
                .lineLimit(1)
                .padding(.horizontal, 60)
                .frame(height: 56)
                .accessibilityAddTraits(.isHeader)

            scrollingIfNeeded {
                VStack(spacing: Theme.stackSpacing) {
                    SketchbookShot(image: draft?.shown(in: look) ?? pageImage)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .accessibilityElement()
                        .accessibilityLabel("Your \(title) page")
                        .accessibilityValue(look == .original ? "" : look.title)
                        .accessibilityAddTraits(.isImage)

                    LightPicker(look: $look)
                        .padding(.top, 4)

                    Button { isEditingCorners = true } label: {
                        Label(draft?.corners == nil ? "Crop" : "Fix corners", systemImage: "crop")
                            .scaledFont(17, .heavy)
                    }
                    .buttonStyle(.soft)
                    .padding(.top, 4)
                    .disabled(draft == nil)
                    .accessibilityHint("Move the corners onto the edges of your paper")

                    if didFailToSave {
                        Text("That could not be saved. Try Save again.")
                            .textRole(.footnote)
                            .foregroundStyle(Theme.danger)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal, Theme.gutter)
                .padding(.top, 8)
            }

            HStack(spacing: Theme.stackSpacing) {
                Button("Cancel") { onClose() }
                    .buttonStyle(.secondary)

                Button { save() } label: {
                    Label("Save", systemImage: "checkmark")
                }
                .buttonStyle(.primary)
                .disabled(draft == nil || isSaving)
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.vertical, Theme.stackSpacing)
        }
        .readableColumn(isWide, maxWidth: 680)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.page.ignoresSafeArea())
        .task { await open() }
        // Once per page: when it opens, then again whenever the corners move.
        .task(id: draft.map { ObjectIdentifier($0.displayed) }) { await makeLooks() }
        .fullScreenCover(isPresented: $isEditingCorners) {
            if let draft {
                CornerEditor(image: draft.original,
                             corners: draft.corners,
                             detectedCorners: draft.detectedCorners,
                             onCancel: { isEditingCorners = false },
                             onDone: { corners, straightened in
                                 applyCorners(corners, page: straightened, to: draft.id)
                                 isEditingCorners = false
                             })
            }
        }
    }

    // MARK: - Doing it

    /// Reads the original, straightens it to the page's corners and makes its
    /// looks, then shows it; Vision looks for the paper meanwhile, for the corner
    /// editor's Reset. A page with no original of its own is its own photo as
    /// taken, so it starts unstraightened.
    private func open() async {
        guard draft == nil else { return }
        pageImage = sketchbook.thumbnail(for: page, maxPixelSize: 1400)
        guard let original = sketchbook.original(for: page) else { return }
        let corners = page.originalFile == nil ? nil : page.corners

        async let detected = PageCropper.detectPage(in: original)
        var displayed = original
        if let corners, let straightened = await PageCropper.correct(original, to: corners) {
            displayed = straightened
        }
        var fresh = PageDraft(original: original, corners: corners, displayed: displayed)
        fresh.looks = await PageLook.previews(of: displayed)
        fresh.detectedCorners = await detected
        guard !Task.isCancelled else { return }
        draft = fresh
    }

    /// The looks again, after the corners have moved.
    private func makeLooks() async {
        guard let started = draft, started.looks.isEmpty else { return }
        let straightened = started.displayed
        let looks = await PageLook.previews(of: straightened)
        guard !Task.isCancelled, var current = draft, current.id == started.id,
              current.displayed === straightened else { return }
        current.looks = looks
        draft = current
    }

    private func applyCorners(_ corners: PageCorners, page straightened: UIImage, to draftId: UUID) {
        guard var current = draft, current.id == draftId else { return }
        current.corners = corners
        current.displayed = straightened
        draft = current
    }

    /// Writes the page in its new look and corners, at full size. Unchanged, it
    /// only closes.
    private func save() {
        guard let draft, !isSaving else { return }
        let keptCorners = page.originalFile == nil ? nil : page.corners
        guard draft.corners != keptCorners || look != page.look else {
            onClose()
            return
        }
        let look = look
        isSaving = true
        didFailToSave = false
        Task {
            let image = await draft.rendered(in: look)
            let saved = await sketchbook.edit(pageId: page.id, image: image, corners: draft.corners, look: look)
            isSaving = false
            if saved {
                onClose()
            } else {
                didFailToSave = true
            }
        }
    }

    /// The photo fills what the choices leave, until the accessibility sizes,
    /// where the whole screen scrolls instead.
    @ViewBuilder
    private func scrollingIfNeeded<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        if dynamicTypeSize.isAccessibilitySize {
            ScrollView { content() }
        } else {
            content()
        }
    }
}
