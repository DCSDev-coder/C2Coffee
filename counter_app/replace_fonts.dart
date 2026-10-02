import 'dart:io';

void main() {
  final file = File('lib/main.dart');
  String content = file.readAsStringSync();

  final regex = RegExp(r'TextStyle\((.*?)\)', dotAll: true);

  content = content.replaceAllMapped(regex, (match) {
    String inner = match.group(1)!;
    if (inner.contains('fontFamily')) {
      return match.group(0)!;
    }

    if (inner.contains('fontSize: 2') ||
        inner.contains('fontSize: 3') ||
        inner.contains('fontWeight: FontWeight.bold') &&
            (inner.contains('fontSize: 18') ||
                inner.contains('fontSize: 20'))) {
      return "TextStyle(fontFamily: 'Recoleta', $inner)";
    } else {
      return "TextStyle(fontFamily: 'Afacad', $inner)";
    }
  });

  file.writeAsStringSync(content);
  stdout.writeln('Done replacing fonts in main.dart');
}
