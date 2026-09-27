import SwiftUI

/// The player's panel on a big screen on its side (`PlayerLayout.studio`): an iPad
/// standing beside the paper, a metre from the learner's eyes.
///
/// Top to bottom, the plan's order of priority (§31) in one column: the header, the
/// reference picture whole rather than as a thumbnail ("side-by-side where
/// practical" — here it is), the sentence in a large type, every step of the
/// lesson with the one in play marked, and the action row at the bottom, where a
/// hand reaches without tipping the iPad over. 380 pt wide, on whichever side the
/// learner chose in Settings (`ProfilePreferences.lessonButtonsOnLeft`).
///
/// Same parts as the phone's sheet and panel, only more of each shown at once;
/// nothing here does anything they do not.
struct PlayerStudioPanel<Header: View, Reference: View>: View {
    let instruction: String
    let hint: String
    /// Every step's title, in order.
    let stepTitles: [String]
    /// The step in play, zero-based. Nil before the lesson starts.
    let currentStepIndex: Int?
    let actions: PlayerActionRow
    /// The screen edge the panel stands against, which decides its rounded corners
    /// and the side its shadow falls on.
    let edge: HorizontalEdge
    /// How tall the words may grow before they scroll.
    var textMaxHeight: CGFloat = 320
    @ViewBuilder let header: () -> Header
    @ViewBuilder let reference: () -> Reference

    static var width: CGFloat { 380 }

    @State private var naturalTextHeight: CGFloat = 80

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header()

            reference()

            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    PlayerInstructionText(instruction, alignment: .leading, size: 30)

                    Text(hint)
                        .scaledFont(18, .semibold)
                        .foregroundStyle(Theme.ink55)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .measuredHeight { naturalTextHeight = $0 }
            }
            .scrollBounceBehavior(.basedOnSize)
            .frame(height: min(max(naturalTextHeight, 80), max(80, textMaxHeight)))

            PlayerStepList(titles: stepTitles, currentIndex: currentStepIndex)
                .frame(maxHeight: .infinity, alignment: .top)

            actions
        }
        .padding(.top, 8)
        .padding(.horizontal, Theme.gutter)
        .padding(.bottom, 20)
        .frame(width: Self.width)
        .frame(maxHeight: .infinity)
        .background {
            let shape = edge == .trailing
                ? UnevenRoundedRectangle(topLeadingRadius: 28, bottomLeadingRadius: 28, style: .continuous)
                : UnevenRoundedRectangle(bottomTrailingRadius: 28, topTrailingRadius: 28, style: .continuous)
            shape
                .fill(Theme.card)
                .shadow(color: .black.opacity(0.08), radius: 15, x: edge == .trailing ? -8 : 8)
                .overlay { shape.strokeBorder(Theme.line, lineWidth: 2) }
                .ignoresSafeArea()
        }
    }
}

/// Every step of the lesson, one line each: drawn ones ticked, the one in play
/// green and bold, the rest waiting in grey. Looked at, not tapped — the action
/// row is the only way through a lesson, as on the phone. Scrolls to keep the step
/// in play in view.
struct PlayerStepList: View {
    let titles: [String]
    let currentIndex: Int?

    var body: some View {
        ScrollViewReader { reader in
            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(Array(titles.enumerated()), id: \.offset) { index, title in
                        row(index: index, title: title)
                            .id(index)
                    }
                }
                .padding(.vertical, 4)
            }
            .scrollBounceBehavior(.basedOnSize)
            .onAppear { scroll(reader, animated: false) }
            .onChange(of: currentIndex) { scroll(reader, animated: true) }
        }
    }

    private func scroll(_ reader: ScrollViewProxy, animated: Bool) {
        guard let currentIndex else { return }
        if animated {
            withAnimation(.easeInOut(duration: 0.3)) { reader.scrollTo(currentIndex, anchor: .center) }
        } else {
            reader.scrollTo(currentIndex, anchor: .center)
        }
    }

    private enum RowState { case drawn, current, coming }

    private func state(of index: Int) -> RowState {
        guard let currentIndex else { return .coming }
        if index < currentIndex { return .drawn }
        return index == currentIndex ? .current : .coming
    }

    private func row(index: Int, title: String) -> some View {
        let state = state(of: index)
        return HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(state == .current ? Theme.green : state == .drawn ? Theme.greenSoft : Theme.surface)
                if state == .drawn {
                    Image(systemName: "checkmark")
                        .scaledFont(13, .heavy, design: .default)
                        .foregroundStyle(Theme.greenDeep)
                } else {
                    Text("\(index + 1)")
                        .scaledFont(14, .heavy)
                        .foregroundStyle(state == .current ? .white : Theme.ink40)
                }
            }
            .frame(width: 30, height: 30)

            Text(Self.sentenceCase(title))
                .scaledFont(17, state == .current ? .heavy : .semibold)
                .foregroundStyle(state == .current ? Theme.ink : state == .drawn ? Theme.ink55 : Theme.ink40)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 8)
        .background {
            if state == .current {
                RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.greenTint)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Step \(index + 1), \(title), \(state == .drawn ? "drawn" : state == .current ? "now" : "coming up")")
    }

    /// Step titles are written to follow "Coming up ·" ("the roof"); in a list they
    /// start with a capital.
    static func sentenceCase(_ title: String) -> String {
        guard let first = title.first else { return title }
        return first.uppercased() + title.dropFirst()
    }
}
