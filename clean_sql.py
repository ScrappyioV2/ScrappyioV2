#!/usr/bin/env python3
"""
Clean SQL file by removing excessive whitespace while preserving SQL structure
"""

input_file = 'functions_export.sql'
output_file = 'functions_export_cleaned.sql'

with open(input_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove excessive whitespace at end of lines while preserving line breaks
lines = content.split('\n')
cleaned_lines = []

for line in lines:
    # Remove trailing whitespace but keep the line
    cleaned_line = line.rstrip()
    cleaned_lines.append(cleaned_line)

# Join lines back together
cleaned_content = '\n'.join(cleaned_lines)

# Write cleaned content
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(cleaned_content)

original_size = len(content)
cleaned_size = len(cleaned_content)
savings = original_size - cleaned_size

print(f"✅ Cleaned SQL file created: {output_file}")
print(f"📊 Original size: {original_size:,} bytes ({original_size/1024/1024:.2f} MB)")
print(f"📊 Cleaned size: {cleaned_size:,} bytes ({cleaned_size/1024:.2f} KB)")
print(f"💾 Space saved: {savings:,} bytes ({savings/original_size*100:.1f}% reduction)")
