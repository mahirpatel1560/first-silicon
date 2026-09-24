import { DISCIPLINE_LABELS } from './labels.mjs';

// Discipline taxonomy: keyword rules for the classifier + long-form content for /disciplines/<slug>/.
// Keep regexes lowercase-insensitive (the classifier applies the `i` flag).

export const DISCIPLINES = [
  {
    slug: 'embedded',
    label: 'Embedded systems & firmware',
    short: 'Embedded/firmware',
    title: [
      'embedded', 'firmware', 'flight software', 'avionics software', 'microcontrollers?', '\\bmcu\\b', '\\brtos\\b',
      '\\bbsp\\b', 'board support', 'device drivers?', 'bootloader', 'low[- ]level software', 'embedded linux',
    ],
    desc: [
      'firmware', 'embedded (?:c|c\\+\\+|software|systems?|linux|development)', 'microcontrollers?', '\\bmcus?\\b',
      '\\brtos\\b', 'freertos', 'zephyr', 'bare[- ]metal', 'device drivers?', 'bootloaders?', '\\bbsp\\b',
      '\\bi2c\\b', '\\bspi\\b', '\\buart\\b', '\\bcan bus\\b', '\\bstm32\\b', '\\besp32\\b', '\\bnrf5\\d', 'arm cortex',
      '\\bjtag\\b', 'interrupt(?:s|-driven)?\\b', 'yocto', 'flight software',
    ],
    intro:
      'Embedded engineers write the software that runs directly on microcontrollers and system-on-chips inside a product: device drivers, real-time tasks, bootloaders and control loops. Unlike app development, you work within fixed budgets of memory, timing and power, and a bug can mean a board that does not boot.',
    work: [
      'Bring up peripherals on a new board revision (I2C, SPI, UART, CAN, ADC) and write or fix their drivers.',
      'Add features to an RTOS-based application and measure timing, stack use and power draw.',
      'Debug with a logic analyzer, oscilloscope and JTAG/SWD debugger rather than print statements alone.',
      'Write Python tools that flash devices, run hardware-in-the-loop tests and parse logs.',
    ],
    skills: [
      'C (pointers, bit manipulation, volatile, interrupts); some C++ helps.',
      'Reading a datasheet and reference manual to configure a peripheral register by register.',
      'One microcontroller family end to end, such as STM32, nRF52, ESP32 or RP2040.',
      'An RTOS (FreeRTOS or Zephyr) or a clear bare-metal scheduler you wrote yourself.',
      'Lab debugging with a scope or logic analyzer, plus Git and basic Python.',
    ],
    projects: [
      'Write an I2C driver for a temperature or IMU sensor straight from its datasheet (no vendor library), stream readings over UART, and include a logic-analyzer capture of one transaction in your write-up.',
      'Build a three-task FreeRTOS or Zephyr app (sensor read, filtering, serial or BLE output). Document task priorities, stack sizes and what happens when a task overruns.',
      'Make a battery-powered sensor node that sleeps between readings. Measure current in each state with a multimeter or power profiler and show how your firmware changes cut average power.',
    ],
  },
  {
    slug: 'digital',
    label: 'FPGA, RTL & ASIC design and verification',
    short: 'FPGA/RTL/ASIC',
    title: [
      '\\bfpga', '\\basic', '\\brtl\\b', '\\bvlsi\\b', '\\bsoc\\b', 'digital (?:ic |logic |hardware )?design', 'logic design',
      'design verification', '\\bdv\\b', '\\bdft\\b', 'physical design', 'digital ic', 'chip design', 'microarchitecture',
      'silicon (?:design|engineer)', 'cpu (?:design|verification)', 'gpu (?:design|hardware|verification)',
      'verification engineer', 'hardware verification', 'static timing', 'computer architecture', '(?:cpu|gpu|soc|accelerator|hardware) architecture',
    ],
    titleWeak: ['emulation', 'performance modeling', '\\bverification\\b', '\\b(?:cpu|gpu)\\b'],
    desc: [
      '\\bverilog\\b', 'systemverilog', '\\bvhdl\\b', '\\buvm\\b', '\\brtl\\b', '\\bfpgas?\\b', '\\basics?\\b', 'logic synthesis',
      'timing closure', 'static timing', 'place and route', 'formal verification', 'testbench(?:es)?', '\\bvivado\\b',
      '\\bquartus\\b', '\\bcocotb\\b', '\\bchisel\\b', '\\bsocs?\\b', 'microarchitecture', '\\bdft\\b', 'scan chains?',
      'clock domain', 'design verification', 'physical design',
    ],
    intro:
      'Digital hardware engineers describe logic in hardware description languages such as Verilog, SystemVerilog or VHDL, prove it works in simulation, and then implement it on an FPGA or send it to a foundry as a custom chip (ASIC). At chip companies, verification (building testbenches that try to break a design) is often a larger team than design itself.',
    work: [
      'Write RTL for a contained block such as a FIFO, arbiter, UART, DMA engine or bus bridge.',
      'Build self-checking testbenches in SystemVerilog/UVM or Python (cocotb), run regressions and debug waveforms.',
      'Close timing on an FPGA build and explain what changed between a failing and passing run.',
      'Script flows in Python or Tcl: parse synthesis, timing and coverage reports into something readable.',
    ],
    skills: [
      'Digital logic fundamentals: finite-state machines, pipelining, clock-domain crossing, setup and hold.',
      'Verilog or SystemVerilog written in a synthesizable style, plus a simulator (Icarus, Verilator, Questa or Xcelium).',
      'An FPGA toolchain: Vivado, Quartus, or the open-source Yosys and nextpnr flow.',
      'Computer architecture basics (caches, pipelines, RISC-V or ARM instruction sets).',
      'Python or Tcl for automation and report parsing.',
    ],
    projects: [
      'Implement a UART plus FIFO in Verilog with a self-checking testbench, then run it on an inexpensive FPGA board talking to your laptop.',
      'Build a small pipelined RISC-V (RV32I) core and a cocotb or SystemVerilog test suite; publish which instructions and hazards your tests cover.',
      'Design an asynchronous FIFO with Gray-code pointers for a clock-domain crossing, test it with randomized stimulus, and write up why the synchronizers prevent metastability problems.',
    ],
  },
  {
    slug: 'analog',
    label: 'Analog & mixed-signal',
    short: 'Analog/mixed-signal',
    title: ['\\banalog', 'mixed[- ]signal', '\\bams\\b', 'analog layout', 'custom layout', 'data converter', '\\bserdes\\b', '\\bpmic\\b', 'circuit design'],
    desc: [
      '\\banalog\\b', 'mixed[- ]signal', 'op[- ]amps?', '\\badcs?\\b', '\\bdacs?\\b', '\\bplls?\\b', '\\bldos?\\b', 'bandgap',
      '\\bspice\\b', '\\bspectre\\b', '\\bvirtuoso\\b', 'transistor[- ]level', '\\bamplifiers?\\b', 'low[- ]noise', 'comparators?',
      'noise analysis', '\\bserdes\\b', 'data converters?', 'monte carlo',
    ],
    intro:
      'Analog and mixed-signal engineers design circuits that handle continuous signals: amplifiers, filters, voltage references, data converters (ADCs and DACs), phase-locked loops and high-speed serial links. The work happens either on circuit boards or at the transistor level inside chips, and it rewards people who like both math and the lab bench.',
    work: [
      'Simulate circuits in SPICE (Cadence Spectre, LTspice) across process, voltage and temperature corners.',
      'Characterize silicon or boards in the lab: gain, bandwidth, noise, linearity and power.',
      'Help with the layout of analog blocks, where matching and parasitics matter.',
      'Automate bench measurements with Python and summarize results against the specification.',
    ],
    skills: [
      'Circuits fundamentals: op-amps, feedback, frequency response, stability and noise.',
      'Transistor intuition: MOSFET operating regions, small-signal models and biasing.',
      'A SPICE simulator (LTspice is free) and comfort reading simulation plots.',
      'Lab instruments: oscilloscope, function generator, spectrum analyzer, source-measure unit.',
      'Python or MATLAB for measurement analysis.',
    ],
    projects: [
      'Design and simulate a two-stage op-amp or an instrumentation amplifier in LTspice, build a discrete version, and compare measured gain and bandwidth with your simulation.',
      'Build an active audio filter and measure its Bode plot; explain every difference between the measured and ideal response.',
      'Characterize the ADC on a microcontroller: measure INL/DNL, noise and effective number of bits with a known input, and publish your scripts and data.',
    ],
  },
  {
    slug: 'rf',
    label: 'RF, microwave & wireless',
    short: 'RF/wireless',
    title: [
      '\\brf\\b', 'radio frequency', 'microwave', 'mm-?wave', 'millimeter[- ]wave', 'antennas?', '\\bradar', 'transceiver',
      'phased array', '\\bsatcom\\b', 'communications? (?:systems|hardware)', 'wireless (?:hardware|systems|engineer)',
    ],
    desc: [
      '\\brf\\b', 'antennas?', 'microwave', 'mm-?wave', '\\bvna\\b', 'network analy[sz]er', 's[- ]parameters?',
      'smith chart', '\\blnas?\\b', 'phased[- ]arrays?', 'beamforming', 'transceivers?', '\\bradar\\b', '\\bhfss\\b',
      'link budgets?', 'spectrum analy[sz]er', 'impedance matching', 'radio frequency',
    ],
    intro:
      'RF engineers work on circuits and systems at radio frequencies: antennas, transmitters, receivers, filters and amplifiers for radios, radar, satellites and wireless products. At these frequencies traces behave like transmission lines, so impedance matching and electromagnetic simulation are part of everyday work.',
    work: [
      'Run electromagnetic simulations of antennas, filters and transitions (HFSS, Sonnet, openEMS).',
      'Measure S-parameters with a vector network analyzer and tune matching networks.',
      'Support antenna and radio testing for satellites, radar or consumer devices.',
      'Write link-budget calculators and test-automation scripts.',
    ],
    skills: [
      'Electromagnetics, transmission lines and the Smith chart.',
      'S-parameters, gain, noise figure and linearity basics.',
      'Instruments: VNA, spectrum analyzer and signal generator.',
      'PCB layout for RF: controlled impedance, grounding and via fences.',
      'Python or MATLAB for analysis.',
    ],
    projects: [
      'Design a 2.4 GHz patch antenna, simulate it with a free field solver such as openEMS, have it fabricated on FR-4, and measure its return loss with a low-cost VNA.',
      'Use an RTL-SDR and GNU Radio to receive and decode ADS-B or FM, and document how gain settings and filtering change what you can decode.',
      'Design a microstrip low-pass filter, then compare simulated and measured S21.',
    ],
  },
  {
    slug: 'power',
    label: 'Power electronics',
    short: 'Power electronics',
    title: [
      'power electronics', 'power systems?', 'power conversion', 'power hardware', 'inverters?', 'dc[- ]dc', 'motor (?:control|drives?)',
      '\\bbattery', '\\bbms\\b', 'charging', 'high[- ]voltage', 'power (?:electrical )?engineer', 'electric(?:al)? power',
    ],
    desc: [
      'power electronics', 'dc[- ]dc', 'inverters?', 'converters?', 'gate drivers?', '\\bgan\\b', '\\bsic\\b(?! (?:erat|transit))',
      'motor (?:drives?|control)', 'battery (?:management|packs?|cells?|systems?)', '\\bbms\\b', 'chargers?', 'magnetics',
      'transformers?', 'high[- ]voltage', '\\bbuck\\b', '\\bboost converter', 'flyback', '\\bpfc\\b', 'switching regulators?',
    ],
    intro:
      'Power electronics engineers convert and control electrical energy efficiently: DC-DC converters, inverters, motor drives, battery management systems and chargers. The field sits behind electric vehicles, satellites, data centers, robots and the grid, and it mixes circuit design, magnetics, control and careful high-voltage lab practice.',
    work: [
      'Build and test converter prototypes; measure efficiency, ripple and thermal performance.',
      'Design gate-drive, current-sense and protection circuits.',
      'Simulate topologies in LTspice or PLECS before committing to hardware.',
      'Support battery pack and battery-management validation, often with test automation.',
    ],
    skills: [
      'Switching converter topologies (buck, boost, flyback) and why each is used.',
      'Device trade-offs between silicon MOSFETs, GaN and SiC.',
      'Control-loop basics and stability.',
      'Measurement technique: current probes, differential probes, thermal measurements.',
      'Respect for high-voltage and battery safety procedures.',
    ],
    projects: [
      'Design and build a synchronous buck converter (for example 12 V to 5 V at a few amps); plot efficiency against load and explain your layout choices.',
      'Build a small brushless or stepper motor driver with current sensing and closed-loop control on a microcontroller.',
      'Build a monitor for a 2S or 3S lithium-ion pack with cell voltage sensing, balancing logic and protection thresholds, and write down the safety precautions you followed.',
    ],
  },
  {
    slug: 'pcb',
    label: 'PCB & hardware design',
    short: 'PCB/hardware',
    title: [
      '\\bpcb', 'printed circuit', 'board design', 'hardware (?:design|engineer|engineering|r&d|development)', '\\bavionics\\b', 'electronics (?:engineer|design|hardware)', 'schematic', 'signal integrity',
      'electrical design', 'wire harness', 'harness design', 'circuit board', 'electrical hardware',
    ],
    desc: [
      '\\bpcba?s?\\b', 'printed circuit', 'electronic assembl(?:y|ies)', '\\bipc[- ]a?-?\\d{3}', 'schematics?', '\\baltium\\b', '\\bkicad\\b', '\\borcad\\b', '\\ballegro\\b',
      'board (?:layout|design|bring[- ]?up)', 'signal integrity', 'power integrity', 'high[- ]speed (?:design|digital|interfaces?|layout)',
      '\\bdfm\\b', 'component selection', '\\bsolder(?:ing|ed)?\\b', 'rework', 'bill of materials', '\\bbom\\b', 'wire harness(?:es)?',
    ],
    intro:
      'PCB and hardware design engineers turn a product idea into manufacturable electronics: choosing components, drawing schematics, laying out circuit boards, bringing up the first prototypes and debugging them. At product companies this job is often simply called hardware engineering or electrical engineering.',
    work: [
      'Draw schematics for a sub-board or accessory and review them with senior engineers.',
      'Lay out boards in Altium or KiCad, then order, assemble and bring up prototypes.',
      'Debug prototypes on the bench and write test procedures for them.',
      'Maintain bills of materials, find alternate parts and work through manufacturing (DFM) feedback.',
    ],
    skills: [
      'Circuits fundamentals and the habit of reading datasheets end to end.',
      'A schematic and layout tool; KiCad is free and widely accepted for student projects.',
      'Power regulation, decoupling and grounding.',
      'Signal-integrity basics for fast edges and high-speed interfaces.',
      'Soldering, rework and systematic bench debugging.',
    ],
    projects: [
      'Design a four-layer microcontroller development board in KiCad (USB-C power, regulator, microcontroller, headers), get it fabricated, and document every bring-up problem and fix.',
      'Make a breakout board for an I2C sensor with a small firmware demo, a design-for-manufacturing checklist and a bill of materials with alternate parts.',
      'Tear down an inexpensive consumer gadget, trace its power tree and main chips, and publish a short teardown report.',
    ],
  },
  {
    slug: 'test',
    label: 'Test, validation & reliability',
    short: 'Test/validation',
    title: [
      '(?:hardware|product|design|system|electrical|silicon|board|post[- ]silicon) validation', '\\bv&v\\b', 'reliability',
      'integration (?:and|&) test', '\\bi&t\\b', '\\bhil\\b', '\\bhitl\\b', 'hardware[- ]in[- ]the[- ]loop', 'bring[- ]?up',
      'characterization', 'failure analysis', 'radiation effects', 'post[- ]silicon', 'hardware test', 'production test',
    ],
    titleWeak: ['test (?:engineer|engineering|technician|automation|development|systems?)', '\\bvalidation', 'qualification', 'quality engineer'],
    desc: [
      'test (?:fixtures?|automation|plans?|procedures?|stations?|equipment|benches?|racks?)', '\\bvalidation\\b', 'characteri[sz](?:e|es|ed|ing|ation)\\b',
      '\\bhil\\b', 'hardware[- ]in[- ]the[- ]loop', '\\bate\\b', '\\bpyvisa\\b', '\\bscpi\\b', '\\blabview\\b', 'burn[- ]in',
      'environmental test(?:ing)?', 'thermal cycling', 'vibration test(?:ing)?', 'reliability', 'failure analysis',
      'bring[- ]?up', '\\bevt\\b', '\\bdvt\\b', '\\bpvt\\b',
    ],
    intro:
      'Test and validation engineers prove that hardware works and keeps working: bench validation of new designs, automated production test, environmental and reliability testing, hardware-in-the-loop rigs, silicon validation and failure analysis. It is one of the most common entry points into hardware teams because every product needs it.',
    work: [
      'Write automated tests in Python that control instruments over SCPI or PyVISA.',
      'Build fixtures and harnesses for boards, modules or whole vehicles.',
      'Run thermal, vibration, radiation or burn-in tests and analyze the data.',
      'Investigate failures and write clear reports that designers can act on.',
    ],
    skills: [
      'Python, including pandas and plotting, for test automation and analysis.',
      'Comfort with power supplies, multimeters, oscilloscopes and electronic loads.',
      'Wiring, crimping and soldering for fixtures and harnesses.',
      'Basic statistics for yield and process capability.',
      'Careful documentation and a curiosity about how things fail.',
    ],
    projects: [
      'Automate a bench measurement: control a power supply and multimeter from Python to sweep a regulator\'s load, then plot efficiency and regulation.',
      'Build a small hardware-in-the-loop rig in which one microcontroller emulates sensors for another board and checks its responses automatically.',
      'Run a small reliability study (for example, thermal cycling of inexpensive parts), log the data and write up what degraded and why.',
    ],
  },
  {
    slug: 'controls',
    label: 'Controls, robotics & GNC',
    short: 'Controls/robotics',
    title: [
      '\\bcontrols?\\b', 'control systems?', 'robotics?', '\\brobot\\b', 'mechatronics?', '\\bgnc\\b', 'guidance',
      'motion control', '\\bplc\\b', 'electromechanical', 'instrumentation (?:and|&) control',
    ],
    titleWeak: ['\\bnavigation', 'automation engineer'],
    desc: [
      'control (?:systems?|theory|loops?|algorithms?|laws?)', '\\bpid\\b', 'kalman', 'state estimation', 'sensor fusion', '\\bros ?2?\\b',
      'robotics?', 'actuators?', 'servos?', 'kinematics', 'simulink', '\\bmpc\\b', 'motion planning', '\\bgnc\\b',
      'mechatronics?', '\\bplcs?\\b', 'encoders?', '\\bimus?\\b',
    ],
    intro:
      'Controls and robotics engineers make physical systems behave: feedback control, state estimation, motion planning, and the sensors and actuators that close the loop. The same skills run robot arms, humanoids, drones, cars and spacecraft, where the field is called guidance, navigation and control (GNC).',
    work: [
      'Tune controllers on real hardware and compare the results with a model.',
      'Build simulations in MATLAB/Simulink, Python, Gazebo or MuJoCo.',
      'Write sensor-fusion code, such as a Kalman filter combining an IMU with other sensors.',
      'Integrate motors, encoders and IMUs, then log and analyze test data.',
    ],
    skills: [
      'Signals and systems, feedback control (PID and state-space) and linear algebra.',
      'Python or MATLAB for modeling; C++ for real-time code.',
      'ROS basics if you are aiming at robotics companies.',
      'Hands-on experience with motors, drivers and sensors.',
    ],
    projects: [
      'Build a self-balancing robot or ball-on-beam system with a PID controller; document your tuning with step-response plots and a model comparison.',
      'Estimate orientation from an IMU with a complementary or Kalman filter on a microcontroller, and validate it against a reference.',
      'Simulate a quadrotor or small rover with a controller in Python, then port the controller to real hardware and compare.',
    ],
  },
  {
    slug: 'process',
    label: 'Semiconductor process & devices',
    short: 'Semi process/device',
    title: [
      'process integration', 'device (?:engineer|engineering|physics|characterization)',
      'lithography', '\\betch\\b', 'deposition', 'thin[- ]films?', 'metrology', '\\byield\\b', '\\bmems\\b', 'wafer',
      'semiconductor (?:process|device|fab)', '\\btcad\\b', 'advanced packaging', 'cleanroom', 'microfabrication', 'nanofabrication',
    ],
    // Ambiguous outside semiconductors (chemical plants, battery recycling): needs category or description support.
    titleWeak: ['process (?:engineer|engineering|development)', 'packaging (?:engineer|engineering)'],
    titleNeedsContext: true,
    desc: [
      'photolithography', 'lithography', '\\betch(?:ing)?\\b', 'deposition', '\\bcvd\\b', '\\bpvd\\b', '\\bald\\b', '\\bcmp\\b',
      'thin[- ]films?', 'metrology', 'clean ?room', 'wafers?', '\\btcad\\b', 'device physics',
      'semiconductor (?:process|devices?|fabrication|manufacturing)', '\\bmems\\b', 'advanced packaging', 'wire ?bond(?:ing)?',
      'flip[- ]chip', '\\bspc\\b', 'design of experiments', 'microfabrication',
    ],
    intro:
      'Process and device engineers make and understand what is on the wafer: lithography, deposition, etch, doping, metrology and yield, plus the physics of transistors, memories, sensors (MEMS) and advanced packaging. It suits people who like physics, chemistry and data as much as circuits.',
    work: [
      'Run and monitor fabrication steps and keep processes within control limits.',
      'Analyze metrology and yield data, often with statistical process control.',
      'Design experiments that tune a process step and report the results.',
      'Characterize devices electrically (current-voltage and capacitance-voltage curves) and support packaging or failure analysis.',
    ],
    skills: [
      'Solid-state device physics and materials science basics.',
      'Any cleanroom or microfabrication lab experience you can get through coursework.',
      'Statistics: design of experiments and statistical process control.',
      'Python or JMP for data analysis, with clear lab notebooks.',
    ],
    projects: [
      'If your school offers a cleanroom or microfabrication lab course, take it and publish a clear write-up of the full process flow you ran and what each step did.',
      'Measure current-voltage curves of diodes and MOSFETs with a source-measure unit or a homemade curve tracer, extract parameters such as threshold voltage, and compare them with the datasheet.',
      'Analyze a public wafer-map dataset such as WM-811K: classify defect patterns and explain what process problems each pattern suggests.',
    ],
  },
  {
    slug: 'photonics',
    label: 'Photonics & optics',
    short: 'Photonics/optics',
    title: ['photonics?', '\\boptical', '\\boptics\\b', '\\blasers?\\b', '\\blidar', 'optoelectronics?', 'fiber optics?', 'photonic'],
    desc: [
      'photonics?', 'silicon photonics', 'optical (?:engineering|design|systems?|interconnects?|components?|fibers?|testing|alignment|packaging|link)',
      '\\boptics\\b', '\\blasers?\\b', '\\blidar\\b', 'waveguides?', 'photodetectors?', 'fiber[- ]optics?', '\\blumerical\\b',
      '\\bzemax\\b', 'optoelectronics?', 'interferometers?', 'spectrometers?', 'free[- ]space optic',
    ],
    intro:
      'Photonics and optics engineers generate, guide and detect light: lasers, optical fibers, silicon photonics, lidar, camera optics and optical interconnects for data centers and quantum computers. Interns usually split time between optical benches and simulation.',
    work: [
      'Align and characterize optical setups; measure insertion loss, spectra and power.',
      'Simulate waveguides and resonators with FDTD or eigenmode solvers.',
      'Test lidar, camera or optical-link modules and automate the measurements.',
      'Help with optical packaging and fiber attach.',
    ],
    skills: [
      'Electromagnetic waves and optics coursework.',
      'Laser safety training and patient alignment skills.',
      'Python or MATLAB for analysis; simulation tools such as MEEP, Lumerical or Zemax.',
      'Basics of photodetectors, lasers and noise.',
    ],
    projects: [
      'Build a simple spectrometer from a diffraction grating and a camera, calibrate it with known light sources, and report its resolution.',
      'Simulate a silicon waveguide or ring resonator in MEEP (free) and compare the modes or resonances with theory.',
      'Characterize a time-of-flight distance sensor module: accuracy versus distance and target color, with plots and an error analysis.',
    ],
  },
];

export const GENERAL = { slug: 'general', ...DISCIPLINE_LABELS.general };

export const DISCIPLINE_BY_SLUG = Object.fromEntries([...DISCIPLINES, GENERAL].map((d) => [d.slug, d]));

export function disciplineLabel(slug, { short = true } = {}) {
  const d = DISCIPLINE_LABELS[slug];
  if (!d) return slug;
  return short ? d.short : d.label;
}

// Keep the long-form entries in sync with the shared label table.
for (const d of DISCIPLINES) {
  if (!DISCIPLINE_LABELS[d.slug] || DISCIPLINE_LABELS[d.slug].short !== d.short || DISCIPLINE_LABELS[d.slug].label !== d.label) {
    throw new Error(`labels.mjs out of sync for ${d.slug}`);
  }
}
