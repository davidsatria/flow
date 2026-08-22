
import re

def check_parens_balance(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    opens = content.count('(')
    closes = content.count(')')
    
    print(f"Total opens: {opens}")
    print(f"Total closes: {closes}")
    print(f"Difference: {opens - closes}")

if __name__ == "__main__":
    check_parens_balance(r"c:\Users\david\OneDrive\Documents\FLOW\FLOW 0.5.41\SYSTEM\templates\operator.html")
