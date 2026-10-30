import 'package:flutter/material.dart';
import '../services/app_session_service.dart';
import 'home_page.dart';

class MaintenancePage extends StatefulWidget {
  const MaintenancePage({super.key});

  @override
  State<MaintenancePage> createState() => _MaintenancePageState();
}

class _MaintenancePageState extends State<MaintenancePage> {
  bool _retrying = false;

  Future<void> _retry() async {
    if (_retrying) return;
    setState(() => _retrying = true);
    try {
      await AppSessionService.instance.loadAuthenticatedState(force: true);
      if (!mounted) return;
      if (!AppSessionService.instance.maintenance.blocked) {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const HomePage()));
      }
    } catch (_) {
      // Keep the maintenance screen visible when the service is unavailable.
    } finally {
      if (mounted) setState(() => _retrying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final maintenance = AppSessionService.instance.maintenance;
    final end = maintenance.expectedEndAt;
    return Scaffold(
      backgroundColor: const Color(0xFF8F2A08),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.coffee_rounded, color: Colors.white, size: 72),
                const SizedBox(height: 24),
                Text(maintenance.title, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800)),
                const SizedBox(height: 14),
                Text(maintenance.message, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70, fontSize: 17, height: 1.4)),
                if (end != null) ...[
                  const SizedBox(height: 14),
                  Text('Expected back by ${MaterialLocalizations.of(context).formatFullDate(end)}', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                ],
                const SizedBox(height: 28),
                OutlinedButton(onPressed: _retrying ? null : _retry, child: Text(_retrying ? 'Checking...' : 'Try again')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
