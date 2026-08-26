import 'dart:io';
import 'package:image/image.dart' as img;

void main() async {
  final inputPath = 'assets/images/app_icon_square.png';
  final outputPath = 'assets/images/app_icon_cropped.png';
  
  final bytes = await File(inputPath).readAsBytes();
  final image = img.decodeImage(bytes);
  
  if (image != null) {
    // Find bounding box of non-transparent and non-white pixels
    int minX = image.width;
    int minY = image.height;
    int maxX = 0;
    int maxY = 0;
    
    for (int y = 0; y < image.height; y++) {
      for (int x = 0; x < image.width; x++) {
        final pixel = image.getPixel(x, y);
        // Check if transparent OR white
        bool isTransparent = pixel.a == 0;
        bool isWhite = pixel.r > 240 && pixel.g > 240 && pixel.b > 240;
        
        if (!isTransparent && !isWhite) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    
    if (minX <= maxX && minY <= maxY) {
      final cropWidth = maxX - minX + 1;
      final cropHeight = maxY - minY + 1;
      
      // Increase padding significantly to ensure it fits well inside the squircle mask
      final padding = (cropWidth > cropHeight ? cropWidth : cropHeight) ~/ 1.8;
      
      final finalWidth = cropWidth + padding * 2;
      final finalHeight = cropHeight + padding * 2;
      
      final newImage = img.Image(width: finalWidth, height: finalHeight, numChannels: 4);
      // Fill with white background
      img.fill(newImage, color: img.ColorRgba8(255, 255, 255, 255));
      
      img.compositeImage(newImage, image, 
          srcX: minX, srcY: minY, srcW: cropWidth, srcH: cropHeight,
          dstX: padding, dstY: padding);
          
      await File(outputPath).writeAsBytes(img.encodePng(newImage));
      print('Successfully cropped white background and saved as $outputPath');
    } else {
      print('Image is fully white/transparent');
    }
  } else {
    print('Failed to load image');
  }
}
