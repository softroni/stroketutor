import SwiftUI

/// A path's own color: a soft background, a slightly deeper edge for the pressed
/// bottom of a card, and a deep accent for bars and small type. `hp-paths` and
/// `hp-path` both paint a path with it, so the same path always wears the same color.
/// The catalog names each path's color (`paths.json` → `color`), and the Studio's
/// lesson videos wear the same one, so a path looks the same in a video as here.
///
/// The colors are friendly and light so a lesson's own colors still read on the
/// white paper set inside them. None of them is the app's own green, which means
/// "the way forward" and "current", and a finished path trades its tint for gold
/// (`complete`), so neither state is ever mistaken for a path's color.
struct PathTint: Equatable {
    /// The card and hero fill.
    let soft: Color
    /// The 4 pt pressed edge under a card in `soft`.
    let edge: Color
    /// Bars, counts and chips on `soft`.
    let deep: Color

    /// The palette with the names the catalog uses for it, in the order a path that
    /// names no color takes it by position; adjacent entries are far apart on the
    /// color wheel (the last wraps to the first), so neighbors never look alike. The
    /// Studio has the same names and values in `web/src/catalog/pathColors.ts`, and
    /// `catalog.schema.json` lists the names: change all three together.
    private static let swatches: [(name: String, tint: PathTint)] = [
        ("sky", PathTint(soft: "#E3F1FD", edge: "#C3DDF6", deep: "#2F6BE8")),
        ("peach", PathTint(soft: "#FFEBDD", edge: "#F7CDB1", deep: "#D8572D")),
        ("pink", PathTint(soft: "#FDE6EE", edge: "#F4C5D5", deep: "#D6456F")),
        ("butter", PathTint(soft: "#FFF3C9", edge: "#F1DC8E", deep: "#A87414")),
        ("leaf", PathTint(soft: "#E4F4DA", edge: "#C4E4B0", deep: "#4F8A1F")),
        ("lavender", PathTint(soft: "#EEE8FD", edge: "#D6CAF6", deep: "#7A4FD6")),
        ("aqua", PathTint(soft: "#DDF4F4", edge: "#B5E1E1", deep: "#178A8A")),
        ("indigo", PathTint(soft: "#E6E9FC", edge: "#C8CEF3", deep: "#4052C8")),
        ("orchid", PathTint(soft: "#F9E4F7", edge: "#EDC4E9", deep: "#A93CA0")),
        ("sand", PathTint(soft: "#F6EEDF", edge: "#E4D3B5", deep: "#8A5A33")),
    ]

    /// The palette's ten colors, in order.
    static let palette: [PathTint] = swatches.map(\.tint)

    /// The color the catalog calls `name`, or nil for a name this build does not know.
    static func named(_ name: String) -> PathTint? {
        swatches.first { $0.name == name }?.tint
    }

    /// The tint for the path at `index` in the catalog's order, for a path that names
    /// no color. Deterministic, and it wraps, so a longer catalog repeats the palette
    /// rather than running out.
    static func forPath(at index: Int) -> PathTint {
        palette[((index % palette.count) + palette.count) % palette.count]
    }

    /// A path's tint: the color it names, else the one its place gives it. A name
    /// this build does not know falls back like no name at all.
    static func forPath(named name: String?, at index: Int) -> PathTint {
        name.flatMap(named) ?? forPath(at: index)
    }

    /// Gold, for a path whose every lesson has been drawn.
    static let complete = PathTint(soft: Theme.goldSoft, edge: "#F0DDAE", deep: Theme.goldDeep)

    init(soft: Color, edge: String, deep: Color) {
        self.soft = soft
        self.edge = Color(hex: edge) ?? soft
        self.deep = deep
    }

    private init(soft: String, edge: String, deep: String) {
        self.soft = Color(hex: soft) ?? .white
        self.edge = Color(hex: edge) ?? .white
        self.deep = Color(hex: deep) ?? .black
    }
}

extension AppModel {
    /// The path's tint: the color the catalog names for it, else one by its place in
    /// the catalog (`paths` keeps catalog order), so the card on All paths and the
    /// hero on the path screen always agree.
    func tint(for path: PathModel) -> PathTint {
        PathTint.forPath(named: path.color, at: paths.firstIndex { $0.id == path.id } ?? 0)
    }
}
