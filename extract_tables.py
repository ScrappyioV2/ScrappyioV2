import os
import re
from pathlib import Path
from collections import defaultdict

# Paths to scan
project_root = r'c:\Users\Admin\Desktop\Project\scrappy-v2'
app_dir = os.path.join(project_root, 'app')

# Data structures
tables = set()
table_to_files = defaultdict(list)
api_routes = []

# Regex patterns
from_pattern_single = re.compile(r"\.from\('([^']+)'\)")
from_pattern_double = re.compile(r'\.from\("([^"]+)"\)')
from_pattern_template = re.compile(r'\.from\(`([^`]+)`\)')

def extract_tables_from_file(filepath):
    """Extract all table names from a TypeScript/TSX file"""
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            
            # Find all .from() calls
            matches = []
            matches.extend(from_pattern_single.findall(content))
            matches.extend(from_pattern_double.findall(content))
            
            # Handle template literals
            template_matches = from_pattern_template.findall(content)
            for match in template_matches:
                # Extract the base pattern
                # E.g., 'usa_seller_${id}_high_demand' -> 'usa_seller_*_high_demand'
                table_pattern = re.sub(r'\$\{[^}]+\}', '*', match)
                matches.append(table_pattern)
            
            return matches
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return []

def scan_directory(directory):
    """Recursively scan directory for all TS/TSX files"""
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                filepath = os.path.join(root, file)
                relative_path = os.path.relpath(filepath, project_root)
                
                # Check if it's an API route
                if 'route.ts' in file:
                    api_routes.append(relative_path)
                
                # Extract tables
                file_tables = extract_tables_from_file(filepath)
                for table in file_tables:
                    tables.add(table)
                    table_to_files[table].append(relative_path)

# Run the scan
print("Scanning project for database tables...")
scan_directory(app_dir)

# Output results
print(f"\n=== FOUND {len(tables)} UNIQUE TABLES ===\n")

# Sort tables by category
usa_tables = sorted([t for t in tables if t.startswith('usa')])
uk_tables = sorted([t for t in tables if t.startswith('uk')])
uae_tables = sorted([t for t in tables if t.startswith('uae')])
india_tables = sorted([t for t in tables if t.startswith('india')])
flipkart_tables = sorted([t for t in tables if 'flipkart' in t.lower() or t.startswith('fk_')])
jiomart_tables = sorted([t for t in tables if 'jio' in t.lower() or t.startswith('jm_')])
other_tables = sorted([t for t in tables if not any([
    t.startswith('usa'), t.startswith('uk'), t.startswith('uae'), 
    t.startswith('india'), 'flipkart' in t.lower(), 'jio' in t.lower(),
    t.startswith('fk_'), t.startswith('jm_')
])])

# Print categorized tables
print("=== USA SELLING TABLES ===")
for table in usa_tables:
    print(f"  - {table}")

print(f"\n=== UK SELLING TABLES ===")
for table in uk_tables:
    print(f"  - {table}")

print(f"\n=== UAE SELLING TABLES ===")
for table in uae_tables:
    print(f"  - {table}")

print(f"\n=== INDIA SELLING TABLES ===")
for table in india_tables:
    print(f"  - {table}")

print(f"\n=== FLIPKART TABLES ===")
for table in flipkart_tables:
    print(f" - {table}")

print(f"\n=== JIO MART TABLES ===")
for table in jiomart_tables:
    print(f"  - {table}")

print(f"\n=== OTHER TABLES ===")
for table in other_tables:
    print(f"  - {table}")

print(f"\n=== API ROUTES ({len(api_routes)}) ===")
for route in sorted(api_routes):
    print(f"  - {route}")

# Save to file
output_file = os.path.join(project_root, 'database_analysis.txt')
with open(output_file, 'w', encoding='utf-8') as f:
    f.write("=== DATABASE TABLES AND USAGE ===\n\n")
    
    for table in sorted(tables):
        f.write(f"\n### TABLE: {table}\n")
        f.write(f"Used in {len(table_to_files[table])} files:\n")
        for file in sorted(set(table_to_files[table])):
            f.write(f"  - {file}\n")

print(f"\n✅ Detailed analysis saved to: {output_file}")
