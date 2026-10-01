import SwiftUI

/// Something a child's profile does only once a grown-up has said yes: the check
/// `check` names (the app's PIN, or the question in words), then `onApproved`.
/// A request whose check is `.notNeeded` goes straight on.
struct GrownUpCheckRequest: Identifiable {
    let id = UUID()
    let check: GrownUpCheck
    /// Under the PIN pad: what the PIN is needed for.
    let reason: String
    let onApproved: () -> Void
}

extension View {
    /// Asks the grown-ups' check for `request` — the PIN pad (`pinGate`) or the
    /// question in words (`ParentalQuestion`) — and runs its action once it is
    /// answered right: after the PIN pad has closed, or as the question's alert goes.
    func grownUpCheck(_ request: Binding<GrownUpCheckRequest?>) -> some View {
        modifier(GrownUpCheckModifier(request: request))
    }
}

private struct GrownUpCheckModifier: ViewModifier {
    @Binding var request: GrownUpCheckRequest?
    @State private var pinRequest: PINGateRequest?
    @State private var question: ParentalQuestion?
    @State private var answer = ""
    @State private var onRightAnswer: (() -> Void)?

    func body(content: Content) -> some View {
        content
            .pinGate($pinRequest)
            // The same alert Settings asks before a PIN is made.
            .alert("Grown-ups only",
                   isPresented: Binding(get: { question != nil }, set: { if !$0 { question = nil } }),
                   presenting: question) { question in
                TextField("Type the number", text: $answer)
                    .keyboardType(.numberPad)
                Button("Continue") { answered(question) }
                Button("Cancel", role: .cancel) { onRightAnswer = nil }
            } message: { question in
                Text("Ask a grown-up to answer this. \(question.text)")
            }
            .onChange(of: request?.id) { _, id in
                guard id != nil, let request else { return }
                self.request = nil
                switch request.check {
                case .notNeeded:
                    request.onApproved()
                case .pin:
                    pinRequest = PINGateRequest(reason: request.reason, onApproved: request.onApproved)
                case .question:
                    answer = ""
                    onRightAnswer = request.onApproved
                    let asked = ParentalQuestion.random()
                    question = asked
                    #if DEBUG
                    answerForTheHarness(asked)
                    #endif
                }
            }
    }

    /// "Continue": the action runs only for the right number.
    private func answered(_ question: ParentalQuestion) {
        let action = onRightAnswer
        onRightAnswer = nil
        if Int(answer.trimmingCharacters(in: .whitespaces)) == question.answer {
            action?()
        }
    }

    #if DEBUG
    /// Screenshot-harness only (`entry-share-answered`): a grown-up answers right a
    /// moment after the question comes up, so what follows the check can be seen.
    private func answerForTheHarness(_ asked: ParentalQuestion) {
        guard DebugScreenHarness.answerGrownUpQuestion else { return }
        DebugScreenHarness.answerGrownUpQuestion = false
        Task {
            try? await Task.sleep(for: .seconds(1.5))
            answer = String(asked.answer)
            answered(asked)
            question = nil
        }
    }
    #endif
}
