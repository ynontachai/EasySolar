import provincesData from "@/data/thai-address/provinces.json";
import districtsData from "@/data/thai-address/districts.json";
import subdistrictsData from "@/data/thai-address/subdistricts.json";

interface ProvinceRecord {
  id: number;
  th: string;
}

interface DistrictRecord {
  id: number;
  province_id: number;
  th: string;
}

interface SubdistrictRecord {
  district_id: number;
  id: number;
  postal_code: number;
  th: string;
}

const provinces = provincesData as ProvinceRecord[];
const districts = districtsData as DistrictRecord[];
const subdistricts = subdistrictsData as SubdistrictRecord[];

export interface ThaiAddressOption {
  label: string;
  postalCode?: string;
  value: string;
}

export function getProvinceOptions(): ThaiAddressOption[] {
  return provinces.map((province) => ({ label: province.th, value: String(province.id) }));
}

export function getDistrictOptions(provinceId: string): ThaiAddressOption[] {
  return districts
    .filter((district) => district.province_id === Number(provinceId))
    .map((district) => ({ label: district.th, value: String(district.id) }));
}

export function getSubdistrictOptions(districtId: string): ThaiAddressOption[] {
  return subdistricts
    .filter((subdistrict) => subdistrict.district_id === Number(districtId))
    .map((subdistrict) => ({
      label: subdistrict.th,
      postalCode: String(subdistrict.postal_code).padStart(5, "0"),
      value: String(subdistrict.id),
    }));
}

export function resolveThaiAddress({
  districtId,
  provinceId,
  subdistrictId,
}: {
  districtId: string;
  provinceId: string;
  subdistrictId: string;
}) {
  const province = provinces.find((item) => item.id === Number(provinceId));
  const district = districts.find(
    (item) => item.id === Number(districtId) && item.province_id === province?.id,
  );
  const subdistrict = subdistricts.find(
    (item) => item.id === Number(subdistrictId) && item.district_id === district?.id,
  );
  if (!province || !district || !subdistrict) return null;
  return {
    district: district.th,
    postalCode: String(subdistrict.postal_code).padStart(5, "0"),
    province: province.th,
    subdistrict: subdistrict.th,
  };
}

export function isValidThaiAddress({
  district,
  postalCode,
  province,
  subdistrict,
}: {
  district: string;
  postalCode: string;
  province: string;
  subdistrict: string;
}) {
  const provinceRecord = provinces.find((item) => item.th === province);
  const districtRecord = districts.find(
    (item) => item.province_id === provinceRecord?.id && item.th === district,
  );
  return subdistricts.some(
    (item) =>
      item.district_id === districtRecord?.id &&
      item.th === subdistrict &&
      String(item.postal_code).padStart(5, "0") === postalCode,
  );
}
