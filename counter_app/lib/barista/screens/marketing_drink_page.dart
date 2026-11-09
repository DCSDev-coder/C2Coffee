import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../widgets/top_notice.dart';
import '../services/api_service.dart';
import '../services/direct_printer_service.dart';
import '../widgets/barista_page_header.dart';
import '../widgets/barista_card.dart';

class MarketingDrinkPage extends StatefulWidget {
  const MarketingDrinkPage({super.key});

  @override
  State<MarketingDrinkPage> createState() => _MarketingDrinkPageState();
}

class _MarketingDrinkPageState extends State<MarketingDrinkPage> {
  final _reason = TextEditingController();
  final _campaign = TextEditingController();
  final _pin = TextEditingController();
  final Map<int, int> _quantities = {};
  List<MarketingDrink> _drinks = const [];
  List<MarketingDrinkUsage> _usages = const [];
  List<BaristaAttendance> _activeBaristas = const [];
  int? _baristaId;
  String _purpose = 'sampling';
  bool _loading = true;
  bool _saving = false;

  static const _purposes = {
    'sampling': 'Customer sampling',
    'campaign': 'Marketing campaign',
    'content_production': 'Content production',
    'influencer': 'Influencer / creator',
    'goodwill': 'Customer goodwill',
    'other': 'Other approved use',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _reason.dispose();
    _campaign.dispose();
    _pin.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        ApiService.fetchMarketingDrinks(),
        ApiService.fetchTodayMarketingDrinkUsages(),
        ApiService.fetchAttendanceStatus(),
      ]);
      if (!mounted) return;
      final attendance = results[2] as BaristaAttendanceStatus;
      setState(() {
        _drinks = results[0] as List<MarketingDrink>;
        _usages = results[1] as List<MarketingDrinkUsage>;
        _activeBaristas = attendance.activeAttendance;
        _baristaId = _activeBaristas.any((item) => item.baristaId == _baristaId)
            ? _baristaId
            : (_activeBaristas.isEmpty
                  ? null
                  : _activeBaristas.first.baristaId);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
      TopNotice.error(
        context,
        'Unable to load complimentary drink records. Check the connection and try again.',
      );
    }
  }

  Future<void> _submit() async {
    final selected = Map<int, int>.fromEntries(
      _quantities.entries.where((entry) => entry.value > 0),
    );
    if (_baristaId == null ||
        selected.isEmpty ||
        _reason.text.trim().length < 3 ||
        _pin.text.length != 6) {
      TopNotice.error(
        context,
        'Select a clocked-in barista and drink, then enter the reason and 6-digit PIN.',
      );
      return;
    }
    setState(() => _saving = true);
    final result = await ApiService.recordMarketingDrinkUsage(
      baristaId: _baristaId!,
      pin: _pin.text,
      purposeCode: _purpose,
      reasonNote: _reason.text,
      campaignName: _campaign.text,
      quantities: selected,
    );
    if (!mounted) return;
    if (!result.isSuccess) {
      setState(() => _saving = false);
      TopNotice.error(context, result.errorMessage!);
      return;
    }
    final usage = MarketingDrinkUsage.fromCreated(result.data!);
    var printMessage = 'Usage recorded and inventory deducted.';
    try {
      final config = await DirectPrinterService.instance.loadConfig();
      if (config == null) {
        printMessage =
            'Usage recorded. Printer is not configured; use Reprint after setup.';
      } else {
        await DirectPrinterService.instance.printMarketingDrink(
          MarketingDrinkPrintSlip(
            config: config,
            usageRef: usage.usageRef,
            baristaName: usage.baristaName,
            purpose: _purposes[usage.purposeCode] ?? usage.purposeCode,
            reason: usage.reasonNote,
            campaignName: usage.campaignName,
            createdAt: usage.postedAt,
            items: usage.items
                .map(
                  (item) =>
                      DirectPrintItem(name: item.name, quantity: item.quantity),
                )
                .toList(),
          ),
        );
        printMessage = 'Usage recorded, inventory deducted, and slip printed.';
      }
    } catch (_) {
      printMessage =
          'Usage recorded, but printing failed. Use Reprint after checking the printer.';
    }
    if (!mounted) return;
    _reason.clear();
    _campaign.clear();
    _pin.clear();
    _quantities.clear();
    setState(() => _saving = false);
    TopNotice.info(context, printMessage);
    await _load();
  }

  Future<void> _reprint(MarketingDrinkUsage usage) async {
    try {
      final config = await DirectPrinterService.instance.loadConfig();
      if (config == null) throw StateError('Printer not configured');
      await DirectPrinterService.instance.printMarketingDrink(
        MarketingDrinkPrintSlip(
          config: config,
          usageRef: usage.usageRef,
          baristaName: usage.baristaName,
          purpose: _purposes[usage.purposeCode] ?? usage.purposeCode,
          reason: usage.reasonNote,
          campaignName: usage.campaignName,
          createdAt: usage.postedAt,
          items: usage.items
              .map(
                (item) =>
                    DirectPrintItem(name: item.name, quantity: item.quantity),
              )
              .toList(),
        ),
      );
      if (mounted) {
        TopNotice.info(context, 'Complimentary slip printed.');
      }
    } catch (_) {
      if (mounted) {
        TopNotice.error(
          context,
          'Unable to print. Check the Android tablet printer setup.',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    return Scaffold(
      backgroundColor: Colors.white,
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 36),
          children: [
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    BaristaPageHeader(
                      title: 'Marketing Drinks',
                      subtitle:
                          'Record approved marketing use, sampling, and campaign drinks.',
                      onRefresh: _load,
                      refreshTooltip: 'Refresh complimentary records',
                    ),
                    const SizedBox(height: 22),
                    const BaristaSectionLabel(label: 'RECORD MARKETING DRINK'),
                    const SizedBox(height: 12),
                    BaristaCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                      DropdownButtonFormField<int>(
                        initialValue: _baristaId,
                        decoration: const InputDecoration(
                          labelText: 'Clocked-in barista',
                          border: OutlineInputBorder(),
                        ),
                        items: _activeBaristas
                            .map(
                              (item) => DropdownMenuItem(
                                value: item.baristaId,
                                child: Text(item.baristaName),
                              ),
                            )
                            .toList(),
                        onChanged: (value) =>
                            setState(() => _baristaId = value),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: _purpose,
                        decoration: const InputDecoration(
                          labelText: 'Purpose',
                          border: OutlineInputBorder(),
                        ),
                        items: _purposes.entries
                            .map(
                              (entry) => DropdownMenuItem(
                                value: entry.key,
                                child: Text(entry.value),
                              ),
                            )
                            .toList(),
                        onChanged: (value) =>
                            setState(() => _purpose = value ?? 'other'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _campaign,
                        decoration: const InputDecoration(
                          labelText: 'Campaign / activity (optional)',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _reason,
                        maxLength: 500,
                        decoration: const InputDecoration(
                          labelText: 'Reason / approval reference',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Select drinks',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      ..._drinks.map((drink) {
                        final quantity = _quantities[drink.id] ?? 0;
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(drink.name),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                onPressed: quantity == 0
                                    ? null
                                    : () => setState(
                                        () => _quantities[drink.id] =
                                            quantity - 1,
                                      ),
                                icon: const Icon(Icons.remove_circle_outline),
                              ),
                              Text(
                                '$quantity',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              IconButton(
                                onPressed: quantity >= 20
                                    ? null
                                    : () => setState(
                                        () => _quantities[drink.id] =
                                            quantity + 1,
                                      ),
                                icon: const Icon(Icons.add_circle_outline),
                              ),
                            ],
                          ),
                        );
                      }),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _pin,
                        obscureText: true,
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(6),
                        ],
                        decoration: const InputDecoration(
                          labelText: 'Barista 6-digit PIN',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF203E32),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        onPressed: _saving ? null : _submit,
                        icon: const Icon(Icons.print),
                        label: Text(
                          _saving ? 'Recording…' : 'Record & print slip',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                const BaristaSectionLabel(label: "TODAY'S RECORDS"),
                const SizedBox(height: 12),
                if (_usages.isEmpty)
                  BaristaCard(
                    padding: const EdgeInsets.symmetric(
                      vertical: 36,
                      horizontal: 24,
                    ),
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.campaign_outlined,
                            size: 44,
                            color: const Color(
                              0xFF203E32,
                            ).withValues(alpha: 0.25),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'No complimentary drinks recorded today.',
                            style: TextStyle(
                              color: Color(0xFF203E32),
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  ..._usages.map(
                    (usage) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: BaristaCard(
                        child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(
                            '${usage.usageRef} · ${usage.items.map((item) => '${item.quantity}× ${item.name}').join(', ')}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                            ),
                          ),
                          subtitle: Text(
                            '${usage.baristaName} · ${_purposes[usage.purposeCode] ?? usage.purposeCode}\n${usage.reasonNote}',
                            style: TextStyle(
                              color: const Color(
                                0xFF203E32,
                              ).withValues(alpha: 0.65),
                              height: 1.4,
                            ),
                          ),
                          isThreeLine: true,
                          trailing: IconButton(
                            onPressed: usage.status == 'posted'
                                ? () => _reprint(usage)
                                : null,
                            icon: const Icon(Icons.print_outlined),
                            tooltip: 'Reprint slip',
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
  ),
);
  }
}
