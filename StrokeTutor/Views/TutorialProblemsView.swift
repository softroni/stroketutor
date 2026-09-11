import SwiftUI

/// Scrollable, readable report of every file that failed to load.
///
/// A malformed tutorial must never crash the app or leave a blank canvas, so
/// this is the visible outcome of any decode or path-parse failure.
struct TutorialProblemsView: View {
    let failures: [TutorialLoadFailure]
    /// Shown when nothing loaded at all, rather than as a dismissible sheet.
    let isFullScreen: Bool
    var onDismiss: (() -> Void)?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header

                ForEach(failures) { failure in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(failure.fileName)
                            .font(.system(size: 17, weight: .bold, design: .monospaced))
                            .foregroundStyle(Theme.ink)

                        Text(failure.error.errorDescription ?? "Unknown error.")
                            .font(.system(size: 15, weight: .regular))
                            .foregroundStyle(Theme.ink.opacity(0.85))
                            .textSelection(.enabled)
                            .fixedSize(horizontal: false, vertical: true)

                        if let pathData = failure.error.offendingPathData {
                            Text("Offending path data:")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Theme.ink.opacity(0.6))
                            ScrollView(.horizontal, showsIndicators: true) {
                                Text(pathData)
                                    .font(.system(size: 13, design: .monospaced))
                                    .foregroundStyle(Theme.warning)
                                    .textSelection(.enabled)
                                    .padding(10)
                            }
                            .background(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .fill(Theme.warning.opacity(0.08))
                            )
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(.white)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .strokeBorder(Theme.warning.opacity(0.35), lineWidth: 2)
                    )
                }

                if let onDismiss {
                    Button("Close", action: onDismiss)
                        .buttonStyle(BigSecondaryButtonStyle())
                        .padding(.top, 8)
                }
            }
            .padding(20)
        }
        .background(Theme.pageBackground)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(isFullScreen ? "No tutorials could be loaded" : "Some files could not be loaded")
                .font(Theme.rounded(26, .heavy))
                .foregroundStyle(Theme.ink)
            Text("\(failures.count) file\(failures.count == 1 ? "" : "s") failed. Fix the JSON and try again.")
                .font(Theme.rounded(16, .medium))
                .foregroundStyle(Theme.ink.opacity(0.6))
        }
    }
}
