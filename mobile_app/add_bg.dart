import 'dart:io';
import 'package:image/image.dart' as img;

void main() {
  final file = File('assets/images/c2_logo.png');
  if (!file.existsSync()) {
    print('Error: file not found');
    return;
  }
  final original = img.decodeImage(file.readAsBytesSync())!;
  
  // Create a new image with a black background
  final bg = img.Image(width: original.width, height: original.height);
  img.fill(bg, color: img.ColorRgb8(0, 0, 0));
  
  // Draw the original image on top
  img.compositeImage(bg, original);
  
  File('assets/images/c2_logo_black.png').writeAsBytesSync(img.encodePng(bg));
  print('Done!');
}
