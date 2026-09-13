import SwiftUI

/// The tactile button of v3 (`.btn` and its modifiers in `design-system.css`): a
/// rounded rectangle with a second rectangle 4 pt lower in a darker "edge" colour.
/// Pressing moves the label down 4 pt and the edge disappears, so the control reads
/// as a physical key. The 4 pt is reserved in the layout, so nothing jumps.
///
/// One primary per screen. Variants map one to one onto the mockup's classes:
/// `.primary` = `.btn-primary`, `.secondary` = `.btn`, `.soft` = `.btn-soft`,
/// `.ink` = `.btn-primary--ink`, `.whiteOnGreen` = `.btn-primary--white` (the hero
/// banner's button), `.pending` = `.btn-primary--pending` (the player's "I drew it"
/// while the step is still drawing).
struct TactileButtonStyle: ButtonStyle {

    enum Variant {
        case primary, secondary, soft, ink, whiteOnGreen, pending
    }

    var variant: Variant = .primary

    func makeBody(configuration: Configuration) -> some View {
        let shape = RoundedRectangle(cornerRadius: Theme.controlCornerRadius, style: .continuous)
        return configuration.label
            .font(.system(size: fontSize, weight: .heavy, design: .rounded))
            .tracking(-0.2)
            .lineLimit(2)
            .minimumScaleFactor(0.7)
            .multilineTextAlignment(.center)
            .foregroundStyle(foreground)
            .frame(maxWidth: .infinity)
            .frame(minHeight: minHeight)
            .padding(.horizontal, 20)
            .background(shape.fill(fill))
            .overlay {
                if borderWidth > 0 {
                    shape.strokeBorder(border, lineWidth: borderWidth)
                }
            }
            .background(alignment: .bottom) {
                shape.fill(edge)
                    .offset(y: configuration.isPressed ? 0 : 4)
            }
            .offset(y: configuration.isPressed ? 4 : 0)
            .padding(.bottom, 4)
            .contentShape(shape)
            .animation(.easeOut(duration: 0.08), value: configuration.isPressed)
    }

    // MARK: - The variant's paint

    private var minHeight: CGFloat {
        switch variant {
        case .primary, .ink, .whiteOnGreen, .pending: return 64
        case .secondary, .soft: return 60
        }
    }

    private var fontSize: CGFloat {
        switch variant {
        case .primary, .ink, .whiteOnGreen, .pending: return 20
        case .secondary, .soft: return 18
        }
    }

    private var foreground: Color {
        switch variant {
        case .primary, .ink: return .white
        case .whiteOnGreen, .pending: return Theme.green
        case .secondary, .soft: return Theme.ink
        }
    }

    private var fill: Color {
        switch variant {
        case .primary: return Theme.green
        case .ink: return Theme.ink
        case .whiteOnGreen, .pending, .secondary: return Theme.card
        case .soft: return Theme.surface
        }
    }

    private var border: Color {
        switch variant {
        case .secondary: return Theme.lineStrong
        case .pending: return Theme.green
        default: return .clear
        }
    }

    private var borderWidth: CGFloat {
        switch variant {
        case .secondary: return 2
        case .pending: return 2.5
        default: return 0
        }
    }

    private var edge: Color {
        switch variant {
        case .primary: return Theme.greenDeep
        case .secondary: return Theme.lineStrong
        case .soft: return Theme.surface2
        case .ink: return .black
        case .whiteOnGreen: return .black.opacity(0.18)
        case .pending: return Theme.greenSoft
        }
    }
}

extension ButtonStyle where Self == TactileButtonStyle {
    /// Green fill, white 20/heavy label, 64 pt. The one loud button on a screen.
    static var primary: TactileButtonStyle { TactileButtonStyle(variant: .primary) }
    /// White fill with a 2 pt border, ink 18/heavy label, 60 pt.
    static var secondary: TactileButtonStyle { TactileButtonStyle(variant: .secondary) }
    /// Grey-warm fill, no border. For the quietest of the tappable rows.
    static var soft: TactileButtonStyle { TactileButtonStyle(variant: .soft) }
    /// Ink fill, white label. Used where green would claim the wrong thing.
    static var inkFilled: TactileButtonStyle { TactileButtonStyle(variant: .ink) }
    /// White on green: the hero banner's "Start drawing".
    static var whiteOnGreen: TactileButtonStyle { TactileButtonStyle(variant: .whiteOnGreen) }
    /// White with a 2.5 pt green ring: the player's primary while a step is drawing.
    /// Tappable, never disabled — a greyed green reads as broken.
    static var pending: TactileButtonStyle { TactileButtonStyle(variant: .pending) }
}

/// The quiet text button of v3 (`.btn-text`): 17/bold, 48 pt tall, no fill and no
/// edge. "Not now", "All paths", "Start over". Blue for links, danger for deletes.
struct QuietTextButtonStyle: ButtonStyle {
    var tint: Color = Theme.ink70

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 17, weight: .bold, design: .rounded))
            .foregroundStyle(tint)
            .frame(minHeight: 48)
            .padding(.horizontal, 4)
            .contentShape(Rectangle())
            .opacity(configuration.isPressed ? 0.55 : 1)
    }
}

extension ButtonStyle where Self == QuietTextButtonStyle {
    static var quiet: QuietTextButtonStyle { QuietTextButtonStyle() }
    static var quietLink: QuietTextButtonStyle { QuietTextButtonStyle(tint: Theme.blue) }
    static var quietDanger: QuietTextButtonStyle { QuietTextButtonStyle(tint: Theme.danger) }
}

/// The round icon button of v3 (`.btn-icon`): a 60 pt circle with the secondary
/// treatment — white, 2 pt border, 4 pt edge. `.small` is the 48 pt version.
struct RoundIconButtonStyle: ButtonStyle {
    enum Size { case regular, small }

    var size: Size = .regular
    var tint: Color = Theme.ink

    func makeBody(configuration: Configuration) -> some View {
        let side: CGFloat = size == .regular ? Theme.minimumTapTarget : 48
        return configuration.label
            .font(.system(size: size == .regular ? 26 : 22, weight: .bold))
            .foregroundStyle(tint)
            .frame(width: side, height: side)
            .background(Circle().fill(Theme.card))
            .overlay(Circle().strokeBorder(Theme.lineStrong, lineWidth: 2))
            .background(alignment: .bottom) {
                Circle()
                    .fill(Theme.lineStrong)
                    .frame(width: side, height: side)
                    .offset(y: configuration.isPressed ? 0 : 4)
            }
            .offset(y: configuration.isPressed ? 4 : 0)
            .padding(.bottom, 4)
            .contentShape(Circle())
            .animation(.easeOut(duration: 0.08), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == RoundIconButtonStyle {
    static var roundIcon: RoundIconButtonStyle { RoundIconButtonStyle() }
    static var roundIconSmall: RoundIconButtonStyle { RoundIconButtonStyle(size: .small) }
}
