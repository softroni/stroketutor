import SwiftUI

/// The inline navigation bar of v3 (`.navbar`): 56 pt tall, a 44 pt back chevron at
/// the leading edge, the screen's name centered at 17/heavy, and room for one
/// trailing control. Screens that use it hide the system bar, so the height, the
/// glyph and the title's weight are the mockup's rather than UIKit's.
///
/// The title stays centered even when the back button is present, because the two
/// 60 pt rails of `.navbar`'s grid are drawn as padding around a centered label.
///
/// A tab root has nothing to go back to, but may let its title switch what it
/// shows — the Path tab's "Landscape ⌄" opens All paths. That is the same bar with
/// the leading rail empty and the title made a button (`titleAction`), rather than
/// a second bar, so a root and a pushed screen line up exactly.
struct InlineNavBar<Trailing: View>: View {
    let title: String
    /// Shown when set — normally `{ dismiss() }`. Nil leaves the leading rail empty.
    var onBack: (() -> Void)?
    /// Makes the title a button with a down chevron beside it. Nil keeps it text.
    var titleAction: NavBarTitleAction?
    @ViewBuilder var trailing: Trailing

    var body: some View {
        ZStack {
            titleView
                .padding(.horizontal, 60)

            HStack(spacing: 0) {
                if let onBack {
                    Button(action: onBack) {
                        Image(systemName: "chevron.left")
                            .scaledFont(19, .bold, design: .default)
                            .foregroundStyle(Theme.ink)
                            .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Back")
                }
                Spacer(minLength: 0)
                trailing
            }
            .padding(.horizontal, 8)
        }
        .frame(height: 56)
        .frame(maxWidth: .infinity)
        .background(Theme.page)
    }

    @ViewBuilder
    private var titleView: some View {
        if let titleAction {
            Button(action: titleAction.perform) {
                HStack(spacing: 6) {
                    titleText
                    Image(systemName: "chevron.down")
                        .scaledFont(13, .bold, design: .default)
                        .foregroundStyle(Theme.ink55)
                }
                .frame(minHeight: Theme.navTapTarget)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            // One element that says both what is showing and what a tap does, and
            // still reads as the screen's heading.
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(title), \(titleAction.name)")
            .accessibilityAddTraits([.isButton, .isHeader])
        } else {
            titleText
                .accessibilityAddTraits(.isHeader)
        }
    }

    private var titleText: some View {
        Text(title)
            .scaledFont(17, .heavy, relativeTo: .headline)
            .tracking(-0.2)
            .foregroundStyle(Theme.ink)
            .lineLimit(1)
            .truncationMode(.tail)
    }
}

/// What tapping an `InlineNavBar` title does. `name` is read by VoiceOver after the
/// title — "Landscape, choose another path" — so it is a short lowercase phrase.
struct NavBarTitleAction {
    let name: String
    let perform: () -> Void
}

extension InlineNavBar where Trailing == EmptyView {
    init(title: String,
         onBack: (() -> Void)? = nil,
         titleAction: NavBarTitleAction? = nil) {
        self.init(title: title, onBack: onBack, titleAction: titleAction, trailing: { EmptyView() })
    }
}
