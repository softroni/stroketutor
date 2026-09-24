import SwiftUI

/// The chip of v3 (`.chip`): a capsule of one small fact — "6 drawings",
/// "Drawn 3 Sep", "About 4 min". 14/bold, 7 × 12 padding, one soft colour.
struct Chip: View {
    enum Style {
        case neutral, green, gold, clay, blue, ink, white

        var background: Color {
            switch self {
            case .neutral: return Theme.surface
            case .green: return Theme.greenSoft
            case .gold: return Theme.goldSoft
            case .clay: return Theme.claySoft
            case .blue: return Theme.blueSoft
            case .ink: return Theme.ink
            case .white: return Theme.card
            }
        }

        var foreground: Color {
            switch self {
            case .neutral: return Theme.ink70
            case .green: return Theme.green
            case .gold: return Theme.goldDeep
            case .clay: return Theme.clay
            case .blue: return Theme.blue
            case .ink: return .white
            case .white: return Theme.ink
            }
        }
    }

    let text: String
    var systemImage: String?
    var style: Style = .neutral

    var body: some View {
        HStack(spacing: 6) {
            if let systemImage {
                Image(systemName: systemImage)
                    .scaledFont(14, .bold, design: .default)
            }
            Text(text)
                .scaledFont(14, .bold)
        }
        .foregroundStyle(style.foreground)
        .padding(.vertical, 7)
        .padding(.horizontal, 12)
        .background(Capsule().fill(style.background))
        .modifier(ChipShadow(isFloating: style == .white))
    }
}

/// Only the white chip floats; every other chip sits flat on the page.
private struct ChipShadow: ViewModifier {
    let isFloating: Bool

    func body(content: Content) -> some View {
        if isFloating { content.chipShadow() } else { content }
    }
}
