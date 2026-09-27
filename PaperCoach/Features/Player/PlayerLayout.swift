import CoreGraphics

/// Which anatomy the player takes, from the size of the window it is in.
///
/// The phone's two layouts were chosen by `verticalSizeClass`, which is compact only
/// on a phone on its side. An iPad reports regular both ways, so turned sideways it
/// kept the upright layout stretched across the width, and its big screen was never
/// asked what it is for: standing beside the paper, far enough away that the words
/// have to be large and the real thing can stay on screen whole. The window's own
/// size decides instead, which also covers an iPad window of any shape
/// (`UIRequiresFullScreen` is gone, see `Info.plist`).
enum PlayerLayout: Equatable {
    /// `pl-player`: the paper over the sheet. A phone held upright, a narrow window,
    /// and every screen at the accessibility type sizes.
    case portrait
    /// `pl-landscape`: the paper beside the 312 pt panel, or the wide page. A phone
    /// on its side, and a window too short for the big-screen layouts.
    case landscape
    /// A big screen held upright (an iPad in portrait): the paper shown as a sheet
    /// of paper, a large reference picture on it, and the words in a large type.
    case roomyPortrait
    /// A big screen on its side (an iPad in landscape): the paper as a sheet beside
    /// a 380 pt panel with the reference whole, the words large, every step listed
    /// and the buttons at the bottom of the side the learner chose.
    case studio

    /// Wide and tall enough for the studio: a 380 pt panel beside a page that still
    /// holds a drawing larger than a phone's whole screen.
    static let studioMinimum = CGSize(width: 900, height: 600)
    /// Both sides at least this long make an upright window roomy.
    static let roomyMinimum: CGFloat = 700
    /// Below this height a window on its side is laid out like a phone on its side.
    static let landscapeMaximumHeight: CGFloat = 600

    static func choose(for size: CGSize, isAccessibilitySize: Bool) -> PlayerLayout {
        let isSideways = size.width > size.height
        if isSideways, !isAccessibilitySize,
           size.width >= studioMinimum.width, size.height >= studioMinimum.height {
            return .studio
        }
        if isSideways, !isAccessibilitySize, size.height < landscapeMaximumHeight {
            return .landscape
        }
        if size.width >= roomyMinimum, size.height >= roomyMinimum {
            return .roomyPortrait
        }
        return .portrait
    }

    /// The two big-screen layouts, which show the drawing on a sheet of paper
    /// (`PageSheet`) and size their words for reading from a metre away.
    var isRoomy: Bool {
        self == .roomyPortrait || self == .studio
    }
}
