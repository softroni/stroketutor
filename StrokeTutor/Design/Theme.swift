import SwiftUI

/// Every design token of the v3 design (`docs/ios-design/v3.html`, "Studio white"),
/// transcribed from `docs/ios-design/src/v3/design-system.css`. One CSS pixel there is
/// one point here, so a value in this file can be compared with the mockup by name:
/// `Theme.green` is `--green`, `Theme.cardCornerRadius` is `--r-card`, and so on. The
/// same colours exist in `Assets.xcassets` under the same names (light only) so a dark
/// appearance can be added later without touching call sites; the literals below stay
/// the source of truth until that day.
enum Theme {

    // MARK: - Surfaces

    /// `--paper`: the drawing canvas. White, like the paper the learner draws on.
    static let paper = hex("#FFFFFF")
    /// `--page`: the app background.
    static let page = hex("#FFFFFF")
    /// `--surface`: soft tiles, list rows, locked nodes.
    static let surface = hex("#F5F5F3")
    /// `--surface-2`: the pressed edge under a soft tile.
    static let surface2 = hex("#ECECE9")
    /// `--card`: card fill. White, kept separate from `page` for readability at call sites.
    static let card = hex("#FFFFFF")

    // MARK: - Ink

    /// `--ink`: text and pen strokes.
    static let ink = hex("#141414")
    static let ink70 = ink.opacity(0.70)
    static let ink55 = ink.opacity(0.55)
    static let ink40 = ink.opacity(0.40)
    static let ink25 = ink.opacity(0.25)
    static let ink12 = ink.opacity(0.12)
    static let ink06 = ink.opacity(0.06)

    /// `--line`: the 2 pt border that gives a card its edge.
    static let line = hex("#E7E6E2")
    /// `--line-strong`: the border and pressed edge of a secondary button.
    static let lineStrong = hex("#D5D3CD")

    // MARK: - Colour

    /// `--green`: the way forward — primary button, current node, active tab, progress.
    static let green = hex("#1FA463")
    static let greenDeep = hex("#15804B")
    static let greenSoft = hex("#E5F5EC")
    static let greenTint = hex("#F2FAF5")
    /// The two ends of the hero banner's gradient (`.card--hero`, 160°).
    static let greenLight = hex("#24B36E")
    static let greenDark = hex("#178F55")
    /// The hero banner's fill: the gradient of `.card--hero`, corner to corner.
    static let heroGradient = LinearGradient(colors: [greenLight, green, greenDark],
                                             startPoint: .topLeading,
                                             endPoint: .bottomTrailing)

    /// `--clay`: the tutor — Lina, speech, narration.
    static let clay = hex("#E4643B")
    static let clayDeep = hex("#BF4E2A")
    static let claySoft = hex("#FDECE4")
    /// `--gold`: finished drawings.
    static let gold = hex("#E0A32E")
    static let goldDeep = hex("#B9821F")
    static let goldSoft = hex("#FBF1DA")
    /// `--blue`: links only.
    static let blue = hex("#2F6BE8")
    static let blueSoft = hex("#E8EFFD")
    static let danger = hex("#D9382D")
    static let dangerSoft = hex("#FCE8E6")

    // MARK: - Radii

    /// `--r-canvas` 28.
    static let canvasCornerRadius: CGFloat = 28
    /// `--r-card` 24.
    static let cardCornerRadius: CGFloat = 24
    /// `--r-control` 20.
    static let controlCornerRadius: CGFloat = 20
    /// `--r-thumb` 18.
    static let thumbCornerRadius: CGFloat = 18

    // MARK: - Spacing

    /// `--gutter` 20: the side margin of every screen.
    static let gutter: CGFloat = 20
    /// The gap between blocks in a stack.
    static let stackSpacing: CGFloat = 12
    /// The gap between sections.
    static let sectionSpacing: CGFloat = 20
    /// The inside padding of a card.
    static let cardPadding: CGFloat = 20

    // MARK: - Tap targets

    /// `--tap` 60: the minimum tap target for every control in the app.
    static let minimumTapTarget: CGFloat = 60
    /// Nav-bar glyphs are allowed to be 44, the platform minimum.
    static let navTapTarget: CGFloat = 44
    /// A lesson node is 84 pt across.
    static let nodeSize: CGFloat = 84

    // MARK: - Shadows

    /// `--shadow-float`: sheets, the reference thumbnail, toasts. Nothing else floats.
    static let shadowFloatColor = Color.black.opacity(0.14)
    static let shadowFloatRadius: CGFloat = 15
    static let shadowFloatY: CGFloat = 10
    /// `--shadow-chip`: the narration chip and white chips.
    static let shadowChipColor = Color.black.opacity(0.12)
    static let shadowChipRadius: CGFloat = 7
    static let shadowChipY: CGFloat = 4

    // MARK: - Type

    /// The named text roles of the v3 type scale. SF Pro Rounded throughout
    /// (`ui-rounded` in the mockup), sizes and weights exactly as the CSS.
    enum TextRole {
        case largeTitle, title1, title2, title3
        case headline, body, bodyRegular, instruction
        case subhead, footnote, eyebrow
    }

    /// The font for a role: `.system(size:weight:design: .rounded)`.
    static func font(_ role: TextRole) -> Font {
        let (size, weight) = metrics(role)
        return .system(size: size, weight: weight, design: .rounded)
    }

    /// The letter spacing for a role, in points. Titles are tracked in, the eyebrow out.
    static func tracking(_ role: TextRole) -> CGFloat {
        switch role {
        case .largeTitle: return -0.8
        case .title1: return -0.6
        case .title2, .instruction: return -0.4
        case .title3: return -0.2
        case .headline: return -0.2
        case .eyebrow: return 1
        case .body, .bodyRegular, .subhead, .footnote: return 0
        }
    }

    /// The line height the mockup gives a role, used where a slot must not resize
    /// between states (the player's two-line instruction, for one).
    static func lineHeight(_ role: TextRole) -> CGFloat {
        switch role {
        case .largeTitle: return 40
        case .title1: return 35
        case .title2, .instruction: return 30
        case .title3: return 25
        case .headline: return 22
        case .body, .bodyRegular: return 24
        case .subhead: return 20
        case .footnote: return 18
        case .eyebrow: return 16
        }
    }

    private static func metrics(_ role: TextRole) -> (CGFloat, Font.Weight) {
        switch role {
        case .largeTitle: return (36, .heavy)
        case .title1: return (30, .heavy)
        case .title2: return (24, .heavy)
        case .title3: return (20, .heavy)
        case .headline: return (17, .bold)
        case .body: return (17, .medium)
        case .bodyRegular: return (17, .regular)
        case .instruction: return (24, .heavy)
        case .subhead: return (15, .semibold)
        case .footnote: return (13, .semibold)
        case .eyebrow: return (12, .heavy)
        }
    }

    /// A rounded system font at an explicit size. Kept from the first player so the
    /// views written before v3 still compile; new code should use `font(_:)`.
    static func rounded(_ size: CGFloat, _ weight: Font.Weight = .bold) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }

    /// Parses a token's hex string. The tokens are literals in this file and are all
    /// valid, so a failure can only be a typo introduced here; black makes it loud.
    private static func hex(_ value: String) -> Color {
        Color(hex: value) ?? .black
    }
}

extension View {
    /// Applies a v3 text role: font, tracking, and the role's colour when it has one.
    /// `Text("Learn").textRole(.largeTitle)` is the whole idiom.
    func textRole(_ role: Theme.TextRole) -> some View {
        font(Theme.font(role)).tracking(Theme.tracking(role))
    }

    /// The float shadow (`--shadow-float`), for the few things that sit above the paper.
    func floatShadow() -> some View {
        shadow(color: Theme.shadowFloatColor,
               radius: Theme.shadowFloatRadius,
               y: Theme.shadowFloatY)
    }

    /// The chip shadow (`--shadow-chip`).
    func chipShadow() -> some View {
        shadow(color: Theme.shadowChipColor,
               radius: Theme.shadowChipRadius,
               y: Theme.shadowChipY)
    }

    /// A flat v3 card: white, radius 24, a 2 pt `--line` border, 20 pt of padding.
    func cardBackground(fill: Color = Theme.card,
                        border: Color? = Theme.line,
                        cornerRadius: CGFloat = Theme.cardCornerRadius) -> some View {
        background(
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .fill(fill)
        )
        .overlay {
            if let border {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(border, lineWidth: 2)
            }
        }
    }
}
