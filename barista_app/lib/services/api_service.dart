import 'dart:convert';
import 'package:http/http.dart' as http;
import '../widgets/order_card.dart';

class ApiService {
  static const String baseUrl = 'https://api.c2coffeeandcandle.com/v1';
  static String? _accessToken;

  static Future<bool> updateOrderStatus(String orderId, String status) async {
    try {
      final response = await http.patch(
        Uri.parse('$baseUrl/admin/orders/$orderId/status'),
        headers: {
          'Content-Type': 'application/json',
          if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
        },
        body: json.encode({'status': status}),
      );
      return response.statusCode == 200;
    } catch (e) {
      print('Update Status Error: $e');
      return false;
    }
  }

  static Future<bool> login(String identifier, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/admin/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'tenant_code': 'c2coffee',
          'identifier': identifier,
          'password': password,
        }),
      );
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _accessToken = data['access_token'];
        return true;
      }
    } catch (e) {
      print('Login Error: $e');
    }
    return false;
  }

  static Future<List<CurrentOrder>> fetchOrders() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/admin/orders'),
        headers: _accessToken != null ? {'Authorization': 'Bearer $_accessToken'} : {},
      );

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
              
              List<String> tags = [];
              void addIfPresent(String? val, [String prefix = '', String suffix = '']) {
                if (val != null && val.trim().isNotEmpty) {
                  tags.add('$prefix$val$suffix');
                }
              }

              addIfPresent(item['bean']?.toString());
              addIfPresent(item['espressoShot']?.toString(), '', ' Shot');
              addIfPresent(item['temperature']?.toString());
              addIfPresent(item['sparkling']?.toString(), 'Sparkling: ');
              addIfPresent(item['milk']?.toString());
              addIfPresent(item['sweetness']?.toString());
              addIfPresent(item['iceLevel']?.toString());
              addIfPresent(item['orderType']?.toString());
              addIfPresent(item['remarks']?.toString(), 'Remarks: ');

              if (tags.isEmpty) {
                tags.add('Standard');
              }
              
              parsedItems.add(OrderItem(title: title, tags: tags));
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

  static Future<List<String>> fetchBaristas() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/admin/baristas'),
        headers: _accessToken != null ? {'Authorization': 'Bearer $_accessToken'} : {},
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final List<dynamic> baristasJson = data['baristas'] ?? [];
        List<String> baristas = [];
        for (var b in baristasJson) {
          if (b['is_active'] == 1 || b['is_active'] == true) {
            baristas.add(b['name'].toString());
          }
        }
        return baristas;
      }
    } catch (e) {
      print('Fetch Baristas Error: $e');
    }
    return [];
  }
}
