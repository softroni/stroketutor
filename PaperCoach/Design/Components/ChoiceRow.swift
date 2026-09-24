import SwiftUI

/// A single-choice row (`.choice`): the shape onboarding's "how much have you drawn"
/// uses. White with a 2 pt border and a 3 pt edge; selected turns green-tint with a
/// 2.5 pt green border and a check.
///
/// The leading mark is either an SF Symbol in a soft square or any view the caller
/// hands in — `ob-level` puts a drawing on paper there. At the accessibility text
/// sizes a leading view wider than the symbol would squeeze the words into a narrow
/// column, so the row stacks it above them instead.
struct ChoiceRow<Leading: View>: View {
    let title: String
    var subtitle: String?
    let isSelected: Bool
    let action: () -> Void
    private let leading: Leading
    /// True for a caller's own view, which stacks at the accessibility sizes. The
    /// symbol is small enough to stay beside the words at every size.
    private let stacksLeading: Bool

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// A row led by the caller's own view, drawn as given.
    init(title: String,
         subtitle: String? = nil,
         isSelected: Bool,
         action: @escaping () -> Void,
         @ViewBuilder leading: () -> Leading) {
        self.title = title
        self.subtitle = subtitle
        self.isSelected = isSelected
        self.action = action
        self.leading = leading()
        self.stacksLeading = true
    }

    private init(title: String,
                 subtitle: String?,
                 isSelected: Bool,
                 action: @escaping () -> Void,
                 symbol: Leading) {
        self.title = title
        self.subtitle = subtitle
        self.isSelected = isSelected
        self.action = action
        self.leading = symbol
        self.stacksLeading = false
    }

    var body: some View {
        Button(action: action) {
            content
                .padding(.vertical, 12)
                .padding(.horizontal, 16)
                .frame(minHeight: 68)
                .choiceSurface(isSelected: isSelected, cornerRadius: 20)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    @ViewBuilder
    private var content: some View {
        if stacksLeading && dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top) {
                    leading
                    Spacer(minLength: 14)
                    check
                }
                words
            }
        } else {
            HStack(spacing: 14) {
                leading
                words
                check
            }
        }
    }

    private var words: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .textRole(.headline)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
            if let subtitle {
                Text(subtitle)
                    .textRole(.footnote)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .multilineTextAlignment(.leading)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var check: some View {
        if isSelected {
            ChoiceCheck()
        }
    }
}

extension ChoiceRow where Leading == ChoiceSymbol? {
    /// A row led by an SF Symbol, or by nothing when `systemImage` is nil.
    init(title: String,
         subtitle: String? = nil,
         systemImage: String? = nil,
         isSelected: Bool,
         action: @escaping () -> Void) {
        self.init(title: title,
                  subtitle: subtitle,
                  isSelected: isSelected,
                  action: action,
                  symbol: systemImage.map { ChoiceSymbol(systemImage: $0, isSelected: isSelected) })
    }
}

/// A choice row's SF Symbol: 22 pt in a 44 pt soft square, green once chosen.
struct ChoiceSymbol: View {
    let systemImage: String
    let isSelected: Bool

    var body: some View {
        Image(systemName: systemImage)
            .scaledFont(22, .semibold, design: .default)
            .foregroundStyle(isSelected ? Theme.green : Theme.ink)
            .frame(width: 44, height: 44)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(isSelected ? Theme.greenSoft : Theme.surface)
            )
    }
}

/// The white check on a green disc that marks the chosen option.
struct ChoiceCheck: View {
    var body: some View {
        Image(systemName: "checkmark")
            .scaledFont(13, .heavy, design: .default)
            .foregroundStyle(.white)
            .frame(width: 26, height: 26)
            .background(Circle().fill(Theme.green))
    }
}

extension View {
    /// The card a single choice sits on (`.choice`): white with a 2 pt border and a
    /// 3 pt edge underneath, or green-tint with a 2.5 pt green border once chosen.
    /// The edge hangs below the card, so this pads the bottom by as much.
    func choiceSurface(isSelected: Bool, cornerRadius: CGFloat) -> some View {
        self
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(isSelected ? Theme.greenTint : Theme.card)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(isSelected ? Theme.green : Theme.line,
                                  lineWidth: isSelected ? 2.5 : 2)
            )
            .background(alignment: .bottom) {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(isSelected ? Theme.greenSoft : Theme.line)
                    .offset(y: 3)
            }
            .padding(.bottom, 3)
    }
}
