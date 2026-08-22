
def check_parens(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    open_p = content.count('(')
    close_p = content.count(')')
    
    print(f"File: {file_path}")
    print(f"Total (: {open_p}")
    print(f"Total ): {close_p}")
    print(f"Difference: {open_p - close_p}")

if __name__ == "__main__":
    check_parens(r"SYSTEM/templates/operator.html")
