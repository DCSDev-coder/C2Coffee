import re

with open('lib/main.dart', 'r', encoding='utf-8') as f:
    content = f.read()

clean_pos_view = """
    return Container(
      color: AppColors.surfaceLight,
      padding: const EdgeInsets.all(16.0),
      child: _isMenuLoading
          ? const Center(child: CircularProgressIndicator())
          : _menuItems.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_menuError ?? 'No menu items are available.'),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: _loadMenu,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Retry menu'),
                      ),
                    ],
                  ),
                )
              : GridView.builder(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 4,
                    childAspectRatio: 1.0,
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16,
                  ),
                  itemCount: _menuItems.length,
                  itemBuilder: (context, index) {
                    final item = _menuItems[index];
                    final itemId = item.id;
                    final price = item.priceRm;
                    return Card(
                      elevation: 4,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: InkWell(
                        onTap: () {
                          _addToCart(itemId);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('${item.name} added to basket'),
                              duration: const Duration(seconds: 1),
                            ),
                          );
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SizedBox(
                                height: 96,
                                width: double.infinity,
                                child: item.imageUrl == null
                                    ? const Icon(
                                        Icons.coffee,
                                        size: 48,
                                        color: AppColors.secondary,
                                      )
                                    : Image.network(
                                        item.imageUrl!,
                                        fit: BoxFit.contain,
                                        errorBuilder: (_, _, _) => const Icon(
                                          Icons.coffee,
                                          size: 48,
                                          color: AppColors.secondary,
                                        ),
                                        loadingBuilder: (context, child, loadingProgress) {
                                          if (loadingProgress == null) return child;
                                          return const Center(child: CircularProgressIndicator());
                                        },
                                      ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                item.name,
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'RM ${price.toStringAsFixed(2)}',
                                style: const TextStyle(
                                  color: AppColors.accent,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
"""

# Find the conflict markers and replace them
pattern = r'<<<<<<< HEAD.*?>>>>>>> [a-f0-9]+(?:\s*\}\s*,?\s*)+\s*\}\s*;'
pattern = r'<<<<<<< HEAD.*?\}\s*;\s*\}\s*,\s*\)\s*;\s*\}\s*,\s*\)\s*;\s*\}\s*\)\s*;\s*\}\s*\}\s*$'

pattern = r'<<<<<<< HEAD.*'
new_content = re.sub(pattern, clean_pos_view.strip(), content, flags=re.DOTALL)

with open('lib/main.dart', 'w', encoding='utf-8') as f:
    f.write(new_content)
