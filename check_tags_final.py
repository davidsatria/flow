
import os

def check_tags(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    div_open = content.count('<div')
    div_close = content.count('</div')
    
    print(f"File: {file_path}")
    print(f"Total <div: {div_open}")
    print(f"Total </div: {div_close}")
    print(f"Difference: {div_open - div_close}")

if __name__ == "__main__":
    check_tags(r"SYSTEM/templates/operator.html")
