import SwiftUI

/// A list row whose control is a switch (`.list-row` with `.toggle`): the shape of
/// "Also save to Photos". Green when on, as
/// the system switch is with the app's accent.
struct ToggleRow: View {
    let title: String
    var subtitle: String?
    var systemImage: String?
    var tint: SettingsRow.Tint = .neutral
    @Binding var isOn: Bool

    var body: some View {
        HStack(spacing: 14) {
            if let systemImage {
                Image(systemName: systemImage)
                    .scaledFont(19, .semibold, design: .default)
                    .foregroundStyle(tint.foreground)
                    .frame(width: 40, height: 40)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(tint.background))
            }

            Toggle(isOn: $isOn) {
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
            }
            .tint(Theme.green)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 18)
        .frame(minHeight: Theme.minimumTapTarget)
    }
}
