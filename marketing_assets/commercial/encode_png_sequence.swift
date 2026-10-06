import AVFoundation
import CoreImage
import Foundation

guard CommandLine.arguments.count >= 3 else {
    fputs("Usage: encode_png_sequence output.mp4 frames_directory\n", stderr)
    exit(2)
}

let outputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let framesURL = URL(fileURLWithPath: CommandLine.arguments[2])
let files = try FileManager.default.contentsOfDirectory(at: framesURL, includingPropertiesForKeys: nil)
    .filter { $0.pathExtension.lowercased() == "png" }
    .sorted { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }

guard !files.isEmpty else {
    fputs("No PNG frames found\n", stderr)
    exit(3)
}

try? FileManager.default.removeItem(at: outputURL)
let width = 1080
let height = 1920
let fps: Int32 = 30
let canvas = CGRect(x: 0, y: 0, width: width, height: height)
let context = CIContext(options: [.cacheIntermediates: false])
let colorSpace = CGColorSpaceCreateDeviceRGB()
let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 10_000_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoExpectedSourceFrameRateKey: fps
    ]
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
let attributes: [String: Any] = [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
    kCVPixelBufferIOSurfacePropertiesKey as String: [:]
]
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: attributes)
writer.add(input)
guard writer.startWriting() else { throw writer.error ?? NSError(domain: "encode", code: 1) }
writer.startSession(atSourceTime: .zero)

for (index, url) in files.enumerated() {
    while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.002) }
    guard let source = CIImage(contentsOf: url) else { continue }
    let fitted = source.transformed(by: CGAffineTransform(scaleX: CGFloat(width) / source.extent.width, y: CGFloat(height) / source.extent.height)).cropped(to: canvas)
    var pixelBuffer: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pixelBuffer)
    guard let buffer = pixelBuffer else { throw NSError(domain: "encode", code: 2) }
    context.render(fitted, to: buffer, bounds: canvas, colorSpace: colorSpace)
    let time = CMTime(value: CMTimeValue(index), timescale: fps)
    guard adaptor.append(buffer, withPresentationTime: time) else { throw writer.error ?? NSError(domain: "encode", code: 3) }
}

input.markAsFinished()
let semaphore = DispatchSemaphore(value: 0)
writer.finishWriting { semaphore.signal() }
semaphore.wait()
guard writer.status == .completed else { throw writer.error ?? NSError(domain: "encode", code: 4) }
print("Created \(outputURL.path) from \(files.count) frames")
