import os
import re

screens_dir = 'lib/screens'
for filename in os.listdir(screens_dir):
    if filename.endswith('.dart'):
        filepath = os.path.join(screens_dir, filename)
        with open(filepath, 'r') as f:
            content = f.read()

        # We want to replace InteractiveFillingLoader.show(..., targetPage: X) with CustomBottomNav.switchTab(context, X)
        # It usually looks like: InteractiveFillingLoader.show(context, targetPage: const MenuPage());
        # Or multi-line.
        # Let's use a regex to match InteractiveFillingLoader.show(context, targetPage: X)
        # where X is everything up to the matching closing parenthesis.
        
        # A simpler way since the AST might be complex:
        # Just replace "InteractiveFillingLoader.show(context, targetPage:" with "CustomBottomNav.switchTab(context,"
        # and "InteractiveFillingLoader.show(\n        context,\n        targetPage:" with "CustomBottomNav.switchTab(context,"
        
        new_content = re.sub(r'InteractiveFillingLoader\.show\s*\(\s*context\s*,\s*targetPage\s*:', 'CustomBottomNav.switchTab(context,', content)
        
        if new_content != content:
            with open(filepath, 'w') as f:
                f.write(new_content)
            print(f"Updated {filepath}")
