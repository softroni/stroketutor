import CoreImage
import CoreImage.CIFilterBuiltins
import simd

/// How a kept page looks: the photo as taken, or with the room's light taken back
/// out of it. A dim lamp or a grey afternoon turns white paper grey or blue and
/// dulls the crayon; Bright and Scan read the paper's color and put it back to
/// white, and the crayon comes back with it.
///
/// Only the light is corrected. Nothing is drawn, smoothed or sharpened, so the
/// page is still the learner's page (plan §32: "the record is the page, not a
/// product shot"). Original stays the default.
enum PageLook: String, CaseIterable, Identifiable, Sendable {
    /// The photo as taken.
    case original
    /// The paper a soft white and the colors true: the light's tint and dimness
    /// taken out, evenly over the whole photo.
    case bright
    /// Like a scan: shadows and uneven light across the sheet taken out too, the
    /// paper pure white, the lines dark and the colors strong.
    case scan

    var id: String { rawValue }

    var title: String {
        switch self {
        case .original: return "Original"
        case .bright: return "Bright"
        case .scan: return "Scan"
        }
    }

    /// The line under the choice on review, saying what this look does.
    var note: String {
        switch self {
        case .original: return "The photo as you took it."
        case .bright: return "Whiter paper and truer colors, for a dim room."
        case .scan: return "White paper and bold colors, like a scan."
        }
    }

    /// `image` in this look, given what the light did to it. Lazy, like every
    /// Core Image recipe: nothing is computed until the result is rendered.
    func applied(to image: CIImage, light: PageLight) -> CIImage {
        switch self {
        case .original:
            return image
        case .bright:
            return Self.bright(image, light: light)
        case .scan:
            return Self.scan(image, light: light)
        }
    }

    // MARK: - The two recipes

    /// The paper as bright as this, just short of white so its grain still shows.
    static let brightPaper: Float = 0.96
    /// The most a look multiplies a channel by: a very dark photo stays a little
    /// dark rather than turning to noise.
    static let maximumGain: Float = 3.5

    /// One gain per channel, from the paper where it is lit best: tint and
    /// exposure in one step. Then the ink back down to near black, since lifting
    /// the paper lifts the lines with it, and a little more color.
    private static func bright(_ image: CIImage, light: PageLight) -> CIImage {
        let gain = light.gain(toward: brightPaper, from: light.paper)
        let ink = min(light.inkLuminance * mean(gain), 1)
        let black = clamp(ink - 0.1, 0, 0.2)
        return levels(image, gain: gain, black: black, white: 1)
            .applyingFilter("CIColorControls", parameters: [kCIInputSaturationKey: 1.12])
    }

    /// The paper's color cell by cell, so a shadow across one corner is lifted
    /// as much as that corner needs; then everything the paper's own grain
    /// reaches clipped to white, the ink to black, and the colors made bolder.
    private static func scan(_ image: CIImage, light: PageLight) -> CIImage {
        let flattened = multiply(image, by: light.gainMap(over: image.extent))
        // In the flattened photo the paper sits at 1 everywhere; the ink sits
        // where its own share of the paper put it.
        let ink = light.inkLuminance / max(light.paperLuminance, 0.05)
        let black = clamp(ink - 0.06, 0, 0.3)
        return levels(flattened, gain: SIMD3(repeating: 1), black: black, white: 0.95)
            .applyingFilter("CIColorControls", parameters: [kCIInputSaturationKey: 1.2])
    }

    /// `(value × gain − black) / (white − black)` per channel, in one color matrix.
    private static func levels(_ image: CIImage, gain: SIMD3<Float>, black: Float, white: Float) -> CIImage {
        let span = max(white - black, 0.05)
        let scale = gain / span
        let offset = CGFloat(-black / span)
        return image.applyingFilter("CIColorMatrix", parameters: [
            "inputRVector": CIVector(x: CGFloat(scale.x), y: 0, z: 0, w: 0),
            "inputGVector": CIVector(x: 0, y: CGFloat(scale.y), z: 0, w: 0),
            "inputBVector": CIVector(x: 0, y: 0, z: CGFloat(scale.z), w: 0),
            "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
            "inputBiasVector": CIVector(x: offset, y: offset, z: offset, w: 0),
        ])
    }

    /// Every pixel of `image` times the same pixel of `gains`, alpha untouched.
    private static func multiply(_ image: CIImage, by gains: CIImage) -> CIImage {
        let filter = CIFilter.multiplyCompositing()
        filter.inputImage = gains
        filter.backgroundImage = image
        return filter.outputImage?.cropped(to: image.extent) ?? image
    }

    private static func mean(_ value: SIMD3<Float>) -> Float { (value.x + value.y + value.z) / 3 }
}

/// What the light did to one photo of a page, measured once on a small copy: the
/// color the paper came out where it is lit best, the color of the darkest ink,
/// and the paper's color cell by cell across the photo, for the shadows.
///
/// Paper is the brightest thing on the page under any light: a crayon reflects
/// only part of what the paper reflects. So the brightest few percent of the photo
/// are paper, whatever the drawing covers, and a cell whose brightest pixels are
/// much darker, or tinted differently, is drawing (or desk) rather than paper.
struct PageLight: Equatable, Sendable {
    /// 0…1 per channel, in the photo's own encoded values.
    var paper: SIMD3<Float>
    var ink: SIMD3<Float>
    /// The paper's color in each cell, row by row from the top. Cells with no
    /// paper in them are filled in from the paper around them.
    var cells: [SIMD3<Float>]
    var columns: Int
    var rows: Int

    var paperLuminance: Float { Self.luminance(paper) }
    var inkLuminance: Float { Self.luminance(ink) }

    /// The long edge of the copy the light is measured on.
    static let samplePixelLength: CGFloat = 256
    /// Cells are this many sample pixels square: 16 across the long edge.
    static let cellPixelLength = 16
    /// Paper is grown out from the cells at least this bright against the paper
    /// where it is lit best…
    static let paperSeedShare: Float = 0.85
    /// …into each neighbor no more than this much darker than the paper beside
    /// it…
    static let paperCellStep: Float = 0.15
    /// …and every paper cell is tinted within this much of the best-lit paper
    /// (the distance between colors with their brightness taken out). Held
    /// against the paper and not the cell beside it, so growing cannot drift a
    /// little at a time into a crayon's color: crayon lets specks of paper
    /// through, so a colored area pales toward white at its brightest.
    static let paperCellTint: Float = 0.05
    /// No cell is paper below this share of the best-lit paper, however
    /// gradually the light falls to it.
    static let paperCellFloor: Float = 0.3

    // MARK: Measuring

    /// Measures `image` on a copy no longer than `samplePixelLength`, rendered
    /// with `context`, which should do no color management so the values read are
    /// the ones the looks will change.
    static func measure(_ image: CIImage, context: CIContext) -> PageLight? {
        let extent = image.extent
        guard !extent.isInfinite, extent.width >= 1, extent.height >= 1 else { return nil }
        let scale = min(1, samplePixelLength / max(extent.width, extent.height))
        let small = image
            .transformed(by: CGAffineTransform(translationX: -extent.minX, y: -extent.minY))
            .applyingFilter("CILanczosScaleTransform", parameters: [kCIInputScaleKey: scale,
                                                                    kCIInputAspectRatioKey: 1])
        let width = Int(small.extent.width), height = Int(small.extent.height)
        guard width > 0, height > 0 else { return nil }
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        pixels.withUnsafeMutableBytes { buffer in
            context.render(small,
                           toBitmap: buffer.baseAddress!,
                           rowBytes: width * 4,
                           bounds: CGRect(x: small.extent.minX, y: small.extent.minY,
                                          width: CGFloat(width), height: CGFloat(height)),
                           format: .RGBA8,
                           colorSpace: nil)
        }
        return measure(rgba: pixels, width: width, height: height)
    }

    /// Measures `pixels`: RGBA, 8 bits a channel, rows from the top. Nil for an
    /// image too small to say anything about.
    static func measure(rgba pixels: [UInt8], width: Int, height: Int) -> PageLight? {
        let count = width * height
        guard width > 0, height > 0, count >= 64, pixels.count >= count * 4 else { return nil }

        var colors = [SIMD3<Float>](repeating: .zero, count: count)
        var lums = [Float](repeating: 0, count: count)
        for index in 0..<count {
            let color = SIMD3(Float(pixels[index * 4]), Float(pixels[index * 4 + 1]),
                              Float(pixels[index * 4 + 2])) / 255
            colors[index] = color
            lums[index] = luminance(color)
        }

        let sorted = lums.sorted()
        func percentile(_ fraction: Float) -> Float {
            sorted[min(count - 1, max(0, Int(fraction * Float(count - 1))))]
        }
        // The top of the page, less its very brightest pixels (glare, or a speck
        // of something shiny), and less the more colorful half of it: a bright
        // yellow crayon comes close to the paper, but paper is the least colorful
        // thing that bright under any light.
        let paper = paperColor(colors, lums, from: percentile(0.85), to: percentile(0.98))
        let ink = meanColor(colors, lums, from: 0, to: percentile(0.01))
        guard luminance(paper) > 0.02 else { return nil }

        let columns = max(1, Int((Float(width) / Float(cellPixelLength)).rounded()))
        let rows = max(1, Int((Float(height) / Float(cellPixelLength)).rounded()))
        // Each cell's brightest pixels, less the very brightest: paper, wherever
        // the drawing leaves any of the cell uncovered.
        var tops = [SIMD3<Float>](repeating: .zero, count: columns * rows)
        for row in 0..<rows {
            for column in 0..<columns {
                let xs = column * width / columns..<(column + 1) * width / columns
                let ys = row * height / rows..<(row + 1) * height / rows
                var cellColors: [SIMD3<Float>] = []
                var cellLums: [Float] = []
                for y in ys {
                    for x in xs {
                        cellColors.append(colors[y * width + x])
                        cellLums.append(lums[y * width + x])
                    }
                }
                guard !cellLums.isEmpty else { continue }
                let cellSorted = cellLums.sorted()
                let low = cellSorted[Int(0.7 * Float(cellSorted.count - 1))]
                let high = cellSorted[Int(0.95 * Float(cellSorted.count - 1))]
                tops[row * columns + column] = meanColor(cellColors, cellLums, from: low, to: high)
            }
        }

        // The paper, grown out from its best-lit cells. Light fades gradually
        // across a sheet, so growing follows it into a shadow; a drawing is
        // suddenly darker or differently colored, so growing stops at it.
        let paperLum = luminance(paper)
        var cells = tops.map { top -> SIMD3<Float>? in
            luminance(top) >= paperSeedShare * paperLum && isTinted(top, like: paper) ? top : nil
        }
        var grew = true
        while grew {
            grew = false
            for index in cells.indices where cells[index] == nil {
                guard let beside = neighborMean(of: index, in: cells, columns: columns, rows: rows)
                else { continue }
                let top = tops[index], lum = luminance(top)
                if lum >= (1 - paperCellStep) * luminance(beside),
                   lum >= paperCellFloor * paperLum,
                   isTinted(top, like: paper) {
                    cells[index] = top
                    grew = true
                }
            }
        }

        return PageLight(paper: paper, ink: ink,
                         cells: smoothed(filled(cells, columns: columns, rows: rows) ?? [],
                                         columns: columns, rows: rows, fallback: paper),
                         columns: columns, rows: rows)
    }

    private static func isTinted(_ color: SIMD3<Float>, like other: SIMD3<Float>) -> Bool {
        let sum = color.sum(), otherSum = other.sum()
        guard sum > 0, otherSum > 0 else { return false }
        let tint = color / sum - other / otherSum
        return (tint * tint).sum().squareRoot() <= paperCellTint
    }

    /// The mean of the cells around `index` that have a value, if any do.
    private static func neighborMean(of index: Int, in cells: [SIMD3<Float>?],
                                     columns: Int, rows: Int) -> SIMD3<Float>? {
        let row = index / columns, column = index % columns
        var sum = SIMD3<Float>.zero, found: Float = 0
        for y in max(0, row - 1)...min(rows - 1, row + 1) {
            for x in max(0, column - 1)...min(columns - 1, column + 1) where y != row || x != column {
                guard let neighbor = cells[y * columns + x] else { continue }
                sum += neighbor
                found += 1
            }
        }
        return found > 0 ? sum / found : nil
    }

    /// Every cell without paper given the mean of its neighbors that have some,
    /// ring by ring outward from the paper. Nil when no cell has paper.
    private static func filled(_ cells: [SIMD3<Float>?], columns: Int, rows: Int) -> [SIMD3<Float>]? {
        guard cells.contains(where: { $0 != nil }) else { return nil }
        var current = cells
        while current.contains(where: { $0 == nil }) {
            var next = current
            for index in current.indices where current[index] == nil {
                next[index] = neighborMean(of: index, in: current, columns: columns, rows: rows)
            }
            current = next
        }
        return current.map { $0 ?? .zero }
    }

    /// A 3 × 3 average, so one odd cell cannot print a square onto the page.
    /// Every cell ends between `paperCellFloor` of the paper and the paper
    /// itself: nothing is lifted without limit, or darkened.
    private static func smoothed(_ cells: [SIMD3<Float>], columns: Int, rows: Int,
                                 fallback: SIMD3<Float>) -> [SIMD3<Float>] {
        guard cells.count == columns * rows else {
            return [SIMD3<Float>](repeating: fallback, count: columns * rows)
        }
        var result = cells
        for row in 0..<rows {
            for column in 0..<columns {
                var sum = SIMD3<Float>.zero, found: Float = 0
                for y in max(0, row - 1)...min(rows - 1, row + 1) {
                    for x in max(0, column - 1)...min(columns - 1, column + 1) {
                        sum += cells[y * columns + x]
                        found += 1
                    }
                }
                result[row * columns + column] = simd_clamp(sum / found, fallback * paperCellFloor, fallback)
            }
        }
        return result
    }

    private static func paperColor(_ colors: [SIMD3<Float>], _ lums: [Float],
                                   from low: Float, to high: Float) -> SIMD3<Float> {
        let band = colors.indices
            .filter { lums[$0] >= low && lums[$0] <= high }
            .map { colors[$0] }
            .sorted { saturation($0) < saturation($1) }
        let plain = band.prefix(max(1, band.count / 2))
        return plain.isEmpty ? .zero : plain.reduce(.zero, +) / Float(plain.count)
    }

    /// 0 for grey, 1 for a pure color.
    private static func saturation(_ color: SIMD3<Float>) -> Float {
        let high = color.max()
        return high > 0 ? (high - color.min()) / high : 0
    }

    private static func meanColor(_ colors: [SIMD3<Float>], _ lums: [Float],
                                  from low: Float, to high: Float) -> SIMD3<Float> {
        var sum = SIMD3<Float>.zero, found: Float = 0
        for index in colors.indices where lums[index] >= low && lums[index] <= high {
            sum += colors[index]
            found += 1
        }
        return found > 0 ? sum / found : .zero
    }

    static func luminance(_ color: SIMD3<Float>) -> Float {
        0.299 * color.x + 0.587 * color.y + 0.114 * color.z
    }

    // MARK: Correcting

    /// What each channel is multiplied by to bring `color` to `target`: never
    /// below 1, since a look only ever lifts, and never past `PageLook.maximumGain`.
    func gain(toward target: Float, from color: SIMD3<Float>) -> SIMD3<Float> {
        simd_clamp(SIMD3(repeating: target) / simd_max(color, SIMD3(repeating: 0.01)),
                   SIMD3(repeating: 1), SIMD3(repeating: PageLook.maximumGain))
    }

    /// The gain that brings each cell's paper to white, as an image covering
    /// `extent` whose pixels are the multipliers. Built at the cells' size,
    /// softened a little larger, then stretched over the photo, so it changes as
    /// gradually as light does.
    func gainMap(over extent: CGRect) -> CIImage {
        var floats: [Float] = []
        floats.reserveCapacity(cells.count * 4)
        for cell in cells {
            let gain = gain(toward: 1, from: cell)
            floats += [gain.x, gain.y, gain.z, 1]
        }
        let data = floats.withUnsafeBufferPointer { Data(buffer: $0) }
        let grid = CIImage(bitmapData: data,
                           bytesPerRow: columns * 4 * MemoryLayout<Float>.size,
                           size: CGSize(width: columns, height: rows),
                           format: .RGBAf,
                           colorSpace: nil)
        // Eight texels a cell, blurred by half a cell, then out to the photo.
        let upsample: CGFloat = 8
        let soft = grid.clampedToExtent()
            .transformed(by: CGAffineTransform(scaleX: upsample, y: upsample))
            .applyingGaussianBlur(sigma: upsample / 2)
            .cropped(to: CGRect(x: 0, y: 0, width: CGFloat(columns) * upsample,
                                height: CGFloat(rows) * upsample))
        return soft.clampedToExtent()
            .transformed(by: CGAffineTransform(scaleX: extent.width / soft.extent.width,
                                               y: extent.height / soft.extent.height)
                .concatenating(CGAffineTransform(translationX: extent.minX, y: extent.minY)))
            .cropped(to: extent)
    }
}

private func clamp(_ value: Float, _ low: Float, _ high: Float) -> Float {
    min(max(value, low), high)
}
