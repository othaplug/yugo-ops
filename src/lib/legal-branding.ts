import {
  getCompanyDisplayName,
  getCompanyEmail,
  getCompanyLegalName,
  getConfig,
} from "@/lib/config";

export async function getLegalBranding(): Promise<{
  companyLegal: string;
  brand: string;
  email: string;
  address: string;
}> {
  const [companyLegal, brand, email, address] = await Promise.all([
    getCompanyLegalName(),
    getCompanyDisplayName(),
    getCompanyEmail(),
    getConfig("company_address", "Toronto, ON, Canada"),
  ]);
  return { companyLegal, brand, email, address };
}
