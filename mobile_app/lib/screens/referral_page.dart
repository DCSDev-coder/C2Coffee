import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../services/customer_data_service.dart';
import '../services/secure_session_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_notification.dart';
import 'loading_order_page.dart';
import '../widgets/app_page_shell.dart';

class ReferralPage extends StatefulWidget {
  const ReferralPage({super.key});

  @override
  State<ReferralPage> createState() => _ReferralPageState();
}

class _ReferralPageState extends State<ReferralPage> {
  bool _isLoading = true;
  String? _error;
  ReferralSnapshot? _snapshot;

  final TextEditingController _claimCodeController = TextEditingController();
  bool _isClaiming = false;
  String? _claimError;

  @override
  void initState() {
    super.initState();
    _loadReferralData();
  }

  @override
  void dispose() {
    _claimCodeController.dispose();
    super.dispose();
  }

  Future<void> _loadReferralData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw Exception('Missing access token.');
      }

      final snapshot = await CustomerDataService.instance.getReferralInfo(
        accessToken: accessToken,
      );

      if (mounted) {
        setState(() {
          _snapshot = snapshot;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        final msg = e
            .toString()
            .replaceFirst('Exception: ', '')
            .replaceFirst('ApiException: ', '');
        setState(() {
          _error = msg.isNotEmpty ? msg : 'Unable to load referral info.';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _handleClaimCode() async {
    final code = _claimCodeController.text.trim();
    if (code.isEmpty || _isClaiming) return;

    setState(() {
      _isClaiming = true;
      _claimError = null;
    });

    try {
      final accessToken = await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw Exception('Missing access token.');
      }

      await CustomerDataService.instance.claimReferralCode(
        accessToken: accessToken,
        code: code,
      );

      _claimCodeController.clear();
      await _loadReferralData();

      if (!mounted) return;
      AppNotification.showSuccess(
        context,
        'Referral code claimed successfully!',
      );
    } catch (e) {
      if (!mounted) return;
      final msg = e
          .toString()
          .replaceFirst('Exception: ', '')
          .replaceFirst('ApiException: ', '');
      setState(() {
        _claimError = msg;
      });
      AppNotification.showError(context, msg);
    } finally {
      if (mounted) {
        setState(() {
          _isClaiming = false;
        });
      }
    }
  }

  void _copyCode(String code) {
    Clipboard.setData(ClipboardData(text: code));
    AppNotification.showSuccess(
      context,
      'Code $code copied to clipboard!',
      icon: Icons.copy_rounded,
    );
  }

  Future<void> _shareCode(String code) async {
    await Share.share(
      'Join C2 Coffee and enter my referral code $code before your first order. Once you collect your first order, I receive a reward.',
      subject: 'Join me at C2 Coffee',
    );
  }

  @override
  Widget build(BuildContext context) {
    final Color brandColor = AppColors.deepTeal;
    final Color cardBgColor = AppColors.surfaceLight;
    final referralCode = _snapshot?.referralCode ?? '';

    return PopScope(
      canPop: true,
      child: AppPageShell(
        title: 'REFER A FRIEND',
        onBack: () => InteractiveFillingLoader.showPop(context),
        backgroundColor: Colors.white,
        onRefresh: _loadReferralData,
        bodyPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: _isLoading
            ? SizedBox(
                height: MediaQuery.of(context).size.height * 0.6,
                child: const Center(child: CircularProgressIndicator()),
              )
            : _error != null && _snapshot == null
                ? SizedBox(
                    height: MediaQuery.of(context).size.height * 0.6,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              _error!,
                              style: const TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 15,
                                color: Colors.black54,
                              ),
                            ),
                            const SizedBox(height: 12),
                            ElevatedButton(
                              onPressed: _loadReferralData,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: brandColor,
                              ),
                              child: const Text('RETRY',
                                  style: TextStyle(color: Colors.white)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                : Column(
                              children: [
                                // Invite A Friend Card
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(24),
                                  decoration: BoxDecoration(
                                    color: cardBgColor,
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                        color: AppColors.border, width: 1),
                                  ),
                                  child: Column(
                                    children: [
                                      Icon(
                                        Icons.group_add_outlined,
                                        size: 80,
                                        color: brandColor,
                                      ),
                                      const SizedBox(height: 16),
                                      Text(
                                        'INVITE A FRIEND',
                                        style: TextStyle(
                                          fontFamily: 'Recoleta',
                                          fontSize: 30,
                                          fontWeight: FontWeight.w900,
                                          color: brandColor,
                                          letterSpacing: 1.5,
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      RichText(
                                        textAlign: TextAlign.center,
                                        text: TextSpan(
                                          style: TextStyle(
                                            fontFamily: 'Afacad',
                                            fontSize: 15,
                                            color: brandColor,
                                            fontWeight: FontWeight.w500,
                                          ),
                                          children: [
                                            const TextSpan(text: 'When your friend collects their first order, you receive '),
                                            TextSpan(
                                              text: '1 Free Drink Voucher 🔥',
                                              style: TextStyle(
                                                color: AppColors.gold,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                            const TextSpan(
                                                text:
                                                    '.'),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(height: 16),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 24),

                                // Unique Code Card
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(20),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(
                                        color: AppColors.border, width: 1),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black
                                            .withValues(alpha: 0.03),
                                        blurRadius: 8,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: Column(
                                    children: [
                                      Text(
                                        'YOUR UNIQUE CODE',
                                        style: TextStyle(
                                          fontFamily: 'Recoleta',
                                          fontSize: 18,
                                          fontWeight: FontWeight.w900,
                                          color: brandColor,
                                        ),
                                      ),
                                      const SizedBox(height: 12),
                                      InkWell(
                                        onTap: () => _shareCode(referralCode),
                                        borderRadius: BorderRadius.circular(8),
                                        child: Container(
                                          width: double.infinity,
                                          padding: const EdgeInsets.symmetric(
                                              vertical: 12),
                                          decoration: BoxDecoration(
                                            color: AppColors.surfaceLight,
                                            borderRadius:
                                                BorderRadius.circular(8),
                                            border: Border.all(
                                                color: AppColors.border),
                                          ),
                                          alignment: Alignment.center,
                                          child: Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            children: [
                                              Text(
                                                referralCode,
                                                style: TextStyle(
                                                  fontFamily: 'Afacad',
                                                  fontSize: 24,
                                                  fontWeight: FontWeight.bold,
                                                  color: brandColor,
                                                  letterSpacing: 2,
                                                ),
                                              ),
                                              const SizedBox(width: 8),
                                              Icon(Icons.copy,
                                                  size: 18, color: brandColor),
                                            ],
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 12),
                                      GestureDetector(
                                        onTap: () => _copyCode(referralCode),
                                        child: Container(
                                          width: double.infinity,
                                          padding: const EdgeInsets.symmetric(
                                              vertical: 12),
                                          decoration: BoxDecoration(
                                            color: brandColor,
                                            borderRadius:
                                                BorderRadius.circular(8),
                                          ),
                                          child: const Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            children: [
                                              Icon(Icons.ios_share,
                                                  color: Colors.white,
                                                  size: 20),
                                              SizedBox(width: 8),
                                              Text(
                                                'Share Code',
                                                style: TextStyle(
                                                  fontFamily: 'Afacad',
                                                  fontSize: 18,
                                                  fontWeight: FontWeight.bold,
                                                  color: Colors.white,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 24),

                                // Claim Friend's Referral Code Card
                                _buildClaimFriendCodeCard(brandColor),
                                const SizedBox(height: 24),

                                // How It Works Divider
                                Row(
                                  children: [
                                    Expanded(
                                        child: Divider(
                                            color: AppColors.border,
                                            thickness: 1)),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 12),
                                      child: Text(
                                        'How It Works',
                                        style: TextStyle(
                                          fontFamily: 'Recoleta',
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                          color: brandColor,
                                        ),
                                      ),
                                    ),
                                    Expanded(
                                        child: Divider(
                                            color: AppColors.border,
                                            thickness: 1)),
                                  ],
                                ),
                                const SizedBox(height: 24),

                                // Steps Card
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(20),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(
                                        color: AppColors.border, width: 1),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black
                                            .withValues(alpha: 0.03),
                                        blurRadius: 8,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: _buildHorizontalSteps(brandColor),
                                ),
                                const SizedBox(height: 32),

                                // My Achievements Divider
                                Row(
                                  children: [
                                    Expanded(
                                        child: Divider(
                                            color: AppColors.border,
                                            thickness: 1)),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 12),
                                      child: Text(
                                        'My Achievements',
                                        style: TextStyle(
                                          fontFamily: 'Recoleta',
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                          color: brandColor,
                                        ),
                                      ),
                                    ),
                                    Expanded(
                                        child: Divider(
                                            color: AppColors.border,
                                            thickness: 1)),
                                  ],
                                ),
                                const SizedBox(height: 24),

                                // Achievements Card
                                Container(
                                  width: double.infinity,
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 24),
                                  decoration: BoxDecoration(
                                    color: brandColor,
                                    borderRadius: BorderRadius.circular(16),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black
                                            .withValues(alpha: 0.05),
                                        blurRadius: 8,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Column(
                                          children: [
                                            const Text(
                                              'Friends Invited',
                                              style: TextStyle(
                                                fontFamily: 'Recoleta',
                                                fontSize: 16,
                                                fontWeight: FontWeight.bold,
                                                color: Colors.white,
                                              ),
                                            ),
                                            const SizedBox(height: 8),
                                            Text(
                                              '${_snapshot?.friendsInvited ?? 0}',
                                              style: const TextStyle(
                                                fontFamily: 'Afacad',
                                                fontSize: 44,
                                                fontWeight: FontWeight.bold,
                                                color: Colors.white,
                                                height: 1.0,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Container(
                                        width: 1.5,
                                        height: 70,
                                        color: Colors.white
                                            .withValues(alpha: 0.3),
                                      ),
                                      Expanded(
                                        child: Column(
                                          children: [
                                            const Text(
                                              'Rewards Earned',
                                              style: TextStyle(
                                                fontFamily: 'Recoleta',
                                                fontSize: 16,
                                                fontWeight: FontWeight.bold,
                                                color: Colors.white,
                                              ),
                                            ),
                                            const SizedBox(height: 8),
                                            Text(
                                              '${_snapshot?.rewardsClaimed ?? 0}',
                                              style: TextStyle(
                                                fontFamily: 'Afacad',
                                                fontSize: 44,
                                                fontWeight: FontWeight.bold,
                                                color: AppColors.gold,
                                                height: 1.0,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 40),
                              ],
                            ),
          ),
        );
  }

  Widget _buildClaimFriendCodeCard(Color brandColor) {
    final hasClaimed = _snapshot?.hasClaimedReferrer ?? false;
    final isEligible = _snapshot?.isEligibleToClaim ?? true;

    if (hasClaimed) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.green.shade50,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.green.shade200),
        ),
        child: Row(
          children: [
            Icon(Icons.verified, color: Colors.green.shade700, size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Referred by a friend',
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Colors.green.shade900,
                    ),
                  ),
                  Text(
                    'Code: ${_snapshot?.claimedCode ?? 'Claimed'}',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 13,
                      color: Colors.green.shade800,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (!isEligible) {
      return const SizedBox.shrink();
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'HAVE A FRIEND\'S CODE?',
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: brandColor,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Enter your friend\'s referral code to link accounts.',
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 13,
              color: Colors.black54,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _claimCodeController,
                  textCapitalization: TextCapitalization.characters,
                  decoration: InputDecoration(
                    hintText: 'e.g. C2-0101',
                    hintStyle: const TextStyle(
                      fontFamily: 'Afacad',
                      color: Colors.black38,
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    filled: true,
                    fillColor: AppColors.surfaceLight,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: AppColors.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: brandColor, width: 1.5),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              ElevatedButton(
                onPressed: _isClaiming ? null : _handleClaimCode,
                style: ElevatedButton.styleFrom(
                  backgroundColor: brandColor,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  elevation: 0,
                ),
                child: _isClaiming
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text(
                        'CLAIM',
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          fontSize: 14,
                        ),
                      ),
              ),
            ],
          ),
          if (_claimError != null) ...[
            const SizedBox(height: 8),
            Text(
              _claimError!,
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 12,
                color: Colors.red.shade700,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildHorizontalSteps(Color brandColor) {
    return Column(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHorizontalStepItem(1, Icons.group_add_outlined, "Invite your\nfriends to\nsign up", brandColor),
            Expanded(child: _buildDashedLine(brandColor)),
            _buildHorizontalStepItem(2, Icons.card_giftcard, "Your friends\nget a product\nfrom us", brandColor),
            Expanded(child: _buildDashedLine(brandColor)),
            _buildHorizontalStepItem(3, Icons.stars, "You and your\nfriends get\nrewarded", brandColor),
          ],
        ),
        const SizedBox(height: 16),
        Text(
          'Your referral reward is set by C2 Coffee.',
          style: TextStyle(
            fontFamily: 'Afacad',
            fontSize: 13,
            color: brandColor,
            fontWeight: FontWeight.w600,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildHorizontalStepItem(int stepNumber, IconData icon, String text, Color brandColor) {
    return SizedBox(
      width: 90,
      child: Column(
        children: [
          Stack(
            alignment: Alignment.topLeft,
            children: [
              Container(
                margin: const EdgeInsets.all(4),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: brandColor, width: 1.5),
                  color: Colors.white,
                ),
                child: Icon(icon, color: brandColor, size: 28),
              ),
              Container(
                padding: const EdgeInsets.all(5),
                decoration: BoxDecoration(
                  color: Colors.pinkAccent,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  stepNumber.toString(),
                  style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            text,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 12,
              color: Colors.black87,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDashedLine(Color brandColor) {
    return Padding(
      padding: const EdgeInsets.only(top: 28),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final boxWidth = constraints.constrainWidth();
          const dashWidth = 4.0;
          const dashSpace = 4.0;
          final dashCount = (boxWidth / (dashWidth + dashSpace)).floor();
          return Flex(
            direction: Axis.horizontal,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(dashCount, (_) {
              return SizedBox(
                width: dashWidth,
                height: 1.5,
                child: DecoratedBox(decoration: BoxDecoration(color: brandColor.withValues(alpha: 0.3))),
              );
            }),
          );
        },
      ),
    );
  }
}
