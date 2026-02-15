export interface ProjectVendor {
  vendor: string;
  items: string;
  status: "done" | "transit" | "wait" | "late";
  eta: string;
  notes?: string;
}

export interface Project {
  id: string;
  name: string;
  designer: string;
  designerId?: string;
  designerEmail?: string;
  designerPhone?: string;
  designerCompany?: string;
  address: string;
  installDate: string;
  percent: number;
  vendors: ProjectVendor[];
  notes?: string;
  budget?: string;
}

export const PROJECTS: Project[] = [
  {
    id: "1",
    name: "Wilson Residence",
    designer: "Alessandro Munge",
    designerCompany: "Studio Munge",
    designerEmail: "alessandro@studiomunge.com",
    designerPhone: "+1 416 555 0123",
    address: "42 Crescent Rd",
    installDate: "Feb 15",
    percent: 75,
    budget: "$285K",
    vendors: [
      { vendor: "B&B Italia", items: "Sofa+chairs", status: "done", eta: "Feb 3" },
      { vendor: "Minotti", items: "Great room", status: "transit", eta: "Feb 10" },
      { vendor: "Poliform", items: "Kitchen", status: "wait", eta: "Feb 12" },
      { vendor: "Holly Hunt", items: "Bedroom", status: "late", eta: "Feb 14", notes: "Follow up required" },
    ],
  },
  {
    id: "2",
    name: "Kim Penthouse",
    designer: "Alessandro Munge",
    designerCompany: "Studio Munge",
    designerEmail: "alessandro@studiomunge.com",
    designerPhone: "+1 416 555 0123",
    address: "1 Bloor St E",
    installDate: "Mar 1",
    percent: 50,
    budget: "$192K",
    vendors: [
      { vendor: "Flos", items: "Lighting", status: "done", eta: "Feb 1" },
      { vendor: "Molteni&C", items: "Bedroom", status: "wait", eta: "Feb 20" },
      { vendor: "Tai Ping", items: "Rugs", status: "wait", eta: "Feb 25" },
    ],
  },
  {
    id: "3",
    name: "Kapoor Residence",
    designer: "Alessandro Munge",
    designerCompany: "Studio Munge",
    designerEmail: "alessandro@studiomunge.com",
    designerPhone: "+1 416 555 0123",
    address: "65 Bridle Path",
    installDate: "Mar 20",
    percent: 25,
    budget: "$410K",
    vendors: [
      { vendor: "Poliform", items: "Kitchen", status: "done", eta: "Feb 1" },
      { vendor: "Minotti", items: "Great room", status: "done", eta: "Feb 6" },
      { vendor: "B&B Italia", items: "Family room", status: "wait", eta: "Feb 25" },
      { vendor: "Holly Hunt", items: "Bedroom", status: "wait", eta: "Mar 1" },
    ],
  },
  {
    id: "4",
    name: "Lee Condo",
    designer: "Sarah Lee",
    designerCompany: "Fig Studio",
    designerEmail: "sarah@figstudio.ca",
    designerPhone: "+1 416 555 0456",
    address: "200 Bloor St W",
    installDate: "Feb 11",
    percent: 60,
    budget: "$78K",
    vendors: [
      { vendor: "EQ3", items: "Sectional+dining", status: "done", eta: "Feb 1" },
      { vendor: "CB2", items: "Bedroom", status: "done", eta: "Feb 4" },
      { vendor: "West Elm", items: "Accessories", status: "done", eta: "Feb 6" },
      { vendor: "Local artist", items: "Art x4", status: "transit", eta: "Feb 10" },
    ],
  },
];

export function getProjectById(id: string): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}
