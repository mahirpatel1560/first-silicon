#!/usr/bin/env node
// Generates hand-written fixture responses in the exact public API formats of Greenhouse
// (jobs?content=true), Lever (postings?mode=json) and Ashby (posting-api/job-board?includeCompensation=true).
// All companies, people and postings are FICTIONAL. They exist only to test the pipeline offline and to
// render the demo build. Run: node fixtures/make-fixtures.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const API = path.join(DIR, 'api');

const EEO = 'Vireo is an equal opportunity employer. We consider all qualified applicants without regard to race, color, religion, sex, national origin, citizenship status, disability or protected veteran status.';

const esc = (html) => html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const p = (...xs) => xs.map((x) => `<p>${x}</p>`).join('');
const ul = (...xs) => `<ul>${xs.map((x) => `<li>${x}</li>`).join('')}</ul>`;
const plain = (html) => html.replace(/<li>/g, '\n• ').replace(/<\/(p|li|ul|h3)>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\n{2,}/g, '\n').trim();

// ------------------------------------------------------------------ Greenhouse
let ghId = 7100000;
function ghJob(board, companyName, { title, location, first_published, updated_at, html, dept = 'Engineering', office = null, metadata = null }) {
  ghId += 137;
  const job = {
    absolute_url: `https://job-boards.greenhouse.io/${board}/jobs/${ghId}`,
    data_compliance: [{ type: 'gdpr', requires_consent: false, requires_processing_consent: false, requires_retention_consent: false, retention_period: null, demographic_data_consent_applies: false }],
    education: 'education_optional',
    internal_job_id: ghId - 3000000,
    location: { name: location },
    metadata,
    id: ghId,
    updated_at: updated_at || first_published || '2026-09-01T09:00:00-04:00',
    requisition_id: `R-${ghId % 10000}`,
    title,
    company_name: companyName,
    first_published: first_published === undefined ? '2026-09-01T09:00:00-04:00' : first_published,
    language: 'en',
    application_deadline: null,
    content: esc(html),
    departments: [{ id: 40011, name: dept, child_ids: [], parent_id: null }],
    offices: [{ id: 50021, name: office || location, location: office || location, child_ids: [], parent_id: null }],
  };
  if (job.first_published === null) delete job.first_published;
  return job;
}

const vireo = 'vireosilicon';
const vireoJobs = [
  ghJob(vireo, 'Vireo Silicon', {
    title: 'Design Verification Intern (Summer 2027)', location: 'San Jose, CA', first_published: '2026-09-21T10:15:00-07:00',
    html: p('Join the verification team for our next networking SoC.') + ul('Write SystemVerilog testbenches and UVM sequences for a DMA block', 'Run regressions, debug waveforms and track functional coverage', 'Automate reports in Python') + p('Open to undergraduates of all class years studying electrical or computer engineering.') + p(EEO),
  }),
  ghJob(vireo, 'Vireo Silicon', {
    title: 'Design Verification Intern (Summer 2027)', location: 'Austin, TX', first_published: '2026-09-22T09:00:00-05:00',
    html: p('Same team, Austin site.') + ul('SystemVerilog and UVM testbenches', 'Coverage closure') + p('Open to undergraduates of all class years.') + p(EEO),
  }),
  ghJob(vireo, 'Vireo Silicon', {
    title: 'Analog IC Design Intern - Summer 2027', location: 'San Jose, CA', first_published: '2026-09-15T08:00:00-07:00',
    html: p('Design and simulate data converter building blocks in Cadence Virtuoso and Spectre.') + ul('Transistor-level design of comparators and bandgap references', 'Monte Carlo and corner simulation') + p('Candidates must be currently pursuing a Master\'s or PhD in Electrical Engineering.') + p(EEO),
  }),
  ghJob(vireo, 'Vireo Silicon', {
    title: 'Physical Design Student Worker', location: 'Austin, Texas, United States', first_published: '2026-08-28T12:00:00-05:00',
    html: p('Help the physical design team with place and route, timing closure and static timing analysis.') + p('Applicants should have an expected graduation date between December 2027 and June 2028.') + p(EEO),
  }),
  ghJob(vireo, 'Vireo Silicon', {
    title: 'FPGA Prototyping Intern', location: 'Hybrid - San Jose, CA', first_published: '2026-09-19T11:00:00-07:00',
    html: p('Bring up our RTL on FPGA prototyping boards and debug it in the lab.') + ul('Verilog and Vivado', 'Lab work with oscilloscopes and logic analyzers', 'Write embedded C test code for a soft-core MCU') + p('Rising sophomores and juniors are welcome to apply.') + p(EEO),
  }),
  ghJob(vireo, 'Vireo Silicon', { title: 'Product Marketing Intern', location: 'San Jose, CA', first_published: '2026-09-18T11:00:00-07:00', dept: 'Marketing', html: p('Write launch content and competitive analysis.') + p(EEO) }),
  ghJob(vireo, 'Vireo Silicon', { title: 'Software Engineering Intern, Cloud Tools', location: 'Remote - US', first_published: '2026-09-17T11:00:00-07:00', dept: 'Software', html: p('Build web dashboards with React, TypeScript and SQL on AWS.') + p(EEO) }),
  ghJob(vireo, 'Vireo Silicon', { title: 'University Recruiter, Internships', location: 'San Jose, CA', first_published: '2026-09-10T11:00:00-07:00', dept: 'People', html: p('Own our campus recruiting calendar for interns.') + p(EEO) }),
  ghJob(vireo, 'Vireo Silicon', { title: 'Senior Analog Design Engineer', location: 'San Jose, CA', first_published: '2026-09-02T11:00:00-07:00', html: p('Lead PLL design. 8+ years of experience.') + p(EEO) }),
  ghJob(vireo, 'Vireo Silicon', {
    title: 'Post-Silicon Validation Co-op (Spring 2027)', location: 'Austin, TX', first_published: '2026-09-12T09:00:00-05:00',
    html: p('Validate first silicon on the bench: bring-up, characterization and automated test with PyVISA.') + p('Must have completed sophomore year by the start of the co-op.') + p(EEO),
  }),
  ghJob(vireo, 'Vireo Silicon', {
    title: 'RTL Design Intern (Summer 2027)', location: 'San Jose, CA', first_published: '2026-09-17T10:00:00-07:00',
    html: p('Write synthesizable SystemVerilog for a packet-processing block and run lint and synthesis.') + ul('RTL coding and microarchitecture reviews', 'Timing closure support') + p(EEO),
  }),
  ghJob(vireo, 'Vireo Silicon', {
    title: 'ASIC Emulation Intern', location: 'Austin, TX', first_published: '2026-09-05T10:00:00-05:00',
    html: p('Map RTL onto FPGA-based emulation systems and debug failing tests with the verification team.') + p('We are looking for juniors and seniors in electrical or computer engineering.') + p(EEO),
  }),
  ghJob(vireo, 'Vireo Silicon', { title: 'Internal Tools Engineer', location: 'San Jose, CA', first_published: '2026-09-05T11:00:00-07:00', dept: 'IT', html: p('Maintain internal tooling.') + p(EEO) }),
];

const halcyon = 'halcyonorbital';
const HAL_EEO = 'Halcyon Orbital is an equal opportunity employer and does not discriminate on the basis of citizenship status or any other protected characteristic.';
const ITAR = 'This position requires access to technical data controlled under the International Traffic in Arms Regulations (ITAR); applicants must be a U.S. person as defined by ITAR.';
const halcyonJobs = [
  ghJob(halcyon, 'Halcyon Orbital', {
    title: 'Avionics Hardware Intern (Summer 2027)', location: 'Hawthorne, CA', first_published: '2026-09-22T08:30:00-07:00',
    html: p('Design and test flight avionics boards for our satellite bus.') + ul('Schematic capture and PCB layout in Altium', 'Board bring-up and debug with an oscilloscope', 'Write test procedures') + p('Freshmen and sophomores are encouraged to apply.') + p(ITAR) + p(HAL_EEO),
  }),
  ghJob(halcyon, 'Halcyon Orbital', {
    title: 'Flight Software Intern (Summer 2027)', location: 'Redmond, WA', first_published: '2026-09-20T08:30:00-07:00',
    html: p('Write embedded C++ for spacecraft flight computers running an RTOS.') + ul('Device drivers for I2C and SPI sensors', 'Hardware-in-the-loop testing') + p(ITAR) + p(HAL_EEO),
  }),
  ghJob(halcyon, 'Halcyon Orbital', {
    title: 'RF Engineering Intern (Summer 2027)', location: 'Redmond, WA', first_published: '2026-09-16T08:30:00-07:00',
    html: p('Characterize phased-array antenna tiles with a vector network analyzer.') + ul('S-parameter measurements and impedance matching', 'Link budget analysis') + p('We are recruiting students in the class of 2029 or 2030.') + p('U.S. citizenship is required for this role.') + p(HAL_EEO),
  }),
  ghJob(halcyon, 'Halcyon Orbital', {
    title: 'Power Systems Intern (Fall 2026)', location: 'Hawthorne, CA', first_published: '2026-08-20T08:30:00-07:00',
    html: p('Test DC-DC converters and battery packs for the spacecraft electrical power system.') + ul('Efficiency and thermal measurements', 'Battery management system validation') + p('Applicants must hold an active Secret clearance or be able to obtain one.') + p(HAL_EEO),
  }),
  ghJob(halcyon, 'Halcyon Orbital', {
    title: 'GNC Intern (Summer 2027)', location: 'Hawthorne, CA', first_published: '2026-09-08T08:30:00-07:00',
    html: p('Develop guidance, navigation and control algorithms; Kalman filters and attitude control in Simulink.') + p('Students entering their senior year preferred.') + p(HAL_EEO),
  }),
  ghJob(halcyon, 'Halcyon Orbital', {
    title: 'Hardware Validation Intern (Summer 2027)', location: 'Redmond, WA', first_published: '2026-09-18T08:30:00-07:00',
    html: p('Run thermal-vacuum and vibration qualification tests on flight electronics and analyze the results.') + p(ITAR) + p(HAL_EEO),
  }),
  ghJob(halcyon, 'Halcyon Orbital', { title: 'Propulsion Engineering Intern (Summer 2027)', location: 'Hawthorne, CA', first_published: '2026-09-08T08:30:00-07:00', html: p('Hot-fire testing of thrusters, fluid systems and valves.') + p(HAL_EEO) }),
  ghJob(halcyon, 'Halcyon Orbital', { title: 'International Trade Compliance Analyst', location: 'Hawthorne, CA', first_published: '2026-09-03T08:30:00-07:00', dept: 'Legal', html: p('Manage export licensing.') + p(HAL_EEO) }),
  ghJob(halcyon, 'Halcyon Orbital', {
    title: 'Test Engineering Co-op (Winter 2027)', location: 'Redmond, WA', first_published: '2026-09-14T08:30:00-07:00',
    html: p('Build automated test stations for flight hardware using Python, LabVIEW and SCPI instruments.') + p('Open to students who have completed at least one year of an engineering program.') + p(HAL_EEO),
  }),
  ghJob(halcyon, 'Halcyon Orbital', {
    title: 'Electrical Engineering Intern', location: 'Hawthorne, CA', first_published: null, updated_at: '2026-09-11T10:00:00-07:00',
    html: p('The internship runs Summer 2027 on the electrical team.') + ul('Wire harness design', 'Schematic review', 'Soldering and rework') + p(HAL_EEO),
  }),
];

const kestrel = 'kestrelgrid';
const kestrelJobs = [
  ghJob(kestrel, 'Kestrel Grid', {
    title: 'Power Electronics Intern - Summer 2027', location: 'Boston, MA', first_published: '2026-09-18T09:00:00-04:00',
    html: p('Prototype SiC inverters for grid batteries.') + ul('Gate driver design', 'Efficiency testing of DC-DC converters', 'LTspice and PLECS simulation') + p('Students with sophomore standing or above are eligible.'),
  }),
  ghJob(kestrel, 'Kestrel Grid', {
    title: 'Battery Management Systems Intern', location: 'Remote - US', first_published: '2026-09-09T09:00:00-04:00',
    html: p('Write firmware and validation tests for our battery management system (BMS).') + p('This internship is for students graduating in 2028.') + p('We are unable to sponsor visas for this internship.'),
  }),
  ghJob(kestrel, 'Kestrel Grid', {
    title: 'Embedded Software Intern, Inverter Controls', location: 'Hybrid - Boston, MA', first_published: '2026-09-16T09:00:00-04:00',
    html: p('Implement control loops in C on TI C2000 microcontrollers for grid-forming inverters.') + ul('Interrupt-driven firmware', 'Hardware-in-the-loop testing'),
  }),
  ghJob(kestrel, 'Kestrel Grid', {
    title: 'Power Hardware Co-op (Spring 2027)', location: 'Boston, MA', first_published: '2026-09-07T09:00:00-04:00',
    html: p('Build and test high-voltage converter prototypes; magnetics, gate drivers and thermal testing.') + p('Open to students who are at least a junior in electrical engineering.'),
  }),
  ghJob(kestrel, 'Kestrel Grid', { title: 'Grid Software Intern', location: 'Boston, MA', first_published: '2026-09-09T09:00:00-04:00', dept: 'Software', html: p('Build Python and SQL services on Kubernetes.') }),
  ghJob(kestrel, 'Kestrel Grid', {
    title: 'Controls Engineering Intern (Spring 2027)', location: 'Boston, MA; Denver, CO', first_published: '2026-09-01T09:00:00-04:00',
    html: p('Tune control loops for grid-forming inverters and model them in Simulink.'),
  }),
];

// ------------------------------------------------------------------ Lever
let lvSeq = 0;
function lvJob(site, { text, commitment, location, allLocations, workplaceType = 'on-site', country = 'US', createdAt, html, lists = [], salaryRange = null, team = 'Engineering' }) {
  lvSeq++;
  const id = `3f${String(lvSeq).padStart(6, '0')}-8e2b-4c1d-9a7b-${String(100000000000 + lvSeq * 7919).slice(-12)}`;
  const opening = p('We build robots and aircraft systems that work outside the lab.');
  const body = html;
  const post = {
    additionalPlain: 'We are an equal opportunity employer.',
    additional: '<div>We are an equal opportunity employer.</div>',
    categories: { commitment, department: 'Engineering', location, team, allLocations: allLocations || [location] },
    createdAt,
    descriptionPlain: plain(opening + body),
    description: `<div>${opening}${body}</div>`,
    id,
    lists: lists.map(([t, items]) => ({ text: t, content: items.map((x) => `<li>${x}</li>`).join('') })),
    text,
    country,
    workplaceType,
    opening: `<div>${opening}</div>`,
    openingPlain: plain(opening),
    descriptionBody: `<div>${body}</div>`,
    descriptionBodyPlain: plain(body),
    hostedUrl: `https://jobs.lever.co/${site}/${id}`,
    applyUrl: `https://jobs.lever.co/${site}/${id}/apply`,
  };
  if (salaryRange) {
    post.salaryRange = salaryRange;
    post.salaryDescription = '<div>Hourly pay for interns.</div>';
    post.salaryDescriptionPlain = 'Hourly pay for interns.';
  }
  return post;
}
const ms = (iso) => Date.parse(iso);
const tamarack = 'tamarackrobotics';
const tamarackJobs = [
  lvJob(tamarack, {
    text: 'Robotics Hardware Intern', commitment: 'Intern', location: 'Pittsburgh, PA', createdAt: ms('2026-09-21T14:00:00Z'),
    html: p('Design motor driver and sensor boards for our mobile manipulators and bring them up on real robots.'), lists: [['What you will do', ['Schematics and PCB layout in KiCad', 'Integrate encoders, IMUs and actuators', 'Debug with oscilloscopes']], ['Who we are looking for', ['First-year and second-year students are welcome to apply.', 'Hands-on project experience']]],
    salaryRange: { currency: 'USD', interval: 'per-hour-wage', min: 28, max: 34 },
  }),
  lvJob(tamarack, {
    text: 'Embedded Firmware Intern', commitment: 'Internship', location: 'Pittsburgh, PA', workplaceType: 'hybrid', createdAt: ms('2026-09-17T14:00:00Z'),
    html: p('Write firmware for STM32 motor controllers.'), lists: [['Requirements', ['C programming on microcontrollers', 'FreeRTOS experience a plus', 'CAN bus and SPI drivers']]],
  }),
  lvJob(tamarack, {
    text: 'Mechatronics Co-op', commitment: 'Co-op', location: 'Pittsburgh, PA', createdAt: ms('2026-09-04T14:00:00Z'),
    html: p('Integrate actuators, sensors and control electronics on robot arms.'), lists: [['Requirements', ['Junior or senior standing in electrical, mechanical or mechatronics engineering', 'Controls coursework']]],
  }),
  lvJob(tamarack, {
    text: 'Controls Intern, Robot Arms', commitment: 'Intern', location: 'Pittsburgh, PA', createdAt: ms('2026-09-15T14:00:00Z'),
    html: p('Tune joint controllers and state estimation for 7-DoF arms, from Simulink models to real hardware.'), lists: [['Who should apply', ['First-year students with robotics club experience are encouraged to apply.']]],
  }),
  lvJob(tamarack, { text: 'Perception Software Intern', commitment: 'Intern', location: 'Pittsburgh, PA', createdAt: ms('2026-09-16T14:00:00Z'), html: p('Train computer vision models with PyTorch.'), lists: [['Requirements', ['Deep learning', 'Python']]] }),
  lvJob(tamarack, { text: 'Field Operations Technician', commitment: 'Full-time', location: 'Pittsburgh, PA', createdAt: ms('2026-09-01T14:00:00Z'), html: p('Maintain robots at customer sites.') }),
  lvJob(tamarack, {
    text: 'Hardware Test Intern', commitment: 'Intern', location: 'Pittsburgh, PA', allLocations: ['Pittsburgh, PA', 'Austin, TX'], createdAt: ms('2026-09-10T14:00:00Z'),
    html: p('Build hardware-in-the-loop rigs and automate validation of robot electronics.'), lists: [['Good to know', ['Visa sponsorship is not available for this position.']]],
  }),
];

const brightwater = 'BrightwaterAvionics';
const brightwaterJobs = [
  lvJob(brightwater, {
    text: 'Electrical Design Intern', commitment: 'Intern', location: 'Wichita, KS', createdAt: ms('2026-09-19T15:00:00Z'),
    html: p('Create schematics and wiring diagrams for cockpit avionics.') + p('Access to export-controlled data requires U.S. person status (ITAR).'), lists: [['Requirements', ['Circuits coursework', 'Altium or KiCad']]],
  }),
  lvJob(brightwater, {
    text: 'Wire Harness Design Intern', commitment: 'Intern', location: 'Wichita, KS', createdAt: ms('2026-08-30T15:00:00Z'),
    html: p('Design wire harnesses and electrical interconnects for aircraft.'), lists: [['Requirements', ['Wire harness drawings', 'Schematic reading', 'Soldering']]],
  }),
  lvJob(brightwater, {
    text: 'Avionics Firmware Intern', commitment: 'Intern', location: 'Wichita, KS', createdAt: ms('2026-09-18T15:00:00Z'),
    html: p('Write firmware for cockpit display controllers: drivers, bootloader updates and hardware bring-up.') + p('Sophomores with embedded C experience are a great fit.'), lists: [['Requirements', ['C on microcontrollers', 'Oscilloscope and logic analyzer use']]],
  }),
  lvJob(brightwater, {
    text: 'Werkstudent Embedded Systems (m/w/d)', commitment: 'Working Student', location: 'Munich, Germany', country: 'DE', createdAt: ms('2026-09-12T15:00:00Z'),
    html: p('Embedded C development for avionics displays; microcontrollers and RTOS.'),
  }),
];

const halcyonLever = [
  lvJob('halcyonorbital', {
    text: 'Avionics Hardware Intern (Summer 2027)', commitment: 'Intern', location: 'Redmond, WA', createdAt: ms('2026-09-23T08:00:00Z'),
    html: p('Design and test flight avionics boards; PCB layout and bring-up.') + p(ITAR),
  }),
];

// ------------------------------------------------------------------ Ashby
let abSeq = 0;
function abJob(board, { title, location, secondary = [], employmentType = 'Intern', workplaceType = 'OnSite', isRemote = false, publishedAt, html, department = 'Engineering', team = 'Hardware', comp = null, isListed = true, address = null }) {
  abSeq++;
  const id = `9c${String(abSeq).padStart(6, '0')}-1d2e-4f5a-8b6c-${String(200000000000 + abSeq * 104729).slice(-12)}`;
  const job = {
    id,
    title,
    location,
    secondaryLocations: secondary.map((l) => ({ location: l, address: { postalAddress: { addressLocality: l.split(',')[0], addressRegion: (l.split(',')[1] || '').trim(), addressCountry: 'United States' } } })),
    department,
    team,
    isListed,
    isRemote,
    workplaceType,
    descriptionHtml: html,
    descriptionPlain: plain(html),
    publishedAt,
    employmentType,
    address: address || { postalAddress: { addressLocality: location.split(',')[0], addressRegion: (location.split(',')[1] || '').trim(), addressCountry: 'United States' } },
    jobUrl: `https://jobs.ashbyhq.com/${board}/${id}`,
    applyUrl: `https://jobs.ashbyhq.com/${board}/${id}/application`,
    shouldDisplayCompensationOnJobPostings: Boolean(comp),
  };
  if (comp) {
    job.compensation = {
      compensationTierSummary: comp,
      scrapeableCompensationSalarySummary: comp,
      compensationTiers: [{ id: `tier-${abSeq}`, tierSummary: comp, title: 'Intern', additionalInformation: null, components: [{ id: `c-${abSeq}`, summary: comp, compensationType: 'Salary', interval: '1 HOUR', currencyCode: 'USD', minValue: 30, maxValue: 38 }] }],
      summaryComponents: [{ compensationType: 'Salary', interval: '1 HOUR', currencyCode: 'USD', minValue: 30, maxValue: 38 }],
    };
  }
  return job;
}
const lumen = 'lumenfab';
const lumenJobs = [
  abJob(lumen, {
    title: 'Photonics Test Intern', location: 'Tucson, AZ', publishedAt: '2026-09-22T16:05:11.201+00:00', comp: '$30 – $38 per hour',
    html: p('Characterize silicon photonics chips: insertion loss, spectra and optical alignment.') + ul('Python automation of lasers and photodetectors', 'Fiber alignment') + p('Rising sophomores are encouraged to apply.'),
  }),
  abJob(lumen, {
    title: 'Process Engineering Intern (Summer 2027)', location: 'Tucson, AZ', publishedAt: '2026-09-11T16:05:11.201+00:00',
    html: p('Support lithography, etch and thin-film deposition in our cleanroom; analyze metrology data with SPC.') + p('This position requires access to export-controlled information subject to the EAR.'),
  }),
  abJob(lumen, {
    title: 'Laser Systems Co-op', location: 'Tucson, AZ', publishedAt: '2026-09-02T16:05:11.201+00:00',
    html: p('Assemble and test laser modules and optical packaging.') + p('Open to third-year students or above in optics, physics or electrical engineering.'),
  }),
  abJob(lumen, { title: 'Senior Optical Engineer', location: 'Tucson, AZ', employmentType: 'FullTime', publishedAt: '2026-08-15T16:05:11.201+00:00', html: p('Lead lens design in Zemax.') }),
  abJob(lumen, { title: 'Operations Intern', location: 'Tucson, AZ', publishedAt: '2026-09-15T16:05:11.201+00:00', department: 'Operations', team: 'Operations', html: p('Improve purchasing and logistics workflows.') }),
  abJob(lumen, { title: 'Unlisted Hardware Intern', location: 'Tucson, AZ', publishedAt: '2026-09-15T16:05:11.201+00:00', isListed: false, html: p('Internal placeholder.') }),
];

const quill = 'quillcircuits';
const quillJobs = [
  abJob(quill, {
    title: 'Hardware Engineering Intern', location: 'Remote', workplaceType: 'Remote', isRemote: true, publishedAt: '2026-09-20T13:00:00.000+00:00',
    address: { postalAddress: { addressLocality: '', addressRegion: '', addressCountry: 'United States' } },
    html: p('Design reference boards that exercise our PCB layout automation: schematics, Altium and KiCad layouts, and bring-up.') + p('Students of all class years are welcome.'),
  }),
  abJob(quill, {
    title: 'PCB Layout Intern', location: 'Remote (US)', workplaceType: 'Remote', isRemote: true, publishedAt: '2026-09-06T13:00:00.000+00:00',
    address: { postalAddress: { addressLocality: '', addressRegion: '', addressCountry: 'United States' } },
    html: p('Lay out four- and six-layer boards, run DFM checks and prepare fabrication outputs.'),
  }),
  abJob(quill, {
    title: 'Signal Integrity Intern', location: 'Boulder, CO', secondary: ['San Jose, CA'], workplaceType: 'Hybrid', publishedAt: '2026-09-13T13:00:00.000+00:00',
    html: p('Simulate high-speed interfaces and power integrity for DDR and PCIe boards.') + p('Currently pursuing an MS or PhD in electrical engineering.'),
  }),
  abJob(quill, {
    title: 'FPGA Tools Intern', location: 'Boulder, CO', workplaceType: 'OnSite', publishedAt: '2026-09-03T13:00:00.000+00:00',
    html: p('Build FPGA reference designs in Verilog and script Vivado builds that validate our tools.') + p('Open to undergraduates of any class year.'),
  }),
  abJob(quill, { title: 'Growth Marketing Intern', location: 'Remote', workplaceType: 'Remote', isRemote: true, department: 'Marketing', team: 'Marketing', publishedAt: '2026-09-18T13:00:00.000+00:00', html: p('Run campaigns and write content.') }),
];

function write(rel, data) {
  const file = path.join(API, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
write('greenhouse/vireosilicon.json', { jobs: vireoJobs, meta: { total: vireoJobs.length } });
write('greenhouse/halcyonorbital.json', { jobs: halcyonJobs, meta: { total: halcyonJobs.length } });
write('greenhouse/kestrelgrid.json', { jobs: kestrelJobs, meta: { total: kestrelJobs.length } });
write('lever/tamarackrobotics.json', tamarackJobs);
write('lever/BrightwaterAvionics.json', brightwaterJobs);
write('lever/halcyonorbital.json', halcyonLever);
write('ashby/lumenfab.json', { apiVersion: '1', jobs: lumenJobs });
write('ashby/quillcircuits.json', { apiVersion: '1', jobs: quillJobs });
write('ashby/emptyco.json', { apiVersion: '1', jobs: [] });

const companies = {
  schema: 1,
  about: 'FICTIONAL companies for offline tests and the demo build. Tokens map to files in fixtures/api/<ats>/<token>.json.',
  companies: [
    { name: 'Vireo Silicon', slug: 'vireo-silicon', category: 'semiconductors', ats: 'greenhouse', token: 'vireosilicon', status: 'ok' },
    { name: 'Halcyon Orbital', slug: 'halcyon-orbital', category: 'space', ats: 'greenhouse', token: 'halcyonorbital', status: 'ok' },
    { name: 'Halcyon Orbital', slug: 'halcyon-orbital', category: 'space', ats: 'lever', token: 'halcyonorbital', status: 'ok' },
    { name: 'Kestrel Grid', slug: 'kestrel-grid', category: 'energy', ats: 'greenhouse', token: 'kestrelgrid', status: 'ok' },
    { name: 'Tamarack Robotics', slug: 'tamarack-robotics', category: 'robotics', ats: 'lever', token: 'tamarackrobotics', status: 'ok' },
    { name: 'Brightwater Avionics', slug: 'brightwater-avionics', category: 'aerospace', ats: 'lever', token: 'BrightwaterAvionics', status: 'ok' },
    { name: 'Lumen Fab', slug: 'lumen-fab', category: 'photonics', ats: 'ashby', token: 'lumenfab', status: 'ok' },
    { name: 'Quill Circuits', slug: 'quill-circuits', category: 'eda', ats: 'ashby', token: 'quillcircuits', status: 'ok' },
    { name: 'Empty Co', slug: 'empty-co', category: 'consumer', ats: 'ashby', token: 'emptyco', status: 'empty' },
    { name: 'Ghost Board Inc', slug: 'ghost-board', category: 'consumer', ats: 'greenhouse', token: 'ghostboard', status: 'ok' },
    { name: 'Never Probed Labs', slug: 'never-probed', category: 'robotics', ats: null, token: null, status: 'not_found' },
  ],
};
fs.writeFileSync(path.join(DIR, 'companies.fixture.json'), JSON.stringify(companies, null, 2) + '\n');

// Previous-run seed for the demo build: roles first seen on earlier dates, plus one that has since closed.
const previous = {
  schema: 1,
  note: 'Seed of a previous run (FICTIONAL). make-demo-data computes ids from company_slug + title.',
  roles: [
    { company: 'Vireo Silicon', company_slug: 'vireo-silicon', title: 'Physical Design Student Worker', first_seen: '2026-08-29' },
    { company: 'Halcyon Orbital', company_slug: 'halcyon-orbital', title: 'Power Systems Intern (Fall 2026)', first_seen: '2026-08-21' },
    { company: 'Halcyon Orbital', company_slug: 'halcyon-orbital', title: 'GNC Intern (Summer 2027)', first_seen: '2026-09-09' },
    { company: 'Kestrel Grid', company_slug: 'kestrel-grid', title: 'Controls Engineering Intern (Spring 2027)', first_seen: '2026-09-02' },
    { company: 'Kestrel Grid', company_slug: 'kestrel-grid', title: 'Battery Management Systems Intern', first_seen: '2026-09-10' },
    { company: 'Tamarack Robotics', company_slug: 'tamarack-robotics', title: 'Mechatronics Co-op', first_seen: '2026-09-05' },
    { company: 'Brightwater Avionics', company_slug: 'brightwater-avionics', title: 'Wire Harness Design Intern', first_seen: '2026-08-31' },
    { company: 'Lumen Fab', company_slug: 'lumen-fab', title: 'Laser Systems Co-op', first_seen: '2026-09-03' },
    { company: 'Quill Circuits', company_slug: 'quill-circuits', title: 'PCB Layout Intern', first_seen: '2026-09-07' },
    { company: 'Vireo Silicon', company_slug: 'vireo-silicon', title: 'Mixed-Signal Layout Intern (Summer 2026)', first_seen: '2026-06-01', closed: true },
  ],
};
fs.writeFileSync(path.join(DIR, 'previous-run.seed.json'), JSON.stringify(previous, null, 2) + '\n');
console.log('fixtures written');
