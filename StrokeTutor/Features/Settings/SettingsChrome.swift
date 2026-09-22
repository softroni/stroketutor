import SwiftUI

// The small pieces the four Settings screens share, transcribed from
// `docs/ios-design/src/v3/screens/50-settings.html` and the tokens in
// `docs/ios-design/src/v3/design-system.css`. They live here rather than in
// `Design/Components/` because none of them is general: each one is a shape that
// only Settings draws.

// MARK: - Section header and caption

/// `.sec-h.t-eyebrow.muted`: the 12/heavy uppercase label above a list card,
/// with the 10 pt of extra air the CSS gives it (`padding: 10px 6px 0`).
struct SettingsSectionHeader: View {
    let title: String

    init(_ title: String) { self.title = title }

    var body: some View {
        Text(title.uppercased())
            .textRole(.eyebrow)
            .foregroundStyle(Theme.ink55)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 6)
            .padding(.top, 10)
            .accessibilityAddTraits(.isHeader)
    }
}

/// `.cap`: the quiet 13/600 line that closes a section. Never a control.
struct SettingsCaption: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .textRole(.footnote)
            .foregroundStyle(Theme.ink55)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 6)
    }
}

// MARK: - Icon tile

/// `.list-row .leading`: the 40 pt rounded square that opens a settings row. One
/// soft colour per section — green for Lesson, clay for Lina, gold for Sketchbook,
/// blue for Accessibility, neutral for More. It keeps its 40 pt at every Dynamic
/// Type size, as the screen's notes require.
struct SettingsIconTile<Content: View>: View {
    var tint: SettingsRow.Tint = .neutral
    @ViewBuilder var content: Content

    var body: some View {
        content
            .frame(width: 40, height: 40)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(tint.background))
    }
}

extension SettingsIconTile where Content == AnyView {
    /// The common case: one SF Symbol at the tile's own colour, 22 pt as the
    /// mockup's `svg` is.
    init(symbol: String, tint: SettingsRow.Tint = .neutral) {
        self.init(tint: tint) {
            AnyView(
                Image(systemName: symbol)
                    .scaledFont(19, .semibold, design: .default)
                    .foregroundStyle(tint.foreground)
            )
        }
    }
}

// MARK: - A row with something other than a value on the right

/// `.list-row` for the three rows the shared `SettingsRow` cannot draw: Lina's
/// portrait as the leading tile, the stacked speed control, and the time chip.
/// Same metrics as `SettingsRow` — 60 pt minimum, 18 pt sides, 14 pt gap — so a
/// card built from both kinds of row lines up.
struct SettingsCustomRow<Leading: View, Trailing: View>: View {
    let title: String
    var subtitle: String?
    @ViewBuilder var leading: Leading
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(spacing: 14) {
            leading

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

            trailing
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 18)
        .frame(minHeight: Theme.minimumTapTarget)
    }
}

// MARK: - Cards

/// `.card`: white, radius 24, a 2 pt `--line` border, 20 pt of padding.
struct SettingsCard<Content: View>: View {
    var isSoft: Bool = false
    @ViewBuilder var content: Content

    var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.cardPadding)
            .cardBackground(fill: isSoft ? Theme.surface : Theme.card,
                            border: isSoft ? nil : Theme.line)
    }
}

// MARK: - Navigation bar

/// The 56 pt inline nav bar of the pushed Settings screens: the same
/// `InlineNavBar` the Home group draws — a bare chevron and a 17/heavy title on the
/// white page — in place of the system bar, whose iOS 26 glass circles are not v3's.
///
/// Like `hp-preview` and `sk-entry`, these screens own the bottom of the screen, so
/// they take the tab bar down with them — their routes say so in
/// `AppRoute.hidesTabBar` (`st-voice`, `st-reminder` in v3; About is the same kind
/// of page and is treated the same way).
private struct SettingsNavigationBar: ViewModifier {
    let title: String

    @Environment(\.dismiss) private var dismiss

    func body(content: Content) -> some View {
        VStack(spacing: 0) {
            InlineNavBar(title: title) { dismiss() }
            content
        }
        .background(Theme.page)
        .toolbar(.hidden, for: .navigationBar)
    }
}

extension View {
    /// The 56 pt inline nav bar of the pushed Settings screens: a back
    /// chevron in ink and a 17/heavy rounded title, on the white page.
    func settingsNavigationBar(_ title: String) -> some View {
        modifier(SettingsNavigationBar(title: title))
    }
}

// MARK: - Formatting

enum SettingsFormat {

    /// "StrokeTutor 1.0 (12)", read from the bundle and never hardcoded.
    static func versionLine(bundle: Bundle = .main) -> String {
        "StrokeTutor \(version(bundle: bundle))"
    }

    /// "1.0 (12)".
    static func version(bundle: Bundle = .main) -> String {
        let info = bundle.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = info?["CFBundleVersion"] as? String ?? "1"
        return "\(short) (\(build))"
    }

    /// "1×", "0.5×", "2×", "4×" — the value on the Speed row and in the segmented control.
    static func speed(_ value: Double) -> String {
        value == 1 ? "1×" : String(format: "%g×", value)
    }
}
