import SwiftUI

/// A row of a grouped list (`.list-row`): a 40 pt tinted icon tile, a title with an
/// optional second line, an optional value on the right, and a chevron when the row
/// pushes. At least 60 pt tall, 18 pt side padding.
///
/// The tint is per section on `st-settings`: green for Lesson, clay for Lina, gold
/// for Sketchbook, blue for Accessibility, neutral for More.
struct SettingsRow: View {

    /// The soft colour of the leading tile.
    enum Tint {
        case neutral, green, clay, gold, blue

        var background: Color {
            switch self {
            case .neutral: return Theme.surface
            case .green: return Theme.greenSoft
            case .clay: return Theme.claySoft
            case .gold: return Theme.goldSoft
            case .blue: return Theme.blueSoft
            }
        }

        var foreground: Color {
            switch self {
            case .neutral: return Theme.ink
            case .green: return Theme.green
            case .clay: return Theme.clay
            case .gold: return Theme.goldDeep
            case .blue: return Theme.blue
            }
        }
    }

    let title: String
    var subtitle: String?
    var value: String?
    var systemImage: String?
    var tint: Tint = .neutral
    /// Nil makes a static row: no chevron, no tap.
    var action: (() -> Void)?

    var body: some View {
        if let action {
            Button(action: action) { rowContent(showsChevron: true) }
                .buttonStyle(.plain)
                .accessibilityAddTraits(.isButton)
        } else {
            rowContent(showsChevron: false)
        }
    }

    private func rowContent(showsChevron: Bool) -> some View {
        HStack(spacing: 14) {
            if let systemImage {
                Image(systemName: systemImage)
                    .scaledFont(19, .semibold, design: .default)
                    .foregroundStyle(tint.foreground)
                    .frame(width: 40, height: 40)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(tint.background))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .textRole(.headline)
                    .foregroundStyle(Theme.ink)
                if let subtitle {
                    Text(subtitle)
                        .textRole(.footnote)
                        .foregroundStyle(Theme.ink55)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if let value {
                Text(value)
                    .scaledFont(16, .semibold)
                    .foregroundStyle(Theme.ink55)
            }

            if showsChevron {
                Image(systemName: "chevron.right")
                    .scaledFont(14, .bold, design: .default)
                    .foregroundStyle(Theme.ink25)
            }
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 18)
        .frame(minHeight: Theme.minimumTapTarget)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}
