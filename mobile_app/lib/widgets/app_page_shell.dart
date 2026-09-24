import 'package:flutter/material.dart';
import '../utils/app_colors.dart';

class AppPageShell extends StatelessWidget {
  final String title;
  final Widget child;
  final VoidCallback onBack;
  final Color? backgroundColor;
  final Color? headerColor;
  final EdgeInsetsGeometry? bodyPadding;
  final EdgeInsetsGeometry? headerPadding;
  final Widget? titleWidget;
  final Widget? customHeader;
  final Widget? trailing;
  final bool showBackButton;
  final Widget? bottomNavigationBar;
  final bool extendBody;
  final ScrollController? scrollController;
  final Widget? overlay;
  final Future<void> Function()? onRefresh;
  final Widget? endDrawer;
  final void Function(bool)? onEndDrawerChanged;
  final GlobalKey<ScaffoldState>? scaffoldKey;
  final bool scrollable;

  const AppPageShell({
    super.key,
    required this.title,
    required this.child,
    required this.onBack,
    this.backgroundColor,
    this.headerColor,
    this.bodyPadding,
    this.headerPadding,
    this.titleWidget,
    this.customHeader,
    this.trailing,
    this.showBackButton = true,
    this.bottomNavigationBar,
    this.extendBody = false,
    this.scrollController,
    this.overlay,
    this.onRefresh,
    this.endDrawer,
    this.onEndDrawerChanged,
    this.scaffoldKey,
    this.scrollable = true,
  });

  @override
  Widget build(BuildContext context) {
    final mediaQuery = MediaQuery.paddingOf(context);
    final effectiveBodyPadding = bodyPadding ??
        EdgeInsets.fromLTRB(
          20,
          20,
          20,
          mediaQuery.bottom + 28,
        );
    final effectiveHeaderColor = headerColor ?? AppColors.deepTeal;
    final effectiveHeaderPadding = headerPadding ??
        EdgeInsets.only(
          top: mediaQuery.top + 14,
          bottom: 16,
          left: 20,
          right: 20,
        );

    final Widget bodyColumn = Column(
      children: [
        Container(
          width: double.infinity,
          padding: effectiveHeaderPadding,
          decoration: BoxDecoration(
            color: effectiveHeaderColor,
          ),
          child: SizedBox(
            height: 48,
            child: customHeader ??
                Stack(
                  alignment: Alignment.center,
                  children: [
                    if (showBackButton)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: GestureDetector(
                          onTap: onBack,
                          child: const Icon(
                            Icons.arrow_back_ios,
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                      ),
                    Center(
                      child: titleWidget ??
                          Text(
                            title,
                            style: const TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              letterSpacing: 1.0,
                            ),
                          ),
                    ),
                    if (trailing != null)
                      Align(
                        alignment: Alignment.centerRight,
                        child: trailing!,
                      ),
                  ],
                ),
          ),
        ),
        Expanded(
          child: SafeArea(
            top: false,
            bottom: false,
            child: !scrollable
                ? Padding(padding: effectiveBodyPadding, child: child)
                : onRefresh != null
                    ? RefreshIndicator(
                        onRefresh: onRefresh!,
                        child: SingleChildScrollView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          controller: scrollController,
                          keyboardDismissBehavior:
                              ScrollViewKeyboardDismissBehavior.onDrag,
                          padding: effectiveBodyPadding,
                          child: child,
                        ),
                      )
                    : SingleChildScrollView(
                        controller: scrollController,
                        keyboardDismissBehavior:
                            ScrollViewKeyboardDismissBehavior.onDrag,
                        padding: effectiveBodyPadding,
                        child: child,
                      ),
          ),
        ),
      ],
    );

    return _EdgeSwipeBack(
      onBack: onBack,
      child: Scaffold(
        key: scaffoldKey,
        backgroundColor: backgroundColor ?? AppColors.background,
        extendBody: extendBody,
        bottomNavigationBar: bottomNavigationBar,
        endDrawer: endDrawer,
        onEndDrawerChanged: onEndDrawerChanged,
        body: overlay != null
            ? Stack(
                children: [bodyColumn, overlay!],
              )
            : bodyColumn,
      ),
    );
  }
}

class _EdgeSwipeBack extends StatefulWidget {
  final Widget child;
  final VoidCallback onBack;

  const _EdgeSwipeBack({required this.child, required this.onBack});

  @override
  State<_EdgeSwipeBack> createState() => _EdgeSwipeBackState();
}

class _EdgeSwipeBackState extends State<_EdgeSwipeBack> {
  static const _edgeWidth = 28.0;
  static const _minimumSwipeDistance = 72.0;
  double? _startX;
  double _dragDistance = 0;

  bool get _canPop => Navigator.of(context).canPop();

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (event) {
        _startX = event.position.dx;
        _dragDistance = 0;
      },
      onPointerCancel: (_) {
        _startX = null;
        _dragDistance = 0;
      },
      child: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onHorizontalDragUpdate: (details) {
          if (_startX == null || _startX! > _edgeWidth || !_canPop) return;
          if (details.delta.dx > 0) _dragDistance += details.delta.dx;
        },
        onHorizontalDragEnd: (details) {
          final shouldPop = _startX != null &&
              _startX! <= _edgeWidth &&
              _canPop &&
              (_dragDistance >= _minimumSwipeDistance ||
                  (details.primaryVelocity ?? 0) > 700);
          _startX = null;
          _dragDistance = 0;
          if (shouldPop) widget.onBack();
        },
        child: widget.child,
      ),
    );
  }
}
