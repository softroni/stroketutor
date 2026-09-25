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
    /// Opened from a finished lesson's empty Sketchbook slot: the learner came to
    /// add a photo, so leaving goes back to the Sketchbook rather than to the path.
    let fromSketchbook: Bool

    @Environment(AppModel.self) private var app
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private enum Stage: Equatable {
        case primer
        case review(ReviewPhoto)
        case saved(SketchbookPage)
    }

    /// One photograph on the review stage: the shot as taken, the corners of the
    /// paper once auto-crop or the learner has set them, and the picture "Your
    /// page" shows, which is what Keep saves. Retake throws all of it away.
    private struct ReviewPhoto: Equatable {
        /// Tells one photo from the next, so a slow auto-crop never lands on a
        /// photo taken after it started.
        let id = UUID()
        let original: UIImage
        /// What auto-crop found, kept for the editor's Reset.
        var detectedCorners: PageCorners?
        /// The corners the shown page was straightened from; nil while it is the
        /// photo as taken.
        var corners: PageCorners?
        var displayed: UIImage

        init(original: UIImage) {
            self.original = original
            self.displayed = original
        }
    }

    @State private var stage: Stage = .primer
    /// The learner's stores when this flow opened. Keep writes here even if the app has
    /// switched to someone else meanwhile, so a page never lands in the wrong
    /// sketchbook.
    @State private var owner: AppModel.ProfileStores?
    @State private var isSaving = false

    private var sketchbook: SketchbookStore { owner?.sketchbook ?? app.sketchbook }
    @State private var isEditingCorners = false
    /// Screenshot harness only: raise the corner editor once auto-crop answers.
    @State private var opensCornerEditorAfterAutoCrop = false

    init(lesson: Lesson, fromSketchbook: Bool = false) {
        self.lesson = lesson
        self.fromSketchbook = fromSketchbook
    }

    #if DEBUG
    /// Screenshot-harness only (`DebugScreenHarness`, via `AppRoot`): lands
    /// straight on **review** or **saved** instead of **primer**, for the two
    /// stages this flow normally reaches only through the camera or Photos
    /// picker, which `xcrun simctl` cannot drive. At most one of the two debug
    /// images should be passed; passing neither behaves exactly like the plain
    /// initialiser above. `debugOpensCornerEditor` raises the corner editor over
    /// the review once auto-crop has answered.
    init(lesson: Lesson,
         fromSketchbook: Bool = false,
         debugReviewImage: UIImage?,
         debugSavedPage: SketchbookPage?,
         debugOpensCornerEditor: Bool = false) {
        self.lesson = lesson
        self.fromSketchbook = fromSketchbook
        if let debugReviewImage {
            _stage = State(initialValue: .review(ReviewPhoto(original: debugReviewImage)))
            _opensCornerEditorAfterAutoCrop = State(initialValue: debugOpensCornerEditor)
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
            case let .review(photo):
                review(photo)
            case let .saved(page):
                saved(page)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.page.ignoresSafeArea())
        .onAppear {
            if owner == nil { owner = app.activeStores }
        }
        // Vision's first request loads a model; paying for that now keeps the
        // learner's photo inside the 300 ms auto-crop budget.
        .task { PageCropper.prewarm() }
        .fullScreenCover(isPresented: $isShowingCamera) {
            CameraPicker { image in
                isShowingCamera = false
                if let image { stage = .review(ReviewPhoto(original: image)) }
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
                    stage = .review(ReviewPhoto(original: image))
                }
                photoItem = nil
            }
        }
    }

    // MARK: - primer

    /// Shown before the camera is ever asked for, so "Don't Allow" is an informed
    /// choice. "Choose from Photos" needs no permission at all. The drawing card
    /// names the page being photographed and offers the lesson again for a page
    /// left unfinished.
    private var primer: some View {
        VStack(spacing: 0) {
            navigationBar(title: nil, leading: fromSketchbook ? .close : .back) {
                // Back to the screen this flow was opened from, without recording
                // the lesson as finished a second time.
                if fromSketchbook {
                    app.dismissCover()
                } else {
                    app.cover = .completion(lessonId: lesson.id)
                }
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

                    drawingCard
                        .padding(.top, 8)

                    ListCard(isSoft: true) {
                        promise("Photos stay on this \(DeviceName.current), inside Paper Coach.")
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

                Button("Not now") { leave() }
                    .buttonStyle(.quiet)
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.vertical, Theme.stackSpacing)
        }
    }

    /// Which drawing this photo is for: the lesson's finished page, its path and
    /// its name, so the learner photographs the right sheet. Under it, a way back
    /// into the lesson for a page that was not finished on paper — continuing from
    /// the step the learner left off at when a later try stopped part-way.
    private var drawingCard: some View {
        let resumeStep = app.progress.resumeStep(for: lesson.id)
        return ListCard {
            HStack(spacing: 14) {
                PageThumb(tutorial: lesson.tutorial, cornerRadius: 12, showsFills: true)
                    .frame(width: 64)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 2) {
                    Text("This photo is for")
                        .textRole(.footnote)
                        .foregroundStyle(Theme.ink55)
                    Text(lesson.title)
                        .scaledFont(20, .heavy, relativeTo: .headline)
                        .tracking(-0.2)
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    if let place = lessonPlace {
                        Text(place)
                            .textRole(.subhead)
                            .foregroundStyle(Theme.ink55)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 18)
            .accessibilityElement(children: .combine)

            RowDivider()

            Button {
                if let resumeStep {
                    app.presentPlayer(lesson, resumeFrom: resumeStep)
                } else {
                    app.presentPlayer(lesson)
                }
            } label: {
                Label(resumeStep.map { "Not finished? Continue from step \($0 + 1)" }
                          ?? "Not finished? Draw it again",
                      systemImage: "arrow.counterclockwise")
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .buttonStyle(.quietLink)
            .padding(.horizontal, 18)
            .padding(.vertical, 4)
            .accessibilityHint("Opens the lesson, so you can finish the page before the photo")
        }
    }

    /// "Sky & Weather · Lesson 2", or nil for a lesson the catalog has no path for.
    private var lessonPlace: String? {
        guard let path = app.path(id: lesson.pathId) else { return nil }
        guard let position = path.position(of: lesson.id) else { return path.title }
        return "\(path.title) · Lesson \(position)"
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
    private func review(_ photo: ReviewPhoto) -> some View {
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
                            VStack(spacing: Theme.stackSpacing) { reviewPair(photo) }
                        } else {
                            HStack(alignment: .top, spacing: Theme.stackSpacing) { reviewPair(photo) }
                        }
                    }
                    .padding(.top, 4)

                    // The one edit: four corners, which crop and straighten together.
                    // "Fix corners" once there are corners to fix, found or placed;
                    // "Crop" while the page is still the photo as taken.
                    Button { isEditingCorners = true } label: {
                        Label(photo.corners == nil ? "Crop" : "Fix corners", systemImage: "crop")
                            .scaledFont(17, .heavy)
                    }
                    .buttonStyle(.soft)
                    .padding(.top, 8)
                    .accessibilityHint("Move the corners onto the edges of your paper")

                    // The mockup's footnote: straightening moves pixels, it never
                    // recolors them.
                    Text("No filters and no touch-ups.")
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

                // Whatever "Your page" shows right now: Keep never waits on
                // auto-crop.
                Button { keep(photo.displayed) } label: {
                    Label("Keep", systemImage: "checkmark")
                }
                .buttonStyle(.primary)
                .disabled(isSaving)
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.vertical, Theme.stackSpacing)
        }
        // Once per photo. The shot shows as taken until this answers, and stays
        // that way if it finds nothing.
        .task(id: photo.id) { await autoCrop(photo) }
        .fullScreenCover(isPresented: $isEditingCorners) {
            CornerEditor(image: photo.original,
                         corners: photo.corners,
                         detectedCorners: photo.detectedCorners,
                         onCancel: { isEditingCorners = false },
                         onDone: { corners, page in
                             applyCorners(corners, page: page, to: photo.id)
                             isEditingCorners = false
                         })
        }
    }

    @ViewBuilder
    private func reviewPair(_ photo: ReviewPhoto) -> some View {
        VStack(spacing: 8) {
            SketchbookShot(image: photo.displayed)
                .accessibilityElement()
                .accessibilityLabel(photo.corners == nil
                                    ? "The photo you just took"
                                    : "The photo you just took, cropped to your paper")
                .accessibilityAddTraits(.isImage)
            Text("Your page")
                .textRole(.footnote)
                .foregroundStyle(Theme.ink55)
        }

        VStack(spacing: 8) {
            // The finished lesson, colored, as the learner has just drawn it.
            PageThumb(tutorial: lesson.tutorial, showsFills: true)
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

                        Text("Kept on this \(DeviceName.current) only. Nothing is uploaded.")
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
                if isGuided {
                    // The first run's one way on: the sketchbook this page just
                    // went into, open on its path.
                    Button {
                        app.showFirstRunSketchbook()
                    } label: {
                        Label("Open your sketchbook", systemImage: "book")
                    }
                    .buttonStyle(.primary)
                } else {
                    if let premiumNext = app.premiumNextLesson(after: lesson) {
                        PremiumNextCard(lesson: premiumNext) {
                            _ = app.offerPremiumIfNeeded(for: premiumNext)
                        }
                        if let free = app.freeLessonSuggestion(besides: lesson) {
                            FreeLessonRow(lesson: free) {
                                app.dismissCover()
                                app.showPreview(of: free)
                            }
                        }
                    } else if let next = app.nextLesson(after: lesson) {
                        Button("Next lesson") {
                            // The drawer comes up over this cover rather than over
                            // tabs that are still behind it.
                            if app.offerPremiumIfNeeded(for: next) { return }
                            app.dismissCover()
                            app.showPreview(of: next)
                        }
                        .buttonStyle(.primary)
                    }

                    Button {
                        app.dismissCover()
                        app.selectedTab = .sketchbook
                    } label: {
                        Label(fromSketchbook ? "Back to your sketchbook" : "Open your sketchbook",
                              systemImage: "book")
                    }
                    .buttonStyle(app.nextLesson(after: lesson) == nil ? .primary : .secondary)

                    // From the Sketchbook, the button above already goes back there.
                    if !fromSketchbook {
                        Button("Done") { leave() }
                            .buttonStyle(.quiet)
                            .frame(maxWidth: .infinity)
                    }
                }
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

    /// Finds the paper and straightens it, if the photo is still on review and the
    /// learner has not set corners of their own in the meantime.
    private func autoCrop(_ photo: ReviewPhoto) async {
        defer {
            if opensCornerEditorAfterAutoCrop, !Task.isCancelled {
                opensCornerEditorAfterAutoCrop = false
                isEditingCorners = true
            }
        }
        guard photo.corners == nil,
              let result = await PageCropper.autoCrop(photo.original),
              !Task.isCancelled,
              case var .review(current) = stage,
              current.id == photo.id,
              current.corners == nil
        else { return }
        current.detectedCorners = result.corners
        current.corners = result.corners
        current.displayed = result.image
        stage = .review(current)
        // `sk-capture` accessibility notes: announce it when segmentation succeeds.
        AccessibilityNotification.Announcement("Page detected").post()
    }

    /// The corner editor's answer, for the photo it was opened on.
    private func applyCorners(_ corners: PageCorners, page: UIImage, to photoId: UUID) {
        guard case var .review(current) = stage, current.id == photoId else { return }
        current.corners = corners
        current.displayed = page
        stage = .review(current)
    }

    /// "Not now" and "Done": back to where the learner came from — the sketchbook,
    /// or the way out of `sk-complete` (`AppModel.leaveCompletion(for:)`), which for
    /// a new learner's first rest is All paths' welcome.
    private func leave() {
        if fromSketchbook {
            app.dismissCover()
        } else if isGuided {
            app.showFirstRunSketchbook()
        } else {
            app.leaveCompletion(for: lesson)
        }
    }

    /// The first lesson of the guided first run: the page leads to the sketchbook
    /// tour, with no "Next lesson" and no "Done".
    private var isGuided: Bool { !fromSketchbook && app.isGuidedFirstRun(lesson) }

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
