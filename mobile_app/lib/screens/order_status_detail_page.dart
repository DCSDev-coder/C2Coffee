import 'package:flutter/material.dart';
import 'dart:async';

class OrderStatusDetailPage extends StatefulWidget {
  const OrderStatusDetailPage({super.key});

  @override
  State<OrderStatusDetailPage> createState() => _OrderStatusDetailPageState();
}

class _OrderStatusDetailPageState extends State<OrderStatusDetailPage> {
  int _currentPhase = 0;
  Timer? _timer;

  final Color orangeColor = const Color(0xFF2E5E58);
  final Color bgColor = Colors.white;

  @override
  void initState() {
    super.initState();
    _startSimulation();
  }

  void _startSimulation() {
    // Start at Phase 0 (Received)
    _timer = Timer.periodic(const Duration(seconds: 4), (timer) {
      if (_currentPhase < 2) {
        setState(() {
          _currentPhase++;
        });
      } else {
        timer.cancel();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Widget _buildContent() {
    switch (_currentPhase) {
      case 0: // Received
        return _buildStateContent(
          timeEstimate: '1 - 2 MINUTES',
          imagePath: 'assets/images/status received.png',
          title: 'Order Received . . .',
          description:
              "We've successfully received your order and payment. Your selected barista will begin preparing your drink shortly.",
        );
      case 1: // Brewing
        return _buildStateContent(
          timeEstimate: '3 - 5 MINUTES',
          imagePath: 'assets/images/status brew.png',
          title: 'Brewing . . .',
          description:
              "Your drink is currently being handcrafted by our barista. We're making sure every cup is brewed to perfection.",
        );
      case 2: // Finished
      default:
        return _buildStateContent(
          timeEstimate: 'Finished',
          imagePath: 'assets/images/status bag.png',
          title: 'Ready for pickup!',
          description:
              "Great news! Your order is ready. Head over to the pickup counter and enjoy your freshly crafted beverage.",
        );
    }
  }

  Widget _buildStateContent({
    required String timeEstimate,
    required String imagePath,
    required String title,
    required String description,
  }) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 500),
      child: Container(
        key: ValueKey<String>(title),
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              timeEstimate,
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 32,
                fontWeight: FontWeight.bold,
                color: orangeColor,
              ),
            ),
            const SizedBox(height: 40),
            // Actual image from assets
            Center(
              child: Image.asset(
                imagePath,
                height: 250,
                width:
                    250, // Force square bounds to ensure consistent centering
                alignment: Alignment.center,
                fit: BoxFit.contain,
              ),
            ),
            const SizedBox(height: 50),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 32,
                fontWeight: FontWeight.bold,
                color: orangeColor,
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 80, // Fixed height to prevent layout jumps
              child: Text(
                description,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 18,
                  color: Colors.black87,
                  height: 1.4,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgColor,
      body: Column(
        children: [
          // Header
          Container(
            padding:
                const EdgeInsets.only(top: 50, bottom: 12, left: 20, right: 20),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(
                bottom: BorderSide(color: Color(0xFFEDF4F3), width: 1),
              ),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: const Icon(Icons.arrow_back_ios,
                        color: Color(0xFF2E5E58), size: 20),
                  ),
                ),
                const Text(
                  'ORDER STATUS',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF2E5E58),
                    letterSpacing: 1.0,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: LayoutBuilder(
              builder: (context, constraints) {
                return SingleChildScrollView(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: constraints.maxHeight,
                    ),
                    child: Align(
                      alignment: const Alignment(0, -1.0), // Shift even higher
                      child: Padding(
                        padding: const EdgeInsets.only(top: 40, bottom: 40),
                        child: _buildContent(),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
