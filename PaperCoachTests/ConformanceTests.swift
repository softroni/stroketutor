import Foundation
import XCTest
@testable import PaperCoach

/// Runs the shared conformance corpus.
///
/// `shared/conformance/` is read by this suite and by `conformance.test.ts` in
/// the web player. Both assert the verdict the manifest gives, so the two
/// implementations cannot drift apart quietly. Where they are meant to differ —
/// the device clamps a bad duration rather than strand a child mid-lesson, the
/// authoring tool refuses it — the manifest records the divergence and the
/// reason for it, and this suite asserts the iOS half of it.
///
/// Adding a case is dropping a file in `cases/` and an entry in `cases.json`.
/// The folder is a folder reference, so neither the project file nor this file
/// needs to change.
final class ConformanceTests: XCTestCase {

    // MARK: - Manifest

    private struct Manifest: Decodable {
        let cases: [Case]
    }

    private struct Case: Decodable {
        let file: String
        /// The verdict both players must reach, unless `ios` overrides it.
        let expect: String
        let why: String
        let ios: TargetExpectation?

        struct TargetExpectation: Decodable {
            let expect: String?
            let messageContains: String?
            let warningContains: String?
            let why: String?
        }

        /// What this player must decide, divergence taken into account.
        var expectedForIOS: String { iosOverrideIsStale ? expect : (ios?.expect ?? expect) }
        var divergesDeliberately: Bool {
            !iosOverrideIsStale && ios?.expect != nil && ios?.expect != expect
        }

        /// The message the iOS player must produce, if the manifest names one.
        var iosMessageMustContain: String? { iosOverrideIsStale ? nil : ios?.messageContains }
        var iosWarningMustContain: String? { iosOverrideIsStale ? nil : ios?.warningContains }

        /// True when the `ios` block exists only to record that this app used to
        /// refuse version 2 documents ("the iOS player reads version 1 only until
        /// M7"). It reads version 2 now, so the two players agree again and the
        /// override no longer describes either of them. `shared/` is read-only for
        /// the app, so the stale entries are ignored here and the shared verdict is
        /// asserted instead; the manifest itself is the creator's to update.
        var iosOverrideIsStale: Bool {
            let text = [ios?.messageContains, ios?.why].compactMap { $0 }.joined(separator: " ")
            return text.contains("schemaVersion 2") || text.contains("version 1 only")
        }
    }

    // MARK: - Corpus location

    /// The corpus is copied into the test bundle as a folder reference.
    private var corpusURL: URL {
        get throws {
            guard let resourceURL = Bundle(for: ConformanceTests.self).resourceURL else {
                throw XCTSkip("The test bundle has no resource directory.")
            }
            return resourceURL.appendingPathComponent("conformance", isDirectory: true)
        }
    }

    private func loadManifest() throws -> Manifest {
        let url = try corpusURL.appendingPathComponent("cases.json")
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(Manifest.self, from: data)
    }

    // MARK: - Tests

    func testCorpusIsPresentAndComplete() throws {
        let manifest = try loadManifest()
        XCTAssertFalse(manifest.cases.isEmpty, "The shared conformance corpus is empty.")

        let directory = try corpusURL.appendingPathComponent("cases", isDirectory: true)
        let onDisk = Set(
            (try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil))
                .filter { $0.pathExtension == "json" }
                .map(\.lastPathComponent)
        )
        let listed = Set(manifest.cases.map(\.file))

        XCTAssertEqual(listed.subtracting(onDisk), [], "Manifest names cases that do not exist.")
        XCTAssertEqual(onDisk.subtracting(listed), [], "Case files are missing a manifest entry.")
    }

    func testEveryDeliberateDivergenceIsExplained() throws {
        let undocumented = try loadManifest().cases
            .filter { $0.divergesDeliberately && ($0.ios?.why ?? "").isEmpty }
            .map(\.file)
        XCTAssertEqual(undocumented, [], "A divergence from the web player must say why it exists.")
    }

    func testEveryCaseMatchesTheSharedVerdict() throws {
        let manifest = try loadManifest()
        let directory = try corpusURL.appendingPathComponent("cases", isDirectory: true)

        for testCase in manifest.cases {
            XCTContext.runActivity(named: testCase.file) { _ in
                check(testCase, in: directory)
            }
        }
    }

    // MARK: - One case

    private func check(_ testCase: Case, in directory: URL) {
        let url = directory.appendingPathComponent(testCase.file)
        guard let data = try? Data(contentsOf: url) else {
            return XCTFail("\(testCase.file): could not be read.")
        }

        let expectValid = testCase.expectedForIOS == "valid"
        let context = testCase.divergesDeliberately
            ? "\(testCase.file) diverges from the web player on purpose: \(testCase.ios?.why ?? "")"
            : "\(testCase.file): \(testCase.why)"

        do {
            let tutorial = try TutorialLoader.prepare(data: data,
                                                      fileName: testCase.file,
                                                      source: .bundled)
            guard expectValid else {
                return XCTFail("\(context)\nExpected this document to be rejected, but it loaded.")
            }
            if let warning = testCase.iosWarningMustContain {
                XCTAssertTrue(
                    tutorial.warnings.contains { $0.contains(warning) },
                    "\(context)\nExpected a warning mentioning \"\(warning)\", got \(tutorial.warnings)."
                )
            }
        } catch {
            guard !expectValid else {
                return XCTFail("\(context)\nExpected this document to load, but it failed: \(error.localizedDescription)")
            }
            if let fragment = testCase.iosMessageMustContain {
                let description = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                XCTAssertTrue(
                    description.contains(fragment),
                    "\(context)\nExpected the message to mention \"\(fragment)\", got: \(description)"
                )
            }
        }
    }
}
