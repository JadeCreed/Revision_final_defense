import json

with open('fixtures/data.json', 'r', encoding='utf-8-sig', errors='replace') as f:
    data = json.load(f)

with open('fixtures/data_fixed.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print('Done!')