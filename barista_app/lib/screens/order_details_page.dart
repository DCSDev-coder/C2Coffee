import 'package:flutter/material.dart';
import '../main.dart';
import '../widgets/order_card.dart';
import '../services/api_service.dart';
import '../widgets/blinking_online_indicator.dart';

class OrderDetailsPage extends StatelessWidget {
  final String orderId;
  final String customerDetails;
  final List<OrderItem> items;
  final bool isHistory;
  final VoidCallback? onSettingsTap;

  const OrderDetailsPage({
    super.key,
    required this.orderId,
    required this.customerDetails,
    required this.items,
    this.isHistory = false,
    this.onSettingsTap,
  });

  @override
  Widget build(BuildContext context) {
    const Color darkGreen = Color(0xFF304A3A);
    const Color beigeColor = Color(0xFFD3B17D);
    const Color buttonOrange = Color(0xFFDF7E65);

    return Scaffold(
      backgroundColor: Colors.white,
      body: isHistory
          ? _buildContent(context, null, darkGreen, beigeColor, buttonOrange)
          : ValueListenableBuilder<List<CurrentOrder>>(
              valueListenable: globalCurrentOrders,
              builder: (context, orders, _) {
                CurrentOrder? order;
                try {
                  order = orders.firstWhere((o) => o.orderId == orderId);
                } catch (e) {
                  order = null;
                }
                return _buildContent(
                  context,
                  order,
                  darkGreen,
                  beigeColor,
                  buttonOrange,
                );
              },
            ),
    );
  }

  Widget _buildContent(
    BuildContext context,
    CurrentOrder? order,
    Color darkGreen,
    Color beigeColor,
    Color buttonOrange,
  ) {
    final bool isPreparing = order != null
        ? order.status == OrderStatus.preparing
        : false;
    final bool isReady = order != null
        ? order.status == OrderStatus.readyForPickup
        : false;
    final bool isCompleted = isHistory || (order == null && !isHistory);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Dark Green Top Header
        Container(
          height: 110,
          padding: const EdgeInsets.only(top: 40, left: 24, right: 24),
          decoration: BoxDecoration(
            color: darkGreen,
            borderRadius: const BorderRadius.only(
              bottomLeft: Radius.circular(16.0),
              bottomRight: Radius.circular(16.0),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.1),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Row(
                children: [
                  Image.asset('assets/images/c2_logo.png', height: 40),
                ],
              ),
              const BlinkingOnlineIndicator(),
            ],
          ),
        ),

        Expanded(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 800),
              child: ListView(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24.0,
                  vertical: 24.0,
                ),
                children: [
                  // Header (Back button + Title)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      IconButton(
                        icon: Icon(
                          Icons.arrow_back,
                          color: darkGreen,
                          size: 32,
                        ),
                        onPressed: () => Navigator.of(context).pop(),
                        padding: EdgeInsets.zero,
                        alignment: Alignment.centerLeft,
                      ),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(right: 16.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              FittedBox(
                                fit: BoxFit.scaleDown,
                                alignment: Alignment.centerLeft,
                                child: Hero(
                                  tag: 'hero_order_id_$orderId',
                                  child: Material(
                                    color: Colors.transparent,
                                    child: Text(
                                      '#$orderId',
                                      maxLines: 1,
                                      style: TextStyle(
                                        color: darkGreen,
                                        fontSize: 32,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              FittedBox(
                                fit: BoxFit.scaleDown,
                                alignment: Alignment.centerLeft,
                                child: Hero(
                                  tag: 'hero_customer_$orderId',
                                  child: Material(
                                    color: Colors.transparent,
                                    child: Text(
                                      customerDetails,
                                      style: TextStyle(
                                        color: beigeColor,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w400,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 24.0),

                  // Status Tracker
                  Hero(
                    tag: 'hero_status_$orderId',
                    child: Material(
                      color: Colors.transparent,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          vertical: 20.0,
                          horizontal: 16.0,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border.all(color: darkGreen, width: 1.2),
                          borderRadius: BorderRadius.circular(20.0),
                        ),
                        child: SingleChildScrollView(
                          physics: const NeverScrollableScrollPhysics(),
                          child: Row(
                            children: [
                              _buildStatusNode(
                                title: 'Ordered',
                                icon: Icons.receipt_long,
                                isActive: true,
                                isCompleted: true,
                                color: darkGreen,
                              ),
                              (isPreparing || isReady || isCompleted)
                                  ? _buildConnector(
                                      isActive: true,
                                      color: darkGreen,
                                    )
                                  : _buildConnector(
                                      isActive: false,
                                      color: Colors.grey.shade300,
                                    ),
                              _buildStatusNode(
                                title: 'Preparing',
                                icon: Icons.coffee_maker,
                                isActive:
                                    (isPreparing || isReady || isCompleted),
                                isCompleted:
                                    (isPreparing || isReady || isCompleted),
                                color: (isPreparing || isReady || isCompleted)
                                    ? darkGreen
                                    : Colors.grey.shade300,
                              ),
                              (isReady || isCompleted)
                                  ? _buildConnector(
                                      isActive: true,
                                      color: darkGreen,
                                    )
                                  : (isPreparing)
                                  ? _buildAnimatedConnector(
                                      color: darkGreen,
                                      trackColor: Colors.grey.shade300,
                                    )
                                  : _buildConnector(
                                      isActive: false,
                                      color: Colors.grey.shade300,
                                    ),
                              _buildStatusNode(
                                title: 'Ready',
                                icon: Icons.check,
                                isActive: (isReady || isCompleted),
                                isCompleted: (isReady || isCompleted),
                                color: (isReady || isCompleted)
                                    ? darkGreen
                                    : Colors.grey.shade300,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 24.0),

                  // Items Box
                  Container(
                    padding: const EdgeInsets.all(24.0),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border.all(color: darkGreen, width: 1.2),
                      borderRadius: BorderRadius.circular(24.0),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'ITEMS',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: Colors.black,
                          ),
                        ),
                        const SizedBox(height: 16.0),
                        const Divider(height: 1, color: Colors.grey),
                        const SizedBox(height: 16.0),

                        ...items.asMap().entries.map((entry) {
                          int idx = entry.key;
                          OrderItem item = entry.value;
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.title,
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black,
                                ),
                              ),
                              const SizedBox(height: 8.0),
                              ...item.tags.map(
                                (tag) => Padding(
                                  padding: const EdgeInsets.only(
                                    left: 16.0,
                                    bottom: 4.0,
                                  ),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 4,
                                        height: 4,
                                        decoration: const BoxDecoration(
                                          color: Colors.grey,
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                      const SizedBox(width: 8.0),
                                      Text(
                                        tag,
                                        style: TextStyle(
                                          fontSize: 14,
                                          color: Colors.grey.shade600,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              if (idx < items.length - 1) ...[
                                const SizedBox(height: 16.0),
                                const Divider(height: 1, color: Colors.grey),
                                const SizedBox(height: 16.0),
                              ],
                            ],
                          );
                        }),

                        if (!isHistory && !isCompleted && !isReady) ...[
                          const SizedBox(height: 32.0),
                          _PreparationWorkspace(
                            order: order!,
                            items: items,
                            darkGreen: darkGreen,
                            beigeColor: beigeColor,
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStatusNode({
    required String title,
    required IconData icon,
    required bool isActive,
    required bool isCompleted,
    required Color color,
  }) {
    return Expanded(
      flex: 3,
      child: Column(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                child: Icon(icon, color: Colors.white, size: 24),
              ),
              if (isCompleted)
                Positioned(
                  bottom: -2,
                  right: -2,
                  child: Container(
                    padding: const EdgeInsets.all(2),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: Container(
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.check,
                        size: 12,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8.0),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: Colors.black,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildConnector({required bool isActive, required Color color}) {
    return Expanded(
      flex: 2,
      child: Container(
        margin: const EdgeInsets.only(bottom: 24.0), // offset for text
        height: 4,
        color: color,
      ),
    );
  }

  Widget _buildAnimatedConnector({
    required Color color,
    required Color trackColor,
  }) {
    return Expanded(
      flex: 2,
      child: Container(
        margin: const EdgeInsets.only(bottom: 24.0), // offset for text
        height: 4,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(2.0),
          child: LinearProgressIndicator(
            backgroundColor: trackColor,
            color: color,
          ),
        ),
      ),
    );
  }
}

class _PreparationWorkspace extends StatefulWidget {
  final CurrentOrder order;
  final List<OrderItem> items;
  final Color darkGreen;
  final Color beigeColor;
  const _PreparationWorkspace({
    required this.order,
    required this.items,
    required this.darkGreen,
    required this.beigeColor,
  });

  @override
  State<_PreparationWorkspace> createState() => _PreparationWorkspaceState();
}

class _PreparationWorkspaceState extends State<_PreparationWorkspace> {
  bool _submitting = false;
  late final Future<List<BaristaGuide>> _guides = ApiService.fetchGuides();

  Future<void> _changeStatus(String status) async {
    if (_submitting) return;
    setState(() => _submitting = true);
    final result = await ApiService.updateOrderStatus(
      widget.order.orderId,
      status,
    );
    if (!mounted) return;
    setState(() => _submitting = false);
    if (!result.isSuccess) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(result.errorMessage!)));
      return;
    }
    widget.order.status = status == 'preparing'
        ? OrderStatus.preparing
        : OrderStatus.readyForPickup;
    globalCurrentOrders.value = List.from(globalCurrentOrders.value);
    if (status == 'ready_for_pickup') Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final preparing = widget.order.status == OrderStatus.preparing;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (preparing)
          _GuidePanel(
            items: widget.items,
            guides: _guides,
            color: widget.darkGreen,
          ),
        if (preparing) const SizedBox(height: 16),
        SizedBox(
          height: 56,
          child: ElevatedButton.icon(
            onPressed: _submitting
                ? null
                : () => _changeStatus(
                    preparing ? 'ready_for_pickup' : 'preparing',
                  ),
            style: ElevatedButton.styleFrom(
              backgroundColor: preparing ? widget.beigeColor : widget.darkGreen,
              foregroundColor: preparing ? Colors.black : Colors.white,
              disabledBackgroundColor: Colors.grey.shade300,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            icon: _submitting
                ? const SizedBox.square(
                    dimension: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Icon(
                    preparing
                        ? Icons.check_circle_rounded
                        : Icons.play_circle_fill,
                    size: 28,
                  ),
            label: Text(
              _submitting
                  ? 'Updating...'
                  : preparing
                  ? 'Mark as Ready'
                  : 'Start Preparing',
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
          ),
        ),
      ],
    );
  }
}

class _GuidePanel extends StatelessWidget {
  final List<OrderItem> items;
  final Future<List<BaristaGuide>> guides;
  final Color color;
  const _GuidePanel({
    required this.items,
    required this.guides,
    required this.color,
  });

  @override
  Widget build(BuildContext context) => FutureBuilder<List<BaristaGuide>>(
    future: guides,
    builder: (context, snapshot) {
      final itemIds = items
          .map((item) => item.menuItemId)
          .whereType<int>()
          .toSet();
      final drinkGuides = (snapshot.data ?? const <BaristaGuide>[])
          .where(
            (guide) =>
                guide.type == 'drink' && itemIds.contains(guide.menuItemId),
          )
          .toList();
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.menu_book_outlined, color: color),
                const SizedBox(width: 8),
                Text(
                  'Preparation guide',
                  style: TextStyle(
                    color: color,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (snapshot.connectionState == ConnectionState.waiting)
              const LinearProgressIndicator()
            else if (drinkGuides.isEmpty || itemIds.isEmpty)
              const Text('No drink guide has been uploaded for this order yet.')
            else
              SizedBox(
                height: 190,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: drinkGuides.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 12),
                  itemBuilder: (_, index) {
                    final guide = drinkGuides[index];
                    final imageUrl = guide.imageUrl.startsWith('http')
                        ? guide.imageUrl
                        : '${ApiService.baseUrl}${guide.imageUrl}';
                    return SizedBox(
                      width: 142,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.network(
                                imageUrl,
                                width: double.infinity,
                                fit: BoxFit.cover,
                                errorBuilder: (_, _, _) => const ColoredBox(
                                  color: Color(0xFFE9E9E9),
                                  child: Center(
                                    child: Icon(Icons.broken_image_outlined),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            guide.menuItemName ?? 'Drink guide',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      );
    },
  );
}
