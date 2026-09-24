// Small, dependency-free label tables shared by the build, README/newsletter generators and the browser bundle.

export const DISCIPLINE_LABELS = {
  embedded: { short: 'Embedded/firmware', label: 'Embedded systems & firmware' },
  digital: { short: 'FPGA/RTL/ASIC', label: 'FPGA, RTL & ASIC design and verification' },
  analog: { short: 'Analog/mixed-signal', label: 'Analog & mixed-signal' },
  rf: { short: 'RF/wireless', label: 'RF, microwave & wireless' },
  power: { short: 'Power electronics', label: 'Power electronics' },
  pcb: { short: 'PCB/hardware', label: 'PCB & hardware design' },
  test: { short: 'Test/validation', label: 'Test, validation & reliability' },
  controls: { short: 'Controls/robotics', label: 'Controls, robotics & GNC' },
  process: { short: 'Semi process/device', label: 'Semiconductor process & devices' },
  photonics: { short: 'Photonics/optics', label: 'Photonics & optics' },
  general: { short: 'General EE', label: 'General EE / hardware' },
};
export const DISCIPLINE_ORDER = Object.keys(DISCIPLINE_LABELS);

export const FLAG_LABELS = {
  citizenship: 'US citizen',
  residency: 'US person / PR',
  export: 'ITAR / export',
  clearance: 'Clearance',
  no_sponsorship: 'No visa sponsorship',
};
export const RESTRICTIVE_FLAGS = ['citizenship', 'residency', 'export', 'clearance'];

export const CLASS_YEAR_LABELS = {
  fs: 'Fr/So friendly',
  jplus: 'Juniors+',
  unspecified: 'Class year not stated',
};

export const CATEGORY_LABELS = {
  space: 'Space',
  aerospace: 'Aerospace & drones',
  defense: 'Defense tech',
  semiconductors: 'Semiconductors',
  eda: 'EDA & design tools',
  photonics: 'Photonics & lidar',
  quantum: 'Quantum computing',
  robotics: 'Robotics',
  autonomy: 'Autonomous vehicles',
  ev: 'Electric vehicles',
  energy: 'Energy & batteries',
  'fusion-nuclear': 'Fusion & nuclear',
  compute: 'Compute & data-center hardware',
  devices: 'Connected devices',
  consumer: 'Consumer hardware',
  medical: 'Medical devices',
  manufacturing: 'Manufacturing & 3D printing',
  networking: 'Networking & wireless hardware',
};

export function disciplineShort(slug) {
  return (DISCIPLINE_LABELS[slug] && DISCIPLINE_LABELS[slug].short) || slug;
}
