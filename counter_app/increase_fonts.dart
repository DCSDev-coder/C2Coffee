import 'dart:io';

void increaseFonts(String path) {
  final file = File(path);
  if (!file.existsSync()) return;
  
  String content = file.readAsStringSync();
  
  // Only increase fontSize by 2. Wait, what if it's double?
  // fontSize: 16.0 -> fontSize: 18.0
  final regex = RegExp(r'fontSize:\s*([0-9]+\.?[0-9]*)');
  
  content = content.replaceAllMapped(regex, (match) {
    final sizeStr = match.group(1)!;
    final size = double.tryParse(sizeStr);
    if (size != null) {
      if (sizeStr.contains('.')) {
        return 'fontSize: ${(size + 2).toStringAsFixed(1)}';
      } else {
        return 'fontSize: ${(size + 2).toInt()}';
      }
    }
    return match.group(0)!;
  });

  file.writeAsStringSync(content);
  print('Done increasing fonts in $path');
}

void processDirectory(String dirPath) {
  final dir = Directory(dirPath);
  if (!dir.existsSync()) return;
  
  for (final entity in dir.listSync(recursive: true)) {
    if (entity is File && entity.path.endsWith('.dart')) {
      increaseFonts(entity.path);
    }
  }
}

void main() {
  processDirectory('lib');
  processDirectory('../mobile_app/lib');
}
