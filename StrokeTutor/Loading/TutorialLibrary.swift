import Foundation
import Observation
import SwiftUI

/// The set of tutorials available this session: everything in the bundle, plus
/// anything imported from the Files app. Imports are not persisted.
@Observable
@MainActor
final class TutorialLibrary {
    private(set) var tutorials: [PreparedTutorial] = []
    private(set) var failures: [TutorialLoadFailure] = []
    private(set) var hasLoaded = false

    /// Loads the bundled tutorials. Safe to call more than once; imported
    /// tutorials are preserved.
    func loadBundledTutorials() {
        let result = TutorialLoader.loadBundledTutorials()
        let imported = tutorials.filter { $0.source == .imported }
        tutorials = result.tutorials + imported
        failures = result.failures
        hasLoaded = true
    }

    /// Handles the result of `.fileImporter`. Returns the imported tutorial on
    /// success so the caller can select it.
    @discardableResult
    func importTutorial(from result: Result<[URL], Error>) -> PreparedTutorial? {
        switch result {
        case let .success(urls):
            guard let url = urls.first else { return nil }
            return importTutorial(at: url)
        case let .failure(error):
            failures.append(TutorialLoadFailure(fileName: "Import",
                                                error: .unreadableFile(reason: error.localizedDescription)))
            return nil
        }
    }

    @discardableResult
    func importTutorial(at url: URL) -> PreparedTutorial? {
        do {
            let tutorial = try TutorialLoader.loadImportedTutorial(at: url)
            // Re-importing the same file replaces the previous copy.
            tutorials.removeAll { $0.source == .imported && $0.fileName == tutorial.fileName }
            tutorials.append(tutorial)
            failures.removeAll { $0.fileName == tutorial.fileName }
            return tutorial
        } catch let error as TutorialLoadError {
            failures.append(TutorialLoadFailure(fileName: url.lastPathComponent, error: error))
        } catch {
            failures.append(TutorialLoadFailure(fileName: url.lastPathComponent,
                                                error: .unreadableFile(reason: error.localizedDescription)))
        }
        return nil
    }

    func clearFailures() {
        failures.removeAll()
    }
}
