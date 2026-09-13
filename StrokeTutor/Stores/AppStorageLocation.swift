import Foundation

/// Where the two file-backed stores keep their data, and how they write it.
///
/// Application Support, not Documents: these files are the app's own bookkeeping,
/// not documents the learner manages. They are included in device backups, which is
/// what the handbook promises for the sketchbook, and they never leave the device.
enum AppStorageLocation {

    /// The app's Application Support directory, created if it is not there yet.
    /// Falls back to a temporary directory if the system refuses, so a store can
    /// always be constructed — the app is usable even when nothing can persist.
    static func applicationSupport() -> URL {
        let manager = FileManager.default
        do {
            return try manager.url(for: .applicationSupportDirectory,
                                   in: .userDomainMask,
                                   appropriateFor: nil,
                                   create: true)
        } catch {
            return manager.temporaryDirectory
        }
    }

    /// Writes a file atomically, creating its folder first. Atomic matters here:
    /// the app can be killed mid-write, and half a JSON index would lose everything.
    static func writeAtomically(_ data: Data, to url: URL) throws {
        let directory = url.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try data.write(to: url, options: .atomic)
    }
}

extension JSONEncoder {
    /// One encoder shape for every store: ISO 8601 dates, stable key order.
    static var storeEncoder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]
        return encoder
    }
}

extension JSONDecoder {
    static var storeDecoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
