import Foundation
import XCTest
@testable import StrokeTutor

/// What the app reads out of `Voice/`, and what it says when the folder is not what
/// it expects. The contract is `web/src/voice/types.ts` (`VoiceManifest`,
/// `AppVoiceManifest`); these tests build the folder by hand so they hold whether or
/// not any audio was published into this build.
@MainActor
final class NarrationTests: XCTestCase {

    private var root: URL!

    override func setUp() {
        super.setUp()
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent("NarrationTests-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: root)
        root = nil
        super.tearDown()
    }

    // MARK: - The manifests

    func testALessonManifestDecodes() throws {
        let manifest = try JSONDecoder().decode(VoiceManifest.self, from: Data(Self.lessonManifest.utf8))
        XCTAssertEqual(manifest.manifestVersion, 1)
        XCTAssertEqual(manifest.lessonId, "palm-tree-4")
        XCTAssertEqual(manifest.voiceName, "House voice")
        XCTAssertEqual(manifest.steps.count, 2)
        let trunk = try XCTUnwrap(manifest.steps["trunk-edge"])
        XCTAssertEqual(trunk.file, "trunk-edge.m4a")
        XCTAssertEqual(trunk.text, "Begin at the bottom left of the trunk.")
        XCTAssertEqual(trunk.durationMs, 19_000)
    }

    /// The Studio writes more than the app reads — `voiceId`, `model`, `textHash`,
    /// `generatedAt` — and a manifest with them in it must still decode.
    func testTheStudiosExtraFieldsAreIgnoredRatherThanRefused() throws {
        let manifest = try JSONDecoder().decode(AppVoiceManifest.self, from: Data(Self.appManifest.utf8))
        XCTAssertEqual(manifest.manifestVersion, 1)
        XCTAssertEqual(Set(manifest.lines.keys), ["hello", "lesson-1"])
        XCTAssertEqual(manifest.lines["hello"]?.text, "Hi, I'm Lina.")
    }

    // MARK: - What has a voice

    func testAStepHasAVoiceWhenTheManifestNamesItAndTheFileIsThere() throws {
        try publish(lesson: "palm-tree-4", manifest: Self.lessonManifest, files: ["trunk-edge.m4a"])
        let library = VoiceLibrary(root: root)

        XCTAssertNotNil(library.audioURL(lessonId: "palm-tree-4", stepId: "trunk-edge"))
        XCTAssertEqual(library.text(lessonId: "palm-tree-4", stepId: "trunk-edge"),
                       "Begin at the bottom left of the trunk.")

        // Named by the manifest, but the file never arrived.
        XCTAssertNil(library.audioURL(lessonId: "palm-tree-4", stepId: "trunk-rings"))
        // In neither.
        XCTAssertNil(library.audioURL(lessonId: "palm-tree-4", stepId: "coconuts"))
        // A lesson nobody has narrated.
        XCTAssertNil(library.audioURL(lessonId: "simple-house", stepId: "walls"))
    }

    /// The manifest is what says a recording is current, so a half-copied folder of
    /// audio with no manifest is silent rather than speaking who-knows-what.
    func testAFolderWithNoManifestIsSilent() throws {
        try publish(lesson: "palm-tree-4", manifest: nil, files: ["trunk-edge.m4a"])
        let library = VoiceLibrary(root: root)
        XCTAssertNil(library.manifest(lessonId: "palm-tree-4"))
        XCTAssertNil(library.audioURL(lessonId: "palm-tree-4", stepId: "trunk-edge"))
    }

    func testAManifestThatIsNotJSONIsSilent() throws {
        try publish(lesson: "palm-tree-4", manifest: "{ this is not json", files: ["trunk-edge.m4a"])
        XCTAssertNil(VoiceLibrary(root: root).audioURL(lessonId: "palm-tree-4", stepId: "trunk-edge"))
    }

    /// A manifest written for a later app than this one is put aside whole: silence
    /// is the safe end of a contract this build does not know.
    func testAManifestFromALaterAppIsNotRead() throws {
        let later = Self.lessonManifest.replacingOccurrences(of: "\"manifestVersion\": 1",
                                                             with: "\"manifestVersion\": 2")
        try publish(lesson: "palm-tree-4", manifest: later, files: ["trunk-edge.m4a"])
        XCTAssertNil(VoiceLibrary(root: root).manifest(lessonId: "palm-tree-4"))
    }

    /// A file name in a manifest is a name, not a path.
    func testAFileNameThatClimbsOutOfItsFolderIsIgnored() throws {
        let escaping = Self.lessonManifest.replacingOccurrences(of: "\"file\": \"trunk-edge.m4a\"",
                                                                with: "\"file\": \"../app/hello.m4a\"")
        try publish(lesson: "palm-tree-4", manifest: escaping, files: [])
        try publish(lesson: "app", manifest: Self.appManifest, files: ["hello.m4a"])
        XCTAssertNil(VoiceLibrary(root: root).audioURL(lessonId: "palm-tree-4", stepId: "trunk-edge"))
    }

    func testAMissingVoiceFolderIsSilentRatherThanAnError() {
        let library = VoiceLibrary(root: root.appendingPathComponent("nothing-here", isDirectory: true))
        XCTAssertNil(library.audioURL(lessonId: "palm-tree-4", stepId: "trunk-edge"))
        XCTAssertNil(library.appAudioURL("hello"))
        XCTAssertNil(VoiceLibrary(root: nil).appText("hello"))
    }

    // MARK: - The app's own lines

    func testTheAppsOwnLinesAreFoundByIdWithTheirWords() throws {
        try publish(lesson: "app", manifest: Self.appManifest, files: ["hello.m4a"])
        let library = VoiceLibrary(root: root)

        XCTAssertNotNil(library.appAudioURL("hello"))
        XCTAssertEqual(library.appText("hello"), "Hi, I'm Lina.")
        // Recorded in the manifest, but the file is not in this build.
        XCTAssertNil(library.appAudioURL("lesson-1"))
        XCTAssertNil(library.appAudioURL("path-4"))
    }

    /// `NarrationPlayer` is the same lookups plus the audio session, and a bundle
    /// with no `Voice/` in it must leave every screen in the silent state.
    func testThePlayerOverAnEmptyBundleIsSilent() {
        let player = NarrationPlayer(library: VoiceLibrary(root: root))
        XCTAssertFalse(player.hasAudio(lessonId: "palm-tree-4", stepId: "trunk-edge"))
        XCTAssertFalse(player.hasAppLine("hello"))
        XCTAssertNil(player.appLineText("hello"))
        XCTAssertFalse(player.isSpeaking)
        // Asking for a line that is not there is a no-op, not a failure.
        player.play(lessonId: "palm-tree-4", stepId: "trunk-edge")
        player.playAppLine("hello")
        XCTAssertFalse(player.isSpeaking)
    }

    // MARK: - Lina's closing line

    /// The sentence on `sk-complete` and the recording played under it are one
    /// choice, so they cannot say two different things.
    func testTheClosingLineAndItsRecordingAreTheSameChoice() {
        for position in 1...4 {
            let line = CompletionLines.line(isPathDone: false, position: position)
            XCTAssertEqual(line.id, "lesson-\(position)")
            XCTAssertEqual(line.text, CompletionLines.lesson[position - 1])

            let done = CompletionLines.line(isPathDone: true, position: position)
            XCTAssertEqual(done.id, "path-\(position)")
            XCTAssertEqual(done.text, CompletionLines.pathDone[position - 1])
        }
    }

    func testALongPathComesBackRoundToTheFirstLine() {
        XCTAssertEqual(CompletionLines.line(isPathDone: false, position: 5).id, "lesson-1")
        XCTAssertEqual(CompletionLines.line(isPathDone: false, position: 9).id, "lesson-1")
        XCTAssertEqual(CompletionLines.line(isPathDone: true, position: 7).id, "path-3")
    }

    /// A lesson the catalog no longer places still gets a line rather than nothing.
    func testALessonWithNoPlaceStillHasALine() {
        let line = CompletionLines.line(isPathDone: false, position: nil)
        XCTAssertEqual(line.id, "lesson-1")
        XCTAssertEqual(line.text, CompletionLines.lesson[0])
    }

    /// The eight ids the screen can ask for are the eight the Studio publishes
    /// (`APP_LINE_IDS`), so a line is never asked for by a name nothing recorded.
    func testEveryIdTheScreenCanAskForIsOneTheStudioPublishes() {
        let published = Set((1...4).map { "lesson-\($0)" } + (1...4).map { "path-\($0)" })
        for position in 1...12 {
            for isPathDone in [false, true] {
                XCTAssertTrue(published.contains(CompletionLines.line(isPathDone: isPathDone,
                                                                      position: position).id))
            }
        }
    }

    // MARK: - All paths' welcome

    /// The welcome on `hp-paths` asks `Voice/app/` for `paths-welcome`, so the app's
    /// own bundle must carry that line and its recording — read from the build
    /// under test, not from a folder made by hand.
    func testTheBundledAppLinesIncludeThePathsWelcome() throws {
        let library = VoiceLibrary(bundle: .appUnderTest)
        let manifest = try XCTUnwrap(library.appManifest(), "Voice/app/manifest.json is not in the bundle.")
        let line = try XCTUnwrap(manifest.lines[PathsWelcomeLine.id],
                                 "The app manifest has no \(PathsWelcomeLine.id) line.")
        XCTAssertEqual(line.file, "\(PathsWelcomeLine.id).m4a")
        XCTAssertFalse(line.text.isEmpty)
        XCTAssertNotNil(library.appAudioURL(PathsWelcomeLine.id),
                        "\(line.file) is named by the manifest but is not in the bundle.")
    }

    // MARK: - A folder laid out as the bundle's is

    private func publish(lesson: String, manifest: String?, files: [String]) throws {
        let folder = root.appendingPathComponent(lesson, isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        if let manifest {
            try Data(manifest.utf8).write(to: folder.appendingPathComponent("manifest.json"))
        }
        for file in files {
            try Data("not really audio".utf8).write(to: folder.appendingPathComponent(file))
        }
    }

    private static let lessonManifest = """
    {
      "manifestVersion": 1,
      "lessonId": "palm-tree-4",
      "voiceId": "house-chatterbox",
      "voiceName": "House voice",
      "model": "chatterbox",
      "generatedAt": "2026-09-13T22:16:24.213Z",
      "steps": {
        "trunk-edge": {
          "file": "trunk-edge.m4a",
          "text": "Begin at the bottom left of the trunk.",
          "textHash": "abc123",
          "durationMs": 19000
        },
        "trunk-rings": {
          "file": "trunk-rings.m4a",
          "text": "Add two short rings across the trunk.",
          "textHash": "def456",
          "durationMs": 13000
        }
      }
    }
    """

    private static let appManifest = """
    {
      "manifestVersion": 1,
      "voiceId": "house-chatterbox",
      "voiceName": "House voice",
      "model": "chatterbox",
      "generatedAt": "2026-09-13T22:20:00.000Z",
      "lines": {
        "hello": {
          "file": "hello.m4a",
          "text": "Hi, I'm Lina.",
          "textHash": "hello1",
          "durationMs": 7278
        },
        "lesson-1": {
          "file": "lesson-1.m4a",
          "text": "That is the whole shape, in your hand.",
          "textHash": "lesson1",
          "durationMs": 3958
        }
      }
    }
    """
}
