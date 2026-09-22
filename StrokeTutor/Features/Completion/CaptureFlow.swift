import PhotosUI
import SwiftUI
import UIKit

/// `sk-capture` — turning the paper drawing into a sketchbook entry: why we ask for
/// the camera, the photograph itself, a look before keeping, and the confirmation.
///
/// Plan §32: "Photograph the physical page after a tutorial. Store locally and
/// privately by default." Fast enough to do every time, honest enough that nobody is
/// surprised later about where the picture went.
struct CaptureFlow: View {
    let lesson: Lesson

    @Environment(AppModel.self) private var app
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private enum Stage: Equatable {
        case primer
        case review(UIImage)
        case saved(SketchbookPage)
    }

    @State private var stage: Stage = .primer
    /// The learner's stores when this flow opened. Keep writes here even if the app has
    /// switched to someone else meanwhile, so a page never lands in the wrong
    /// sketchbook.
    @State private var owner: AppModel.ProfileStores?
    @State private var isSaving = false

    private var sketchbook: SketchbookStore { owner?.sketchbook ?? app.sketchbook }

    init(lesson: Lesson) {
        self.lesson = lesson
    }

    #if DEBUG
    /// Screenshot-harness only (`DebugScreenHarness`, via `AppRoot`): lands
    /// straight on **review** or **saved** instead of **primer**, for the two
    /// stages this flow normally reaches only through the camera or Photos
    /// picker, which `xcrun simctl` cannot drive. At most one of the two debug
    /// images should be passed; passing neither behaves exactly like the plain
    /// initialiser above.
    init(lesson: Lesson, debugReviewImage: UIImage?, debugSavedPage: SketchbookPage?) {
        self.lesson = lesson
        if let debugReviewImage {
            _stage = State(initialValue: .review(debugReviewImage))
        } else if let debugSavedPage {
            _stage = State(initialValue: .saved(debugSavedPage))
        }
    }
    #endif
    @State private var isShowingCamera = false
    @State private var photoItem: PhotosPickerItem?
    @State private var isPickingFromPhotos = false
    /// Set when the page could not be written; the learner stays on review with the
    /// photograph still in memory, as the notes require.
    @State private var didFailToSave = false

    var body: some View {
        Group {
            switch stage {
            case .primer:
                primer
            case let .review(image):
                review(image)
            case let .saved(page):
                saved(page)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.page.ignoresSafeArea())
        .onAppear {
            if owner == nil { owner = app.activeStores }
        }
        .fullScreenCover(isPresented: $isShowingCamera) {
            CameraPicker { image in
                isShowingCamera = false
                if let image { stage = .review(image) }
            }
            .ignoresSafeArea()
        }
        .photosPicker(isPresented: $isPickingFromPhotos,
                      selection: $photoItem,
                      matching: .images,
                      photoLibrary: .shared())
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self),
                   let image = UIImage(data: data) {
                    stage = .review(image)
                }
                photoItem = nil
            }
        }
    }

    // MARK: - primer

    /// Shown before the camera is ever asked for, so "Don't Allow" is an informed
    /// choice. "Choose from Photos" needs no permission at all.
    private var primer: some View {
        VStack(spacing: 0) {
            navigationBar(title: nil, leading: .back) {
                // Back to the screen this flow was opened from, without recording
                // the lesson as finished a second time.
                app.cover = .completion(lessonId: lesson.id)
            }

            ScrollView {
                VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                    Image(systemName: "camera")
                        .scaledFont(28, .semibold, design: .default)
                        .foregroundStyle(Theme.ink)
                        .frame(width: 56, height: 56)
                        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Theme.surface))
                        .padding(.top, 4)
                        .accessibilityHidden(true)

                    Text("A photo of the page")
                        .textRole(.title1)
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)

                    Text("Your sketchbook keeps photographs of the real pages you drew, so you can look back at them.")
                        .textRole(.bodyRegular)
                        .foregroundStyle(Theme.ink55)
                        .fixedSize(horizontal: false, vertical: true)

                    ListCard(isSoft: true) {
                        promise("Photos stay on this iPhone, inside StrokeTutor.")
                        RowDivider(isSoft: true)
                        promise("Nothing is uploaded. There is no feed to post to.")
                        RowDivider(isSoft: true)
                        promise("They do not go to your Photos library unless you ask.")
                    }
                    .padding(.top, 8)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Theme.gutter)
            }

            VStack(spacing: Theme.stackSpacing) {
                Button {
                    // No camera in the simulator, and none on some devices: go
                    // straight to Photos rather than open a picker that cannot shoot.
                    if CameraPicker.isAvailable {
                        isShowingCamera = true
                    } else {
                        isPickingFromPhotos = true
                    }
                } label: {
                    Label("Use the camera", systemImage: "camera")
                }
                .buttonStyle(.primary)

                Button {
                    isPickingFromPhotos = true
                } label: {
                    Label("Choose from Photos", systemImage: "photo")
                }
                .buttonStyle(.secondary)

                Button("Not now") { app.returnToPathDetail(for: lesson) }
                    .buttonStyle(.quiet)
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.vertical, Theme.stackSpacing)
        }
    }

    /// One of the three promises: a green check tile and a line (`.list--soft` row).
    private func promise(_ text: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: "checkmark")
                .scaledFont(17, .bold, design: .default)
                .foregroundStyle(Theme.green)
                .frame(width: 40, height: 40)
                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Theme.greenSoft))
            Text(text)
                .textRole(.body)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 18)
        .frame(minHeight: Theme.minimumTapTarget)
        .accessibilityElement(children: .combine)
    }

    // MARK: - review

    /// The photograph and the lesson side by side, so the learner compares rather
    /// than judges.
    private func review(_ image: UIImage) -> some View {
        VStack(spacing: 0) {
            navigationBar(title: lesson.title, leading: .close) { retake() }

            // The mockup spaces this block off both ends of the screen; spacers only
            // do that outside a scroll view, so it scrolls only where it has to.
            scrollingIfNeeded {
                VStack(spacing: Theme.stackSpacing) {
                    Spacer(minLength: 0)

                    Text("Keep this one?")
                        .textRole(.title2)
                        .foregroundStyle(Theme.ink)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 8)

                    // Side by side, "so the learner compares rather than judges" —
                    // and one under the other only above .accessibilityMedium, as
                    // the screen's notes say. (Not `ViewThatFits`: both cards size
                    // themselves from the space they are given, so it always reads
                    // them as too wide and stacks them.)
                    Group {
                        if dynamicTypeSize > .accessibility2 {
                            VStack(spacing: Theme.stackSpacing) { reviewPair(image) }
                        } else {
                            HStack(alignment: .top, spacing: Theme.stackSpacing) { reviewPair(image) }
                        }
                    }
                    .padding(.top, 4)

                    Button {} label: {
                        Label("Crop & straighten", systemImage: "crop")
                            .scaledFont(17, .heavy)
                    }
                    .buttonStyle(.soft)
                    .disabled(true)
                    // `.btn[disabled] { opacity: .4 }` — a custom style does not dim
                    // itself, and a control that looks live but is not is a lie.
                    .opacity(0.4)
                    .padding(.top, 8)
                    .accessibilityHint("Not ready yet")

                    // The mockup's footnote, made honest: the edit is not built, and
                    // the promise about filters holds either way.
                    Text("Crop and straighten are not ready yet. There are no filters and no touch-ups.")
                        .textRole(.subhead)
                        .foregroundStyle(Theme.ink55)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)

                    if didFailToSave {
                        Text("That page could not be saved. Try Keep again.")
                            .textRole(.footnote)
                            .foregroundStyle(Theme.danger)
                            .multilineTextAlignment(.center)
                    }

                    Spacer(minLength: 0)
                }
                .padding(.horizontal, Theme.gutter)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }

            HStack(spacing: Theme.stackSpacing) {
                Button { retake() } label: {
                    Label("Retake", systemImage: "arrow.counterclockwise")
                }
                .buttonStyle(.secondary)

                Button { keep(image) } label: {
                    Label("Keep", systemImage: "checkmark")
                }
                .buttonStyle(.primary)
                .disabled(isSaving)
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.vertical, Theme.stackSpacing)
        }
    }

    @ViewBuilder
    private func reviewPair(_ image: UIImage) -> some View {
        VStack(spacing: 8) {
            SketchbookShot(image: image)
                .accessibilityElement()
                .accessibilityLabel("The photo you just took")
                .accessibilityAddTraits(.isImage)
            Text("Your page")
                .textRole(.footnote)
                .foregroundStyle(Theme.ink55)
        }

        VStack(spacing: 8) {
            PageThumb(tutorial: lesson.tutorial)
                .accessibilityElement()
                .accessibilityLabel("The finished \(lesson.title) lesson drawing")
                .accessibilityAddTraits(.isImage)
            Text("The lesson")
                .textRole(.footnote)
                .foregroundStyle(Theme.ink55)
        }
    }

    // MARK: - saved

    /// The green chip is the whole celebration.
    private func saved(_ page: SketchbookPage) -> some View {
        VStack(spacing: 0) {
            scrollingIfNeeded {
                VStack(spacing: Theme.stackSpacing) {
                    Spacer(minLength: 24)

                    Chip(text: "Saved to your sketchbook", systemImage: "checkmark", style: .green)

                    SketchbookShot(image: sketchbook.image(for: page), tutorial: lesson.tutorial)
                        .frame(width: 196)
                        .padding(.top, 8)
                        .accessibilityElement()
                        .accessibilityLabel("Your \(lesson.title) page")
                        .accessibilityAddTraits(.isImage)

                    VStack(spacing: 4) {
                        Text(lesson.title)
                            .textRole(.title2)
                            .foregroundStyle(Theme.ink)
                            .multilineTextAlignment(.center)

                        Text(savedMeta(page))
                            .textRole(.subhead)
                            .foregroundStyle(Theme.ink55)
                            .multilineTextAlignment(.center)

                        Text("Kept on this iPhone only. Nothing is uploaded.")
                            .textRole(.footnote)
                            .foregroundStyle(Theme.ink55)
                            .multilineTextAlignment(.center)
                            .padding(.top, 6)
                    }
                    .padding(.top, 8)

                    Spacer(minLength: 24)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.horizontal, Theme.gutter)
            }

            VStack(spacing: Theme.stackSpacing) {
                if let next = app.nextLesson(after: lesson) {
                    Button("Next lesson") {
                        app.dismissCover()
                        app.showPreview(of: next)
                    }
                    .buttonStyle(.primary)
                }

                Button {
                    app.dismissCover()
                    app.selectedTab = .sketchbook
                } label: {
                    Label("Open your sketchbook", systemImage: "book")
                }
                .buttonStyle(app.nextLesson(after: lesson) == nil ? .primary : .secondary)

                Button("Done") { app.returnToPathDetail(for: lesson) }
                    .buttonStyle(.quiet)
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.vertical, Theme.stackSpacing)
        }
    }

    /// "Houses · Lesson 3 · Saturday, 12 September 2026".
    private func savedMeta(_ page: SketchbookPage) -> String {
        var parts: [String] = []
        if let path = app.path(id: lesson.pathId) {
            parts.append(path.title)
            if let position = path.position(of: lesson.id) {
                parts.append("Lesson \(position)")
            }
        }
        parts.append(page.completedAt.formatted(date: .complete, time: .omitted))
        return parts.joined(separator: " · ")
    }

    // MARK: - Doing it

    private func retake() {
        didFailToSave = false
        if CameraPicker.isAvailable {
            isShowingCamera = true
        } else {
            stage = .primer
        }
    }

    /// Writes the page, then the confirmation. The date is the lesson's own
    /// completion date, so the sketchbook and the completion chip agree.
    ///
    /// The JPEG is written off the main thread into the sketchbook this flow opened
    /// with (`owner`), so the page belongs to the learner who took it however the save
    /// and a profile switch interleave.
    private func keep(_ image: UIImage) {
        guard !isSaving else { return }
        let stores = owner ?? app.activeStores
        let completedAt = stores.progress.progress(for: lesson.id)?.completedAt ?? Date()
        let alsoSaveToPhotos = app.settings.alsoSaveToPhotos
        isSaving = true
        Task {
            let page = await stores.sketchbook.addPage(image: image,
                                                       lessonId: lesson.id,
                                                       pathId: lesson.pathId,
                                                       completedAt: completedAt)
            isSaving = false
            guard let page else {
                didFailToSave = true
                return
            }
            didFailToSave = false
            if alsoSaveToPhotos {
                PhotoLibraryWriter.save(image)
            }
            stage = .saved(page)
        }
    }

    // MARK: - Chrome

    /// A body laid out with spacers, which only work outside a scroll view — until
    /// the accessibility sizes, where the content stops fitting and has to scroll.
    @ViewBuilder
    private func scrollingIfNeeded<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        if dynamicTypeSize.isAccessibilitySize {
            ScrollView { content() }
        } else {
            content()
        }
    }

    private enum LeadingGlyph {
        case back, close

        var symbol: String {
            switch self {
            case .back: return "chevron.left"
            case .close: return "xmark"
            }
        }

        var label: String {
            switch self {
            case .back: return "Back"
            case .close: return "Back to the camera"
            }
        }
    }

    /// The 56 pt bar of `.navbar`: a 44 pt glyph, a centred title, nothing else.
    private func navigationBar(title: String?,
                               leading: LeadingGlyph,
                               action: @escaping () -> Void) -> some View {
        ZStack {
            if let title {
                Text(title)
                    .scaledFont(17, .heavy, relativeTo: .headline)
                    .tracking(-0.2)
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                    .padding(.horizontal, 60)
            }

            HStack {
                Button(action: action) {
                    Image(systemName: leading.symbol)
                        .scaledFont(20, .bold, design: .default)
                        .foregroundStyle(Theme.ink)
                        .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel(leading.label)
                Spacer()
            }
            .padding(.horizontal, 8)
        }
        .frame(height: 56)
    }
}
