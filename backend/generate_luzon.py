import json
import os

# Alamin ang lokasyon ng kasalukuyang script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Input file path (buong Pilipinas)
INPUT_FILE = os.path.join(BASE_DIR, 'address.json')

# Awtomatikong target path sa iyong frontend folder
OUTPUT_DIR = os.path.join(BASE_DIR, '..', 'frontend', 'src', 'data')
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'luzon_formatted.json')

# Mapping para sa mga rehiyon ng Luzon
region_mapping = {
    "01": "Region I (Ilocos Region)",
    "02": "Region II (Cagayan Valley)",
    "03": "Region III (Central Luzon)",
    "4A": "Region IV-A (CALABARZON)",
    "04": "Region IV-A (CALABARZON)",
    "4B": "MIMAROPA Region",
    "17": "MIMAROPA Region",
    "05": "Region V (Bicol Region)",
    "CAR": "CAR (Cordillera Administrative Region)",
    "14": "CAR (Cordillera Administrative Region)",
    "NCR": "NCR (National Capital Region)",
    "13": "NCR (National Capital Region)"
}

def clean_text(text):
    """Ginagawang maayos na Title Case ang teksto habang pinapanatili ang acronyms"""
    if not text:
        return ""
    # Panatilihing UPPERCASE ang acronym-only province/region names (e.g. "NCR")
    if text.strip().upper() in ["NCR", "CAR"]:
        return text.strip().upper()
    words = text.strip().split()
    cleaned_words = []
    for word in words:
        if word.upper() in ["BGY.", "BRY.", "NO.", "I", "II", "III", "IV", "V"]:
            cleaned_words.append(word.upper())
        else:
            cleaned_words.append(word.capitalize())
    return " ".join(cleaned_words)

def process_address():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: Hindi nahanap ang '{INPUT_FILE}'.")
        print("Siguraduhing inilagay mo ang iyong buong 'address.json' sa 'Backend/backend/' folder.")
        return

    print("Binabasa ang orihinal na address.json...")
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        original_data = json.load(f)

    # Mga bucket na keyed by FINAL region/province name, para mag-MERGE
    # ang data kapag may parehong region/province na naka-store sa
    # magkaibang source key sa orihinal na address.json (e.g. "05" at "5"
    # parehong Bicol Region) — dati, gumagawa ito ng duplicate entries
    # dahil sa list lang basta nag-aappend, walang dedupe.
    region_buckets = {}  # matched_region_name -> { province_clean -> { muni_clean -> barangay_list } }

    for reg_code, reg_data in original_data.items():
        reg_name_upper = reg_data.get("region_name", "").upper()

        matched_region_name = None
        for code, preferred_name in region_mapping.items():
            if reg_code == code or code in reg_name_upper:
                matched_region_name = preferred_name
                break

        if not matched_region_name:
            if "ILOCOS" in reg_name_upper:
                matched_region_name = "Region I (Ilocos Region)"
            elif "CAGAYAN" in reg_name_upper:
                matched_region_name = "Region II (Cagayan Valley)"
            elif "CENTRAL LUZON" in reg_name_upper:
                matched_region_name = "Region III (Central Luzon)"
            elif "CALABARZON" in reg_name_upper:
                matched_region_name = "Region IV-A (CALABARZON)"
            elif "MIMAROPA" in reg_name_upper or "IV-B" in reg_name_upper:
                matched_region_name = "MIMAROPA Region"
            elif "REGION V" in reg_name_upper or "BICOL" in reg_name_upper:
                matched_region_name = "Region V (Bicol Region)"
            elif "CORDILLERA" in reg_name_upper:
                matched_region_name = "CAR (Cordillera Administrative Region)"
            elif "NATIONAL CAPITAL" in reg_name_upper:
                matched_region_name = "NCR (National Capital Region)"

        if not matched_region_name:
            continue

        province_bucket = region_buckets.setdefault(matched_region_name, {})

        provinces = reg_data.get("province_list", {})
        for prov_name, prov_data in provinces.items():
            prov_clean = clean_text(prov_name)
            muni_bucket = province_bucket.setdefault(prov_clean, {})

            municipalities = prov_data.get("municipality_list", {})
            for muni_name, muni_data in municipalities.items():
                muni_clean = clean_text(muni_name)
                if "CITY" in muni_name.upper() and "City" not in muni_clean:
                    muni_clean = muni_clean.replace("City", "").strip() + " City"

                # Kung first time pa lang nakikita ang munisipyong ito,
                # idagdag ito. Kung paulit-ulit (dahil sa duplicate source
                # region key), hindi na ito i-overwrite.
                if muni_clean not in muni_bucket:
                    muni_bucket[muni_clean] = [clean_text(b) for b in muni_data.get("barangay_list", [])]

    # I-convert pabalik ang merged buckets papuntang list shape na ginagamit
    # ng AddressSelector.jsx
    formatted_luzon = []
    for region_name, provinces_dict in region_buckets.items():
        province_list = []
        for prov_name, munis_dict in provinces_dict.items():
            municipality_list = [
                {"City/Municipality": m, "barangay_list": b}
                for m, b in munis_dict.items()
            ]
            municipality_list.sort(key=lambda x: x["City/Municipality"])
            province_list.append({"Province": prov_name, "municipality_list": municipality_list})
        province_list.sort(key=lambda x: x["Province"])
        formatted_luzon.append({"Region": region_name, "province_list": province_list})

    # Siguraduhing may data folder sa frontend
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"Isinusulat ang bagong file sa: {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(formatted_luzon, f, indent=2, ensure_ascii=False)

    print(f"Tapos na! {len(formatted_luzon)} unique na rehiyon ang na-export (dati ay may duplicates).")
    
if __name__ == "__main__":
    process_address()