import SwiftUI
import UIKit

/// A drawing sent out of the app, from a kept page (`sk-entry`) or the moment it was
/// kept (`sk-capture` saved): a card made on the device, the words that go with it,
/// and the App Store link. Nothing is uploaded; the card goes only where the
/// learner sends it, through the system share sheet (`ShareSheet`).
///
/// The card carries the app's name in the picture itself, because Instagram,
/// Snapchat, Facebook and "Save Image" keep only the picture; Messages, Mail and
/// WhatsApp take the words and the link as well. On a child's profile the share
/// waits for the grown-ups' check (`AppModel.grownUpCheckBeforeSharing`), and the
/// words are the grown-up's.
@MainActor
enum DrawingShare {

    /// Where the share sheet was opened, sent as `entry` with both share events.
    enum Entry: String {
        /// A sketchbook page's green button.
        case sketchbook
        /// The share button in a sketchbook page's top bar.
        case sketchbookBar = "sketchbook_bar"
        /// The page just kept, on the capture flow's last screen.
        case saved

        /// The link's campaign, one per place, so App Store Connect says which one
        /// brought a download (`AppStoreListing.Campaign`).
        var campaign: AppStoreListing.Campaign {
            switch self {
            case .sketchbook: return .shareSketchbook
            case .sketchbookBar: return .shareSketchbookBar
            case .saved: return .shareSaved
            }
        }
    }

    /// The words with the card. Someone 13 or over invites the friend to draw it
    /// too. A child's drawing is sent by the grown-up who passed the check, so the
    /// words are theirs and say nothing about who drew it. Neither names the lesson
    /// (the card does), so no title has to fit the sentence: "Cherries", "UFO".
    static func message(forChild: Bool, link: URL?) -> String {
        let words = forChild
            ? "Look at this drawing, made with Paper Coach!"
            : "I drew this with Paper Coach. Can you draw it too?"
        guard let link else { return words }
        return "\(words) \(link.absoluteString)"
    }

    /// A tap on Share, as the request a view hands to `.grownUpCheck(_:)`: a child's
    /// grown-up answers first; for anyone 13 or over the sheet opens straight away.
    static func request(sharing page: SketchbookPage,
                        photo: UIImage?,
                        app: AppModel,
                        entry: Entry,
                        from anchor: ShareAnchor) -> GrownUpCheckRequest {
        GrownUpCheckRequest(check: app.grownUpCheckBeforeSharing, reason: "Needed to share a drawing.") {
            _ = share(page, photo: photo, app: app, entry: entry, from: anchor)
        }
    }

    /// Opens the share sheet on `page`'s card. False when there is nothing to share:
    /// no photo on the device, or a card that could not be made or written.
    static func share(_ page: SketchbookPage,
                      photo: UIImage?,
                      app: AppModel,
                      entry: Entry,
                      from anchor: ShareAnchor) -> Bool {
        guard let photo else { return false }
        let lesson = app.lesson(id: page.lessonId)
        let tint = (app.path(forLesson: page.lessonId) ?? app.path(id: page.pathId)).map { app.tint(for: $0) }
        let title = lesson?.title ?? "Drawing"
        guard let card = card(photo: photo, tutorial: lesson?.tutorial, title: lesson?.title, tint: tint),
              let file = write(card, named: title) else { return false }

        let text = message(forChild: app.learnerIsChild, link: AppStoreListing.campaignURL(entry.campaign))
        let analytics = app.analytics
        let lessonId = page.lessonId
        let pathId = page.pathId
        analytics.track(.drawingShareOpened(lessonId: lessonId, pathId: pathId, entry: entry.rawValue))
        ShareSheet.present([SharedImageItem(fileURL: file, title: title, preview: card),
                            SharedTextItem(text: text, subject: "Paper Coach")],
                           from: anchor) { activity in
            guard let activity else { return }
            analytics.track(.drawingShared(lessonId: lessonId, pathId: pathId,
                                           entry: entry.rawValue, activity: activity.rawValue))
        }
        return true
    }

    // MARK: - The card

    /// The card's size in points. Drawn at `cardScale` it is 1080 × 1350 pixels,
    /// the 4 : 5 that Instagram's feed shows uncropped and every other app takes.
    static let cardSize = CGSize(width: 540, height: 675)
    static let cardScale: CGFloat = 2

    /// The card for `photo`, or nil if it could not be drawn.
    static func card(photo: UIImage, tutorial: PreparedTutorial?, title: String?, tint: PathTint?) -> UIImage? {
        let renderer = ImageRenderer(content: DrawingShareCard(photo: photo, tutorial: tutorial, title: title, tint: tint))
        renderer.scale = cardScale
        renderer.isOpaque = true
        return renderer.uiImage
    }

    /// The card as a JPEG in the temporary directory, named after the lesson, which
    /// AirDrop and Files show.
    private static func write(_ card: UIImage, named title: String) -> URL? {
        guard let data = SketchbookStore.jpegData(from: card) else { return nil }
        let name = title.replacingOccurrences(of: "/", with: "-")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(name).jpg")
        do {
            try data.write(to: url, options: .atomic)
            return url
        } catch {
            return nil
        }
    }
}

/// The picture that goes out: the photograph on its path's color with the lesson
/// in its corner, as the sketchbook shows the page (`sk-entry`), and under it the
/// app's icon, the lesson's name and "Drawn with Paper Coach". Fixed sizes, never
/// Dynamic Type: it is a picture, the same for everyone.
struct DrawingShareCard: View {
    let photo: UIImage
    let tutorial: PreparedTutorial?
    let title: String?
    let tint: PathTint?

    /// The band's width: the photograph is as wide as on a 430 pt iPhone's page.
    private static let bandWidth: CGFloat = 393

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Theme.canvasCornerRadius, style: .continuous)
        VStack(alignment: .leading, spacing: 20) {
            SketchbookShot(image: photo, tutorial: tutorial)
                .lessonBadge(tutorial)
                .padding(12)
                .background(shape.fill(tint?.soft ?? Theme.surface))
                .background(alignment: .bottom) {
                    shape.fill(tint?.edge ?? Theme.line).offset(y: 5)
                }
                .padding(.bottom, 5)

            HStack(spacing: 15) {
                icon
                VStack(alignment: .leading, spacing: 2) {
                    if let title {
                        Text(title)
                            .font(.system(size: 25, weight: .heavy, design: .rounded))
                            .tracking(-0.4)
                            .foregroundStyle(Theme.ink)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                    }
                    Text("Drawn with Paper Coach")
                        .font(.system(size: title == nil ? 22 : 18, weight: .bold, design: .rounded))
                        .foregroundStyle(title == nil ? Theme.ink : Theme.ink55)
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 4)
        }
        .frame(width: Self.bandWidth)
        .frame(width: DrawingShare.cardSize.width, height: DrawingShare.cardSize.height)
        .background(Theme.page)
        .environment(\.colorScheme, .light)
    }

    /// The App Store icon, rounded as the Home Screen rounds it.
    private var icon: some View {
        let shape = RoundedRectangle(cornerRadius: 13, style: .continuous)
        return Image("ShareCardIcon")
            .resizable()
            .interpolation(.high)
            .frame(width: 59, height: 59)
            .clipShape(shape)
            .overlay(shape.strokeBorder(Theme.line, lineWidth: 1))
    }
}
