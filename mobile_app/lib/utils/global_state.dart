import 'package:flutter/foundation.dart';

/// Global state to manage the visibility of the Order Status Banner across all main tabs.
final ValueNotifier<bool> globalOrderStatusVisible = ValueNotifier<bool>(false);
final ValueNotifier<String?> globalOrderStatusRawStatus =
    ValueNotifier<String?>(null);
