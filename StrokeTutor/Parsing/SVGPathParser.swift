import CoreGraphics
import Foundation
import SwiftUI

/// A single resolved segment of a parsed path, in canvas coordinates.
///
/// Parsing is deliberately split into "tokens" and "Path building" so the
/// grammar can be unit tested without touching SwiftUI.
enum SVGPathSegment: Equatable {
    case move(CGPoint)
    case line(CGPoint)
    /// `C x1 y1 x2 y2 x y` — control1, control2, end.
    case cubic(control1: CGPoint, control2: CGPoint, end: CGPoint)
    /// `Q x1 y1 x y` — control, end.
    case quad(control: CGPoint, end: CGPoint)
    case close
}

/// Errors thrown by `SVGPathParser`. Every case names the character index in the
/// original `d` string so an author can find the mistake in their export.
enum SVGPathError: Error, Equatable, LocalizedError {
    /// A character appeared where a command letter was expected.
    case unexpectedCharacter(Character, index: Int)
    /// A lowercase (relative) command was found. We render absolute coordinates
    /// only, so misrendering silently would be worse than refusing.
    case relativeCommandUnsupported(Character, index: Int)
    /// A command letter outside the supported M/L/C/Q/Z subset.
    case unsupportedCommand(Character, index: Int)
    /// The path did not begin with a moveto.
    case missingInitialMove(index: Int)
    /// A number could not be read where one was required.
    case invalidNumber(String, index: Int)
    /// The string ended part-way through a command's coordinate list.
    case truncatedCommand(Character, index: Int, expected: Int, found: Int)
    /// The `d` string held no drawable commands.
    case emptyPath

    var errorDescription: String? {
        switch self {
        case let .unexpectedCharacter(character, index):
            return "Unexpected character '\(character)' at position \(index): expected a command letter (M, L, C, Q or Z)."
        case let .relativeCommandUnsupported(character, index):
            return "Relative command '\(character)' at position \(index) is not supported. Re-export this path using absolute commands (uppercase)."
        case let .unsupportedCommand(character, index):
            return "Command '\(character)' at position \(index) is outside the supported subset. Only M, L, C, Q and Z are allowed."
        case let .missingInitialMove(index):
            return "Path must begin with a moveto command (M) at position \(index)."
        case let .invalidNumber(text, index):
            return "Could not read a number from \"\(text)\" at position \(index)."
        case let .truncatedCommand(character, index, expected, found):
            return "Command '\(character)' at position \(index) needs \(expected) numbers but only \(found) followed it."
        case .emptyPath:
            return "The path string is empty."
        }
    }
}

/// Parses the absolute-only `M / L / C / Q / Z` subset of the SVG path grammar.
///
/// Deliberately not a general SVG parser: the authoring tool emits this subset,
/// and anything outside it should fail loudly rather than draw the wrong picture.
enum SVGPathParser {

    /// Parses `d` into a SwiftUI `Path` in canvas coordinates.
    static func parse(_ d: String) throws -> Path {
        buildPath(from: try parseSegments(d))
    }

    /// Parses `d` into its segment list. The unit tests drive this entry point.
    static func parseSegments(_ d: String) throws -> [SVGPathSegment] {
        var scanner = Scanner(characters: Array(d))
        var segments: [SVGPathSegment] = []
        var sawMove = false

        scanner.skipSeparators()
        while let (command, commandIndex) = try scanner.nextCommand() {
            let uppercased = command.uppercased()
            guard uppercased.count == 1, let normalized = uppercased.first else {
                throw SVGPathError.unsupportedCommand(command, index: commandIndex)
            }

            if normalized != "Z" && command.isLowercase {
                // 'z' and 'Z' are identical in meaning, so only that one letter
                // is allowed to be lowercase.
                throw SVGPathError.relativeCommandUnsupported(command, index: commandIndex)
            }
            guard "MLCQZ".contains(normalized) else {
                throw SVGPathError.unsupportedCommand(command, index: commandIndex)
            }
            if !sawMove && normalized != "M" {
                throw SVGPathError.missingInitialMove(index: commandIndex)
            }

            if normalized == "Z" {
                segments.append(.close)
                scanner.skipSeparators()
                continue
            }

            let arity = arity(of: normalized)
            var repetition = 0
            // A single command letter may be followed by several coordinate sets:
            // "L 10 10 20 20" is two line segments.
            repeat {
                let numbers = try scanner.readNumbers(count: arity, command: command, commandIndex: commandIndex)
                switch normalized {
                case "M":
                    // Per the SVG grammar, coordinate pairs after the first in a
                    // moveto are implicit linetos.
                    segments.append(repetition == 0 ? .move(point(numbers, 0)) : .line(point(numbers, 0)))
                    sawMove = true
                case "L":
                    segments.append(.line(point(numbers, 0)))
                case "C":
                    segments.append(.cubic(control1: point(numbers, 0),
                                           control2: point(numbers, 2),
                                           end: point(numbers, 4)))
                case "Q":
                    segments.append(.quad(control: point(numbers, 0), end: point(numbers, 2)))
                default:
                    throw SVGPathError.unsupportedCommand(command, index: commandIndex)
                }
                repetition += 1
                scanner.skipSeparators()
            } while scanner.peekStartsNumber()
        }

        guard !segments.isEmpty else { throw SVGPathError.emptyPath }
        return segments
    }

    /// Builds a `Path` from already-validated segments.
    ///
    /// Tracks its own current point so a stray segment can never ask SwiftUI to
    /// draw from an undefined position.
    static func buildPath(from segments: [SVGPathSegment]) -> Path {
        var path = Path()
        var current: CGPoint?
        var subpathStart: CGPoint?

        for segment in segments {
            switch segment {
            case let .move(point):
                path.move(to: point)
                current = point
                subpathStart = point
            case let .line(point):
                guard current != nil else { continue }
                path.addLine(to: point)
                current = point
            case let .cubic(control1, control2, end):
                guard current != nil else { continue }
                path.addCurve(to: end, control1: control1, control2: control2)
                current = end
            case let .quad(control, end):
                guard current != nil else { continue }
                path.addQuadCurve(to: end, control: control)
                current = end
            case .close:
                guard current != nil else { continue }
                path.closeSubpath()
                // After a close the current point returns to the subpath start.
                current = subpathStart
            }
        }
        return path
    }

    private static func arity(of command: Character) -> Int {
        switch command {
        case "M", "L": return 2
        case "Q": return 4
        case "C": return 6
        default: return 0
        }
    }

    private static func point(_ numbers: [CGFloat], _ offset: Int) -> CGPoint {
        CGPoint(x: numbers[offset], y: numbers[offset + 1])
    }
}

// MARK: - Scanner

private extension SVGPathParser {

    /// A character-index scanner. Indices are reported in errors, so it walks an
    /// `Array<Character>` rather than using `String.Index`.
    struct Scanner {
        let characters: [Character]
        var index: Int = 0

        init(characters: [Character]) {
            self.characters = characters
        }

        var isAtEnd: Bool { index >= characters.count }

        static func isSeparator(_ character: Character) -> Bool {
            character == "," || character.isWhitespace
        }

        mutating func skipSeparators() {
            while index < characters.count, Self.isSeparator(characters[index]) {
                index += 1
            }
        }

        /// Returns the next command letter and where it was found, or nil at end.
        mutating func nextCommand() throws -> (Character, Int)? {
            skipSeparators()
            guard index < characters.count else { return nil }
            let character = characters[index]
            guard character.isLetter else {
                throw SVGPathError.unexpectedCharacter(character, index: index)
            }
            let commandIndex = index
            index += 1
            return (character, commandIndex)
        }

        /// True if what follows could begin a number — used to detect repeated
        /// coordinate sets after one command letter.
        func peekStartsNumber() -> Bool {
            guard index < characters.count else { return false }
            let character = characters[index]
            return character.isNumber || character == "-" || character == "+" || character == "."
        }

        mutating func readNumbers(count: Int, command: Character, commandIndex: Int) throws -> [CGFloat] {
            var numbers: [CGFloat] = []
            numbers.reserveCapacity(count)
            for _ in 0..<count {
                skipSeparators()
                guard !isAtEnd, peekStartsNumber() else {
                    throw SVGPathError.truncatedCommand(command,
                                                        index: commandIndex,
                                                        expected: count,
                                                        found: numbers.count)
                }
                numbers.append(try readNumber())
            }
            return numbers
        }

        mutating func readNumber() throws -> CGFloat {
            let start = index
            if index < characters.count, characters[index] == "-" || characters[index] == "+" {
                index += 1
            }
            var sawDigit = false
            while index < characters.count, characters[index].isNumber {
                index += 1
                sawDigit = true
            }
            if index < characters.count, characters[index] == "." {
                index += 1
                while index < characters.count, characters[index].isNumber {
                    index += 1
                    sawDigit = true
                }
            }
            // Scientific notation, e.g. "1.5e-3", as emitted by some exporters.
            if sawDigit, index < characters.count, characters[index] == "e" || characters[index] == "E" {
                let exponentStart = index
                index += 1
                if index < characters.count, characters[index] == "-" || characters[index] == "+" {
                    index += 1
                }
                var sawExponentDigit = false
                while index < characters.count, characters[index].isNumber {
                    index += 1
                    sawExponentDigit = true
                }
                if !sawExponentDigit { index = exponentStart }
            }

            let text = String(characters[start..<index])
            // `Double("1e400")` is +inf rather than nil, and an infinite
            // coordinate reaches SwiftUI as an undefined path that draws
            // nothing. Refuse it here, where the author can be told why.
            guard sawDigit, let value = Double(text), value.isFinite else {
                throw SVGPathError.invalidNumber(text.isEmpty ? String(characters[safe: start] ?? " ") : text,
                                                 index: start)
            }
            return CGFloat(value)
        }
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
