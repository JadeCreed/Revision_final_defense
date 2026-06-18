import React, { useState, useEffect } from 'react';
import luzonData from '../data/luzon_formatted.json';

const AddressSelector = ({ onChange, values = {}, inputStyle }) => {
  const [provinces, setProvinces] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);

  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedMuni, setSelectedMuni] = useState('');
  const [selectedBrgy, setSelectedBrgy] = useState('');

  // Makinig sa mga initial values kung mayroon man (para sa edit mode)
  // Makinig sa mga initial values kung mayroon man (para sa edit mode).
  // Sinusuportahan natin DALAWANG paraan ng pag-pasa ng values:
  //   1) Buong { region, province, municipality, barangay } — kung galing
  //      sa ibang AddressSelector instance na alam na ang region/province.
  //   2) Flat na { municipality, barangay } LANG (walang region/province) —
  //      ito ang gagamitin ng FarmerProfile.jsx, dahil dalawang column lang
  //      ang naka-save sa DB (residency_municipality, residency_barangay).
  //      Kailangan i-reverse-lookup muna kung saang region/province ito.
  //
  // Case-insensitive ang lookup dahil baka may existing farmer na may
  // naka-save na "LUCBAN" (uppercase) mula sa lumang plain text input,
  // bago pa ang cascading dropdown na ito.
  const findLocationByMunicipality = (muniName) => {
    if (!muniName) return null;
    const target = muniName.trim().toLowerCase();
    for (const region of luzonData) {
      for (const province of region.province_list) {
        const muniObj = province.municipality_list.find(
          m => m["City/Municipality"].trim().toLowerCase() === target
        );
        if (muniObj) {
          return { region, province, muniObj };
        }
      }
    }
    return null;
  };

  useEffect(() => {
    // Case 1: caller already knows region/province (explicit values passed)
    if (values.region) {
      setSelectedRegion(values.region);
      const regObj = luzonData.find(r => r.Region === values.region);
      setProvinces(regObj ? regObj.province_list : []);

      if (values.province && regObj) {
        setSelectedProvince(values.province);
        const provObj = regObj.province_list.find(p => p.Province === values.province);
        setMunicipalities(provObj ? provObj.municipality_list : []);

        if (values.municipality && provObj) {
          setSelectedMuni(values.municipality);
          const muniObj = provObj.municipality_list.find(m => m["City/Municipality"] === values.municipality);
          setBarangays(muniObj ? muniObj.barangay_list : []);

          if (values.barangay && muniObj) {
            setSelectedBrgy(values.barangay);
          }
        }
      }
      return;
    }

    // Case 2: only flat municipality/barangay given (FarmerProfile.jsx case) —
    // reverse-lookup which region/province that municipality belongs to.
    if (values.municipality && !selectedRegion) {
      const found = findLocationByMunicipality(values.municipality);
      if (found) {
        setSelectedRegion(found.region.Region);
        setProvinces(found.region.province_list);
        setSelectedProvince(found.province.Province);
        setMunicipalities(found.province.municipality_list);
        setSelectedMuni(found.muniObj["City/Municipality"]);
        setBarangays(found.muniObj.barangay_list);

        if (values.barangay) {
          // Match barangay case-insensitively too, then use the dropdown's
          // own exact casing so the <select> value matches an <option>.
          const targetBrgy = values.barangay.trim().toLowerCase();
          const matchedBrgy = found.muniObj.barangay_list.find(
            b => b.trim().toLowerCase() === targetBrgy
          );
          setSelectedBrgy(matchedBrgy || values.barangay);
        }
      }
    }
  }, [values.region, values.province, values.municipality, values.barangay]);


  // I-update ang parent component sa tuwing may magbabago sa address
  const updateParent = (region, province, muni, brgy) => {
    if (onChange) {
      onChange({
        region,
        province,
        municipality: muni,
        barangay: brgy
      });
    }
  };

  const handleRegionChange = (e) => {
    const val = e.target.value;
    setSelectedRegion(val);
    setSelectedProvince('');
    setSelectedMuni('');
    setSelectedBrgy('');

    const regObj = luzonData.find(r => r.Region === val);
    const newProvinces = regObj ? regObj.province_list : [];
    setProvinces(newProvinces);
    setMunicipalities([]);
    setBarangays([]);

    updateParent(val, '', '', '');
  };

  const handleProvinceChange = (e) => {
    const val = e.target.value;
    setSelectedProvince(val);
    setSelectedMuni('');
    setSelectedBrgy('');

    const provObj = provinces.find(p => p.Province === val);
    const newMunis = provObj ? provObj.municipality_list : [];
    setMunicipalities(newMunis);
    setBarangays([]);

    updateParent(selectedRegion, val, '', '');
  };

  const handleMuniChange = (e) => {
    const val = e.target.value;
    setSelectedMuni(val);
    setSelectedBrgy('');

    const muniObj = municipalities.find(m => m["City/Municipality"] === val);
    setBarangays(muniObj ? muniObj.barangay_list : []);

    updateParent(selectedRegion, selectedProvince, val, '');
  };

  const handleBrgyChange = (e) => {
    const val = e.target.value;
    setSelectedBrgy(val);
    updateParent(selectedRegion, selectedProvince, selectedMuni, val);
  };

  // Tailwind CSS classes para sa disenyo
  const fallbackSelectClass = "w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-green-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed text-sm text-gray-700";
  const selectStyleProps = inputStyle
    ? { style: inputStyle(false), className: undefined }
    : { className: fallbackSelectClass, style: undefined };


  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Region</span>
          <select value={selectedRegion} onChange={handleRegionChange} {...selectStyleProps}>
            <option value="">Select region</option>
            {luzonData.map((r, i) => (
              <option key={i} value={r.Region}>{r.Region}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Province</span>
          <select value={selectedProvince} onChange={handleProvinceChange} disabled={!selectedRegion} {...selectStyleProps}>
            <option value="">Select province</option>
            {provinces.map((p, i) => (
              <option key={i} value={p.Province}>{p.Province}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">City / Municipality</span>
          <select value={selectedMuni} onChange={handleMuniChange} disabled={!selectedProvince} {...selectStyleProps}>
            <option value="">Select city/municipality</option>
            {municipalities.map((m, i) => (
              <option key={i} value={m["City/Municipality"]}>{m["City/Municipality"]}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Barangay</span>
          <select value={selectedBrgy} onChange={handleBrgyChange} disabled={!selectedMuni} {...selectStyleProps}>
            <option value="">Select barangay</option>
            {barangays.map((b, i) => (
              <option key={i} value={b}>{b}</option>
            ))}
          </select>
        </div>

      </div>

      {selectedMuni && selectedBrgy && (
        <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
          Saved as: <span className="text-gray-700 font-medium">{selectedBrgy}, {selectedMuni}</span>
        </p>
      )}
    </div>
  );
};

export default AddressSelector;