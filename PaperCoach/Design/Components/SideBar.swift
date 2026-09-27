import SwiftUI

/// The tab bar as a sidebar, for a wide window (`WideLayout.sidebarThreshold`): an
/// iPad on its side, or a 13-inch one either way. Five tabs along the bottom of a
/// screen that wide are a phone's bar stretched thin; down the side they sit where
/// an iPad keeps its sections, and leave room for the paths under them.
///
/// The same five, in the same order and colours as `TabBar`: each glyph in its
/// tint, the active row on its soft colour with the label in the deep one. Under
/// them, every path the catalog ships with its count of drawings, so a learner can
/// go from one path to another in one tap (`AppModel.open(_:)`), the way the Path
/// tab's title does in two.
struct SideBar: View {
    @Binding var selection: MainTab
    @Environment(AppModel.self) private var app

    static let width: CGFloat = 260

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                Text("Paper Coach")
                    .scaledFont(22, .heavy)
                    .tracking(-0.3)
                    .foregroundStyle(Theme.ink)
                    .padding(.horizontal, 12)
                    .padding(.top, 18)
                    .padding(.bottom, 14)
                    .accessibilityAddTraits(.isHeader)

                ForEach(MainTab.allCases) { tab in
                    tabRow(tab)
                }

                if !paths.isEmpty {
                    Text("Paths")
                        .textRole(.eyebrow)
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.ink40)
                        .padding(.horizontal, 12)
                        .padding(.top, 24)
                        .padding(.bottom, 6)
                        .accessibilityAddTraits(.isHeader)

                    ForEach(paths) { path in
                        pathRow(path)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 20)
        }
        .scrollBounceBehavior(.basedOnSize)
        .frame(width: Self.width)
        .background(Theme.card.ignoresSafeArea())
        .overlay(alignment: .trailing) {
            Rectangle()
                .fill(Theme.line)
                .frame(width: 2)
                .ignoresSafeArea()
        }
    }

    private var paths: [PathModel] {
        app.paths.filter { !$0.isEmpty }
    }

    private func tabRow(_ tab: MainTab) -> some View {
        let isActive = tab == selection
        let tint = tab.tint
        return Button {
            selection = tab
        } label: {
            HStack(spacing: 12) {
                Image(systemName: tab.symbol)
                    .scaledFont(20, .semibold, design: .default)
                    .foregroundStyle(
                        LinearGradient(colors: [tint.deep.opacity(0.7), tint.deep],
                                       startPoint: .top, endPoint: .bottom)
                    )
                    .frame(width: 36, height: 30)
                Text(tab.title)
                    .scaledFont(17, .heavy)
                    .foregroundStyle(isActive ? tint.deep : Theme.ink70)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.vertical, 9)
            .padding(.horizontal, 8)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(isActive ? tint.soft : .clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .hoverEffect(.highlight)
        .accessibilityLabel(tab.title)
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
    }

    private func pathRow(_ path: PathModel) -> some View {
        let tint = app.tint(for: path)
        let isActive = selection == .path && app.currentPath?.id == path.id
        let drawn = app.progress.drawnCount(in: path)
        return Button {
            app.open(path)
        } label: {
            HStack(spacing: 10) {
                Circle()
                    .fill(tint.deep)
                    .frame(width: 10, height: 10)
                    .frame(width: 36)
                Text(path.title)
                    .scaledFont(16, isActive ? .heavy : .semibold)
                    .foregroundStyle(isActive ? tint.deep : Theme.ink70)
                    .lineLimit(1)
                Spacer(minLength: 4)
                Text("\(drawn)/\(path.lessonCount)")
                    .scaledFont(13, .heavy)
                    .monospacedDigit()
                    .foregroundStyle(drawn > 0 ? tint.deep : Theme.ink40)
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 8)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(isActive ? tint.soft : .clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .hoverEffect(.highlight)
        .accessibilityLabel("\(path.title), \(drawn) of \(path.lessonCount) drawn")
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
    }
}
