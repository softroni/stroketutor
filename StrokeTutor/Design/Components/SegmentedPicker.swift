import SwiftUI

/// The segmented control of v3 (`.seg`): a soft track with 3 pt padding and a white
/// selected segment. Used for playback speed on `st-voice` and in the player's menu.
struct SegmentedPicker<Value: Hashable>: View {
    let options: [Value]
    let title: (Value) -> String
    @Binding var selection: Value

    var body: some View {
        HStack(spacing: 3) {
            ForEach(options, id: \.self) { option in
                let isOn = option == selection
                Button {
                    selection = option
                } label: {
                    Text(title(option))
                        .scaledFont(15, .bold)
                        .foregroundStyle(isOn ? Theme.ink : Theme.ink55)
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 40)
                        .background(
                            RoundedRectangle(cornerRadius: 11, style: .continuous)
                                .fill(isOn ? Theme.card : .clear)
                                .shadow(color: isOn ? .black.opacity(0.14) : .clear, radius: 1.5, y: 1)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
            }
        }
        .padding(3)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.surface))
    }
}
