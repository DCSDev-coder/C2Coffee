import 'dart:convert';
import 'package:http/http.dart' as http;
import '../widgets/order_card.dart';

class ApiService {
  // Use the local IP address found via ipconfig
  static const String baseUrl = 'http://192.168.1.249:3000/v1';

  static Future<List<CurrentOrder>> fetchOrders() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/admin/orders'));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final List<dynamic> ordersJson = data['orders'] ?? [];

        return ordersJson.map((json) {
          // Parse status
          OrderStatus parsedStatus = OrderStatus.newOrder;
          final statusStr = (json['status'] as String?)?.toLowerCase() ?? '';
          if (statusStr.contains('preparing')) {
            parsedStatus = OrderStatus.preparing;
          } else if (statusStr.contains('ready')) {
            parsedStatus = OrderStatus.readyForPickup;
          } else if (statusStr.contains('completed')) {
            parsedStatus = OrderStatus.completed;
          }

          // Parse items
          List<OrderItem> parsedItems = [];
          if (json['items'] != null) {
            for (var item in json['items']) {
              final title = '${item['qty']}x ${item['name']}';
              // Default to some empty tags since API doesn't provide them
              parsedItems.add(OrderItem(title: title, tags: ['Standard']));
            }
          }

          // Fallbacks for date
          final dateStr = json['date'] ?? 'Aug 19, 2026';
          final timeStr = json['time'] ?? '10:00 AM';

          return CurrentOrder(
            status: parsedStatus,
            orderId: json['id'] ?? 'ORD-000',
            timeDate: '$timeStr - $dateStr',
            orderDate: DateTime.now(), // Fallback for sorting if needed
            customerDetails: '${json['customer'] ?? 'guest'} - ${parsedItems.length} items',
            items: parsedItems,
          );
        }).toList();
      } else {
        throw Exception('Failed to load orders: ${response.statusCode}');
      }
    } catch (e) {
      print('API Error: $e');
      return []; // Return empty list on failure to not break UI immediately
    }
  }
}
