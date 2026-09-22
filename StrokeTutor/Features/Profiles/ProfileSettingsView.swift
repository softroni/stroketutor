import SwiftUI

/// One kid's page in Settings: their name and picture, which anyone may change,
/// and deleting them, which needs a parent.
struct ProfileSettingsView: View {
    let profileId: UUID

    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var avatar: ProfileAvatar = .fox
    @State private var hasLoaded = false
    @State private var gate: ParentGateRequest?
    @State private var isConfirmingDelete = false
    @State private var didFailToDelete = false

    private var profile: Profile? {
        app.profiles.first { $0.id == profileId }
    }

    var body: some View {
        ScrollView {
            if let profile {
                VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                    ProfileForm(name: $name,
                                avatar: $avatar,
                                takenAvatars: Set(app.profiles.filter { $0.id != profileId }.map(\.avatar)))
                        .disabled(app.isTemporary(profile))

                    if app.isTemporary(profile) {
                        SettingsCaption("This kid’s drawings are still being moved into their own folder. Try again after the app next starts.")
                    }

                    if app.canDelete(profile) {
                        ListCard {
                            Button {
                                requestDelete(profile)
                            } label: {
                                Text("Delete \(profile.displayName)")
                                    .textRole(.headline)
                                    .foregroundStyle(Theme.danger)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .frame(minHeight: Theme.minimumTapTarget)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityHint("Removes their progress and sketchbook from this iPhone.")
                        }
                        .padding(.top, Theme.sectionSpacing)
                    }

                    if didFailToDelete {
                        Text("That could not be deleted. Try again.")
                            .textRole(.footnote)
                            .foregroundStyle(Theme.danger)
                    }
                }
                .padding(.horizontal, Theme.gutter)
                .padding(.vertical, 16)
            }
        }
        .settingsNavigationBar(profile?.displayName ?? "")
        .onAppear(perform: load)
        .onChange(of: avatar) { _, _ in save() }
        .onSubmit(save)
        .onDisappear(perform: save)
        .parentGate($gate)
        .alert("Delete \(profile?.displayName ?? "")?", isPresented: $isConfirmingDelete) {
            Button("Delete", role: .destructive, action: delete)
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Their progress and every page in their sketchbook are removed from this iPhone. This cannot be undone.")
        }
    }

    private func load() {
        guard !hasLoaded, let profile else { return }
        hasLoaded = true
        name = profile.name
        avatar = profile.avatar
    }

    private func save() {
        guard hasLoaded, let profile, !app.isTemporary(profile) else { return }
        guard Profile.cleaned(name) != profile.name || avatar != profile.avatar else { return }
        app.updateProfile(profileId, name: name, avatar: avatar)
    }

    /// With a parent PIN, the PIN first; either way, a confirmation that names
    /// exactly what goes.
    private func requestDelete(_ profile: Profile) {
        if app.parentPIN.isSet {
            gate = ParentGateRequest(reason: "Needed to delete \(profile.displayName).") {
                isConfirmingDelete = true
            }
        } else {
            isConfirmingDelete = true
        }
    }

    /// Deleting the kid who is drawing hands the app to another kid, which already
    /// clears every stack; deleting anyone else just comes back to Settings.
    private func delete() {
        let wasActive = profileId == app.activeProfile.id
        do {
            try app.deleteProfile(profileId)
            if !wasActive { dismiss() }
        } catch {
            didFailToDelete = true
        }
    }
}
