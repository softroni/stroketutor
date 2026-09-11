import SwiftUI

/// Shared sizing and type. Tuned for a 7-year-old holding an iPad: large
/// rounded type, generous radii, and tap targets no smaller than 60pt.
enum Theme {
    /// Minimum tap target for every control in the app.
    static let minimumTapTarget: CGFloat = 60
    static let canvasCornerRadius: CGFloat = 32
    static let cardCornerRadius: CGFloat = 28
    static let controlCornerRadius: CGFloat = 22

    static let pageBackground = Color(red: 0.93, green: 0.92, blue: 0.90)
    static let ink = Color(red: 0.17, green: 0.17, blue: 0.17)
    static let accent = Color(red: 0.13, green: 0.47, blue: 0.85)
    static let success = Color(red: 0.11, green: 0.56, blue: 0.36)
    static let warning = Color(red: 0.72, green: 0.36, blue: 0.05)

    static func rounded(_ size: CGFloat, _ weight: Font.Weight = .bold) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }
}

/// A large, high-contrast button for the primary action ("I drew it!").
struct BigPrimaryButtonStyle: ButtonStyle {
    var tint: Color = Theme.success

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.rounded(26, .heavy))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(minHeight: Theme.minimumTapTarget + 8)
            .padding(.horizontal, 24)
            .background(
                RoundedRectangle(cornerRadius: Theme.cardCornerRadius, style: .continuous)
                    .fill(tint)
            )
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// The quieter counterpart, used for "Watch again" and the bottom controls.
struct BigSecondaryButtonStyle: ButtonStyle {
    var tint: Color = Theme.ink

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.rounded(19, .bold))
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .foregroundStyle(tint)
            .frame(maxWidth: .infinity)
            .frame(minHeight: Theme.minimumTapTarget)
            .padding(.horizontal, 12)
            .background(
                RoundedRectangle(cornerRadius: Theme.controlCornerRadius, style: .continuous)
                    .fill(Color.white.opacity(0.9))
            )
            .overlay(
                RoundedRectangle(cornerRadius: Theme.controlCornerRadius, style: .continuous)
                    .strokeBorder(tint.opacity(0.18), lineWidth: 2)
            )
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}
