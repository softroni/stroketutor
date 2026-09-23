import SwiftUI

/// `ob-age` — "How old is the person drawing?" Six bands in a grid and a quiet
/// "Prefer not to say" under Continue. Worded for whoever is holding the iPad: a
/// parent answering for a small child, or an adult learning alone.
///
/// Unlike the beats after it, nothing is preselected and Continue waits for a tap:
/// a preselected band would be the answer everyone who hurries gives. A learner
/// replaying onboarding sees their own answer chosen. Continue and "Prefer not to
/// say" both write the answer to the learner who is drawing, asking for the PIN
/// first when the answer would loosen how their data is treated.
struct OnboardingAgeBeat: View {

    let rail: OnboardingRail
    let onContinue: () -> Void

    @Environment(AppModel.self) private var app
    @State private var selection: AgeGroup?
    @State private var hasLoaded = false
    @State private var gate: PINGateRequest?

    var body: some View {
        OnboardingBeatFrame(rail: rail) {
            TutorSays(pose: .neutral,
                      text: "How old is the person drawing? It helps me suggest lessons that fit.")

            AgeGroupGrid(selection: selection) { selection = $0 }
                .padding(.top, 4)
        } footer: {
            Button("Continue") {
                if let selection { answer(selection) }
            }
            .buttonStyle(.primary)
            .disabled(selection == nil)
            .opacity(selection == nil ? 0.4 : 1)

            Button(AgeGroup.preferNotToSay.title) { answer(.preferNotToSay) }
                .buttonStyle(.quiet)
        }
        .pinGate($gate)
        .onAppear {
            guard !hasLoaded else { return }
            hasLoaded = true
            if let stored = app.activeProfile.ageGroup, stored != .preferNotToSay {
                selection = stored
            }
        }
    }

    private func answer(_ ageGroup: AgeGroup) {
        let id = app.activeProfile.id
        let commit = {
            app.setAgeGroup(id, to: ageGroup)
            app.analytics.track(.onboardingAgeAnswered)
            onContinue()
        }
        if app.ageChangeNeedsPIN(id, to: ageGroup) {
            gate = PINGateRequest(reason: "Needed to change the age group.", onApproved: commit)
        } else {
            commit()
        }
    }
}
