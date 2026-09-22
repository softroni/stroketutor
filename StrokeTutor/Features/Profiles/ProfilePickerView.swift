import SwiftUI

/// "Who's drawing?" — the launch screen when more than one kid uses the app. Big
/// tiles, one tap each. Shown once per launch and never on a return from the
/// background, so a kid mid-lesson who checks another app comes back to their own
/// drawing.
struct ProfilePickerView: View {
    @Environment(AppModel.self) private var app
    @State private var isAdding = false
    /// The kid just added, switched to once the sheet has gone.
    @State private var added: UUID?

    private let columns = [GridItem(.adaptive(minimum: 140, maximum: 200), spacing: 16)]

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.sectionSpacing) {
                Text("Who’s drawing?")
                    .textRole(.largeTitle)
                    .foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.center)
                    .accessibilityAddTraits(.isHeader)
                    .padding(.top, 40)

                LazyVGrid(columns: columns, spacing: 16) {
                    ForEach(app.profiles) { profile in
                        Button {
                            app.switchProfile(to: profile.id)
                        } label: {
                            ProfileTile(profile: profile, drawings: nil)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(profile.displayName)
                        .accessibilityAddTraits(.isButton)
                    }
                }

                Button {
                    isAdding = true
                } label: {
                    Label("Add another kid", systemImage: "plus")
                }
                .buttonStyle(.quiet)
                .padding(.top, 8)
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.page.ignoresSafeArea())
        .sheet(isPresented: $isAdding, onDismiss: {
            if let added { app.switchProfile(to: added) }
        }) {
            NewProfileSheet(onAdded: { profile in
                added = profile.id
                isAdding = false
            }, onCancel: { isAdding = false })
        }
    }
}

/// A kid as a big square card: their animal and their name.
struct ProfileTile: View {
    let profile: Profile
    /// "3 drawings", when the caller knows it.
    var drawings: String?
    var isCurrent = false

    var body: some View {
        VStack(spacing: 10) {
            ProfileAvatarView(avatar: profile.avatar, size: 88, isHighlighted: isCurrent)
            Text(profile.displayName)
                .textRole(.headline)
                .foregroundStyle(Theme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if let drawings {
                Text(drawings)
                    .textRole(.footnote)
                    .foregroundStyle(Theme.ink55)
            }
        }
        .padding(.vertical, 20)
        .padding(.horizontal, 12)
        .frame(maxWidth: .infinity)
        .cardBackground()
        .contentShape(Rectangle())
    }
}

/// Opened from the avatar at the top of Home: who is drawing, a tap to hand over,
/// and the way to add someone. Always reachable, even with one kid, so a family
/// finds out it can add a second.
///
/// It does not switch by itself: it hands the chosen kid to `onChoose` and closes,
/// and Home switches once the sheet is gone, so the screen that presented it is not
/// rebuilt mid-dismissal.
struct ProfileSwitcherSheet: View {
    let onChoose: (UUID) -> Void

    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var isAdding = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                    ListCard {
                        ForEach(Array(app.profiles.enumerated()), id: \.element.id) { index, profile in
                            if index > 0 { RowDivider() }
                            row(for: profile)
                        }
                    }

                    ListCard {
                        Button {
                            isAdding = true
                        } label: {
                            SettingsCustomRow(title: "Add another kid",
                                              subtitle: "Each kid gets their own progress and sketchbook.") {
                                SettingsIconTile(symbol: "plus", tint: .green)
                            } trailing: {
                                EmptyView()
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityElement(children: .combine)
                        .accessibilityAddTraits(.isButton)
                    }

                    Button("Manage kids in Settings") {
                        dismiss()
                        app.selectedTab = .settings
                        app.popToRoot(.settings)
                    }
                    .buttonStyle(.quiet)
                    .frame(maxWidth: .infinity)
                }
                .padding(Theme.gutter)
            }
            .background(Theme.page)
            .navigationTitle("Who’s drawing?")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .sheet(isPresented: $isAdding) {
            NewProfileSheet(onAdded: { profile in
                isAdding = false
                onChoose(profile.id)
                dismiss()
            }, onCancel: { isAdding = false })
        }
    }

    private func row(for profile: Profile) -> some View {
        let isCurrent = profile.id == app.activeProfile.id
        return Button {
            if !isCurrent { onChoose(profile.id) }
            dismiss()
        } label: {
            SettingsCustomRow(title: profile.displayName,
                              subtitle: isCurrent ? "Drawing now" : nil) {
                ProfileAvatarView(avatar: profile.avatar, size: 40)
            } trailing: {
                if isCurrent {
                    Image(systemName: "checkmark")
                        .scaledFont(17, .bold, design: .default)
                        .foregroundStyle(Theme.green)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isCurrent ? [.isButton, .isSelected] : .isButton)
    }
}
