import SwiftUI

/// The Phase 1 scaffold for a screen that has not been designed yet: the screen's
/// name, one honest line about what will be here, and the button that performs the
/// real navigation so every flow can be walked end to end in the simulator.
///
/// Built from the design system, so a stub looks like the app rather than like
/// scaffolding. Phase 2 replaces the contents of each screen file; the last agent to
/// do so deletes this.
struct PlaceholderScreen<Extra: View>: View {
    let title: String
    let line: String
    var actionTitle: String?
    var action: (() -> Void)?
    var secondaryTitle: String?
    var secondaryAction: (() -> Void)?
    @ViewBuilder var extra: Extra

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                    Text(title)
                        .textRole(.title1)
                        .foregroundStyle(Theme.ink)
                    Text(line)
                        .textRole(.body)
                        .foregroundStyle(Theme.ink55)
                        .fixedSize(horizontal: false, vertical: true)
                    extra
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, Theme.stackSpacing)
            }

            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(.primary)
            }
            if let secondaryTitle, let secondaryAction {
                Button(secondaryTitle, action: secondaryAction)
                    .buttonStyle(.quiet)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, Theme.gutter)
        .padding(.bottom, Theme.stackSpacing)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Theme.page)
    }
}

extension PlaceholderScreen where Extra == EmptyView {
    init(title: String,
         line: String,
         actionTitle: String? = nil,
         action: (() -> Void)? = nil,
         secondaryTitle: String? = nil,
         secondaryAction: (() -> Void)? = nil) {
        self.init(title: title,
                  line: line,
                  actionTitle: actionTitle,
                  action: action,
                  secondaryTitle: secondaryTitle,
                  secondaryAction: secondaryAction,
                  extra: { EmptyView() })
    }
}
