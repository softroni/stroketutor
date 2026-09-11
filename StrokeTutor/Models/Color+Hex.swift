import SwiftUI

extension Color {
    /// Parses `#RRGGBB` or `#RRGGBBAA` (with or without the leading `#`).
    ///
    /// Returns nil rather than a wrong colour, so callers can record a warning
    /// and fall back to the documented default.
    init?(hex: String) {
        var text = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.hasPrefix("#") { text.removeFirst() }
        guard text.count == 6 || text.count == 8,
              text.allSatisfy({ $0.isHexDigit }),
              let value = UInt64(text, radix: 16) else { return nil }

        let red, green, blue, alpha: Double
        if text.count == 6 {
            red = Double((value & 0xFF0000) >> 16) / 255
            green = Double((value & 0x00FF00) >> 8) / 255
            blue = Double(value & 0x0000FF) / 255
            alpha = 1
        } else {
            red = Double((value & 0xFF00_0000) >> 24) / 255
            green = Double((value & 0x00FF_0000) >> 16) / 255
            blue = Double((value & 0x0000_FF00) >> 8) / 255
            alpha = Double(value & 0x0000_00FF) / 255
        }
        self.init(.sRGB, red: red, green: green, blue: blue, opacity: alpha)
    }
}
