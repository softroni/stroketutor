import SwiftUI

/// The player's bottom sheet (`pl-player` `.pl-sheet`): the instruction 24/heavy in a
/// two-line slot, one muted hint line, then the action row — back a step, watch
/// again, and the wide primary. White, radius 28 on top, a 2 pt line and a soft
/// upward shadow, so it reads as the same paper lifting off the page.
///
/// Nothing in it moves between states. Only the words and the primary's fill change.
struct PlayerSheet: View {
    let instruction: String
    let hint: String
    let actions: PlayerActionRow
    /// How tall the words may grow before they scroll instead of pushing the paper
    /// off the screen. The mockup's sentences are two lines; a real lesson's can be
    /// eight, and at accessibility type sizes more again.
    var textMaxHeight: CGFloat = 300

    /// The height the sentence and hint actually want, measured as laid out.
    @State private var naturalTextHeight: CGFloat = 60

    /// How tall the slot actually is: the words' own height, floored at two lines and
    /// capped so the paper above is never pushed off the screen.
    private var slotHeight: CGFloat {
        min(max(naturalTextHeight, 84), max(84, textMaxHeight))
    }

    /// True when the sentence is taller than its slot, so what is on screen is only
    /// part of it. Everything that says "there is more" is switched on by this.
    private var isScrollable: Bool {
        naturalTextHeight > slotHeight + 1
    }

    var body: some View {
        VStack(spacing: 8) {
            ScrollView {
                VStack(spacing: 8) {
                    PlayerInstructionText(instruction, alignment: .center)

                    Text(hint)
                        .textRole(.subhead)
                        .foregroundStyle(Theme.ink55)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityLabel(hint)
                }
                .frame(maxWidth: .infinity)
                .measuredHeight { naturalTextHeight = $0 }
            }
            .scrollBounceBehavior(.basedOnSize)
            // The slot is the words' own height — a two-line minimum, as the mockup
            // reserves — until they would push the paper below its floor; then it
            // stops growing and the block scrolls instead.
            .frame(height: slotHeight)
            // A long instruction stops at a hard edge, which reads as the end of the
            // sentence rather than the end of the slot. Fading the last 28 pt — and
            // flashing the indicator as the step appears — says the words continue.
            .mask(alignment: .top) { slotMask }
            .scrollIndicators(isScrollable ? .visible : .automatic)
            // The sentence's height is only known after the first layout pass, so
            // the flash is triggered when the slot *becomes* scrollable as well as
            // on appear — and again on every step whose words overflow.
            .scrollIndicatorsFlash(onAppear: true)
            .scrollIndicatorsFlash(trigger: instruction + (isScrollable ? "\u{2022}" : ""))

            actions
                .padding(.top, 10)
        }
        .padding(.top, 22)
        .padding(.horizontal, Theme.gutter)
        .padding(.bottom, 12)
        .frame(maxWidth: .infinity)
        .background(alignment: .top) {
            UnevenRoundedRectangle(topLeadingRadius: 28, topTrailingRadius: 28, style: .continuous)
                .fill(Theme.card)
                .shadow(color: .black.opacity(0.10), radius: 15, y: -10)
                .overlay(alignment: .top) {
                    UnevenRoundedRectangle(topLeadingRadius: 28, topTrailingRadius: 28, style: .continuous)
                        .strokeBorder(Theme.line, lineWidth: 2)
                }
                // The white runs under the home indicator; the mockup's
                // `padding-bottom: safe-bottom + 12` is the same thing.
                .ignoresSafeArea(edges: .bottom)
        }
    }

    /// Opaque over the slot, transparent over its last 28 pt — and plain opaque when
    /// the words fit, so a short instruction is never dimmed for no reason.
    @ViewBuilder
    private var slotMask: some View {
        if isScrollable {
            VStack(spacing: 0) {
                Rectangle().fill(.black)
                LinearGradient(colors: [.black, .black.opacity(0)],
                               startPoint: .top,
                               endPoint: .bottom)
                    .frame(height: 28)
            }
        } else {
            Rectangle().fill(.black)
        }
    }
}

/// The instruction, 24/heavy, balanced over at most two lines. It scales with
/// Dynamic Type — it is the one sentence the lesson is made of.
struct PlayerInstructionText: View {
    let text: String
    let alignment: TextAlignment
    var size: CGFloat = 24

    init(_ text: String, alignment: TextAlignment = .center, size: CGFloat = 24) {
        self.text = text
        self.alignment = alignment
        self.size = size
    }

    /// The mockup's 24/heavy assumes a sentence of a line or two. Studio-written
    /// lessons can run to a paragraph; at 24/heavy that swallows the paper. So the
    /// size follows the length: the designed size for a short sentence, a bolder
    /// headline for a medium one, and readable left-aligned body text for a paragraph.
    private var fitted: (size: CGFloat, weight: Font.Weight, tracking: CGFloat, spacing: CGFloat, alignment: TextAlignment) {
        let count = text.count
        if count <= 80 { return (size, .heavy, size >= 24 ? -0.4 : -0.3, size >= 24 ? 4 : 3, alignment) }
        if count <= 160 { return (min(size, 20), .bold, -0.2, 3, alignment) }
        return (min(size, 17), .semibold, 0, 3, .leading)
    }

    var body: some View {
        let style = fitted
        Text(text)
            .scaledFont(style.size, style.weight, relativeTo: .title2)
            .tracking(style.tracking)
            .foregroundStyle(Theme.ink)
            .multilineTextAlignment(style.alignment)
            .lineSpacing(style.spacing)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: style.alignment == .center ? .center : .leading)
    }
}

/// One row for every state: `◀` and `↻` as round quiet buttons, then the wide
/// primary.
struct PlayerActionRow: View {
    let primaryTitle: String
    /// True while the step is still drawing: the primary is outlined rather than
    /// filled. It still does what its label says — tapping it hurries the ink to
    /// the end of the step and goes on — it is only quieter until Lina stops.
    var isPending: Bool = false
    var canGoBack: Bool = true
    var showsQuietControls: Bool = true
    /// The intro before step one has nothing to go back to: only "watch again".
    var showsBack: Bool = true
    var replayLabel: String = "Watch this step again"
    var primaryFontSize: CGFloat?
    /// The 48 pt version for the wide page's bar (`PlayerWideBar`): small round
    /// buttons and a primary that takes its label's width rather than the row's.
    var isCompact: Bool = false
    var onBack: () -> Void = {}
    var onReplay: () -> Void = {}
    let onPrimary: () -> Void

    var body: some View {
        HStack(alignment: .bottom, spacing: Theme.stackSpacing) {
            if showsQuietControls {
                if showsBack { backButton }
                replayButton
            }
            primary
        }
    }

    @ViewBuilder
    private var primary: some View {
        if isCompact {
            Button(action: onPrimary) {
                Text(primaryTitle)
                    // Wide enough that "Finish" is as easy to hit as "I drew it".
                    .frame(minWidth: 96)
            }
            .buttonStyle(isPending ? .pendingCompact : .primaryCompact)
            .fixedSize(horizontal: true, vertical: false)
            .accessibilityLabel(primaryTitle)
            .accessibilityValue(isPending ? "Lina is still drawing" : "")
            .accessibilitySortPriority(70)
        } else {
            Button(action: onPrimary) {
                Text(primaryTitle)
                    .modifier(PrimaryLabelSize(size: primaryFontSize))
            }
            .buttonStyle(isPending ? .pending : .primary)
            .accessibilityLabel(primaryTitle)
            .accessibilityValue(isPending ? "Lina is still drawing" : "")
            .accessibilitySortPriority(70)
        }
    }

    private var backButton: some View {
        Button(action: onBack) {
            Image(systemName: "backward.end.fill")
        }
        .buttonStyle(isCompact ? .roundIconSmall : .roundIcon)
        .opacity(canGoBack ? 1 : 0.4)
        .disabled(!canGoBack)
        .accessibilityLabel("Previous step")
        .accessibilitySortPriority(60)
    }

    private var replayButton: some View {
        Button(action: onReplay) {
            Image(systemName: "arrow.counterclockwise")
        }
        .buttonStyle(isCompact ? .roundIconSmall : .roundIcon)
        .accessibilityLabel(replayLabel)
        .accessibilitySortPriority(55)
    }
}

/// Reports a view's laid-out height, so a slot can be as tall as its words and no
/// taller. Used by the player's sentence, which is two lines in the design and can
/// be eight in a real lesson.
private struct HeightPreferenceKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

extension View {
    func measuredHeight(_ report: @escaping (CGFloat) -> Void) -> some View {
        background {
            GeometryReader { proxy in
                Color.clear.preference(key: HeightPreferenceKey.self, value: proxy.size.height)
            }
        }
        .onPreferenceChange(HeightPreferenceKey.self) { report($0) }
    }
}

/// The landscape panel drops the primary's label to 19 pt so "I drew it" fits
/// beside two round buttons in a 276 pt column.
private struct PrimaryLabelSize: ViewModifier {
    let size: CGFloat?

    func body(content: Content) -> some View {
        if let size {
            content.scaledFont(size, .heavy)
        } else {
            content
        }
    }
}
