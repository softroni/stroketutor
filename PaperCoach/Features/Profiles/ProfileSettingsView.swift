import SwiftUI

/// One learner's page in Settings: their name and picture, which anyone may change;
/// their age group, which needs the PIN (when one is set) to move to an older,
/// less protected group; and deleting them, which needs the PIN when one is set.
struct ProfileSettingsView: View {
    let profileId: UUID

    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var avatar: ProfileAvatar = .fox
    @State private var hasLoaded = false
    @State private var gate: PINGateRequest?
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

                    ageSection(profile)
                        .disabled(app.isTemporary(profile))

                    if app.isTemporary(profile) {
                        SettingsCaption("These drawings are still being moved into their own folder. Try again after the app next starts.")
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
        .pinGate($gate)
        .alert("Delete \(profile?.displayName ?? "")?", isPresented: $isConfirmingDelete) {
            Button("Delete", role: .destructive, action: delete)
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Their progress and every page in their sketchbook are removed from this iPhone. This cannot be undone.")
        }
    }

    // MARK: - Age group

    private func ageSection(_ profile: Profile) -> some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            Text("Age group")
                .textRole(.headline)
                .foregroundStyle(Theme.ink)
                .padding(.top, 8)

            AgeGroupGrid(selection: profile.ageGroup) { requestAgeGroup($0, for: profile) }

            Button {
                requestAgeGroup(.preferNotToSay, for: profile)
            } label: {
                HStack(spacing: 8) {
                    Text(AgeGroup.preferNotToSay.title)
                    if profile.ageGroup == .preferNotToSay {
                        ChoiceCheck()
                    }
                }
            }
            .buttonStyle(.quiet)
            .accessibilityAddTraits(profile.ageGroup == .preferNotToSay ? [.isButton, .isSelected] : .isButton)

            SettingsCaption(ageCaption(profile))
        }
    }

    private func ageCaption(_ profile: Profile) -> String {
        let answered = profile.ageGroupAnsweredAt.map {
            " Chosen \($0.formatted(date: .abbreviated, time: .omitted))."
        } ?? ""
        let guarded = app.pin.isSet ? " Moving to an older group asks for the PIN." : ""
        if profile.ageGroup == nil {
            return "Not answered yet. Used to suggest lessons that fit." + guarded
        }
        return "Used to suggest lessons that fit." + answered + guarded
    }

    /// Straight away when the change keeps the learner as protected or more; after
    /// the PIN when it would loosen that.
    private func requestAgeGroup(_ ageGroup: AgeGroup, for profile: Profile) {
        guard ageGroup != profile.ageGroup else { return }
        let id = profile.id
        if app.ageChangeNeedsPIN(id, to: ageGroup) {
            gate = PINGateRequest(reason: "Needed to change \(profile.displayName)’s age group.") {
                app.setAgeGroup(id, to: ageGroup)
            }
        } else {
            app.setAgeGroup(id, to: ageGroup)
        }
    }

    // MARK: - Name, picture, deleting

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

    /// With a PIN set, the PIN first; either way, a confirmation that names
    /// exactly what goes.
    private func requestDelete(_ profile: Profile) {
        if app.pin.isSet {
            gate = PINGateRequest(reason: "Needed to delete \(profile.displayName).") {
                isConfirmingDelete = true
            }
        } else {
            isConfirmingDelete = true
        }
    }

    /// Deleting the learner who is drawing hands the app to another learner, which
    /// already clears every stack; deleting anyone else just comes back to Settings.
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
