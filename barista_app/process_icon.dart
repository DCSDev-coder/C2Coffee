import 'dart:io';
import 'package:image/image.dart' as img;

void main() {
  final file = File('assets/images/c2 barista.png');
  final image = img.decodeImage(file.readAsBytesSync());
  if (image == null) return;
  
  int maxDim = image.width > image.height ? image.width : image.height;
  int size = maxDim + (maxDim * 0.1).toInt();
  
  final outImage = img.Image(width: size, height: size, format: img.Format.uint8, numChannels: 4);
  img.fill(outImage, color: img.ColorRgba8(255, 255, 255, 255));
  
  img.compositeImage(outImage, image, dstX: (size - image.width) ~/ 2, dstY: (size - image.height) ~/ 2);
  
  File('assets/images/app_icon_square.png').writeAsBytesSync(img.encodePng(outImage));
  print("Icon squared");
}
