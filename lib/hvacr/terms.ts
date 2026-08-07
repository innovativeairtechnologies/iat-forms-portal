/* Key terms per subject, for the flashcard exercise.
 *
 * GENERATED FILE — run `node scripts/gen-hvacr-course.mjs`.
 * Source: scripts/hvacr-course/modules.json
 *
 * Keyed by the source module id, which is what the lesson marker's
 * `data-module` carries.
 */

export type KeyTerm = { term: string; def: string }

export const KEY_TERMS: Record<string, KeyTerm[]> = {
  "safety": [
    {
      "term": "Lockout/Tagout (LOTO)",
      "def": "A safety procedure that isolates and locks out energy sources before servicing equipment, preventing accidental re-energization while a technician is exposed to hazards."
    },
    {
      "term": "Arc Flash",
      "def": "A dangerous release of energy caused by an electrical fault through air, producing intense heat, light, and pressure that can cause severe burns without direct contact."
    },
    {
      "term": "Asphyxiation",
      "def": "Oxygen deprivation that can occur when a refrigerant leak displaces breathable air in an enclosed or confined space, often with no warning odor."
    },
    {
      "term": "Frostbite (refrigerant)",
      "def": "Rapid tissue freezing caused by skin contact with liquid refrigerant, which boils at very low temperatures at atmospheric pressure."
    },
    {
      "term": "A2L Refrigerant",
      "def": "An ASHRAE 34 classification for a lower-toxicity, mildly flammable refrigerant with a low burning velocity, such as R-32 or R-454B, now common in new HVAC equipment."
    },
    {
      "term": "ASHRAE 34 Safety Classification",
      "def": "A two-part rating system for refrigerants combining toxicity (A = lower, B = higher) and flammability (1 = none, 2L = mildly flammable, 2 = flammable, 3 = highly flammable)."
    },
    {
      "term": "Hydrostatic Test",
      "def": "A periodic pressure test (required roughly every 5 years for refillable refrigerant cylinders in the U.S.) that verifies a pressure vessel can safely hold its rated pressure."
    },
    {
      "term": "General Duty Clause",
      "def": "An OSHA requirement that employers provide a workplace free of recognized serious hazards, even when no specific OSHA standard directly addresses that hazard."
    },
    {
      "term": "Confined Space",
      "def": "A work area with limited entry/exit and the potential for a hazardous atmosphere, requiring atmospheric testing and permit procedures before entry."
    },
    {
      "term": "Brazing",
      "def": "A metal-joining process using filler metal with a melting point above 840°F, commonly used to join copper refrigeration tubing, typically while purging with dry nitrogen."
    },
    {
      "term": "DOT-39 Cylinder",
      "def": "A non-refillable disposable refrigerant recovery cylinder regulated by the Department of Transportation; it must never be refilled or reused beyond its rated capacity."
    },
    {
      "term": "PPE Category (NFPA 70E)",
      "def": "A classification (0-4) of required arc-flash protective equipment based on the incident energy exposure of a specific electrical task."
    }
  ],
  "thermodynamics": [
    {
      "term": "Sensible Heat",
      "def": "Heat that changes a substance's temperature without changing its phase; the change can be measured directly with a thermometer."
    },
    {
      "term": "Latent Heat",
      "def": "Heat absorbed or released during a phase change (melting, boiling, condensing, freezing) at a constant temperature."
    },
    {
      "term": "Specific Heat",
      "def": "The amount of heat, in Btu, required to raise one pound of a substance by one degree Fahrenheit."
    },
    {
      "term": "Saturation Temperature",
      "def": "The temperature at which a substance boils or condenses at a given pressure; liquid and vapor coexist in equilibrium at this point."
    },
    {
      "term": "Superheat",
      "def": "The number of degrees a vapor's actual temperature exceeds its saturation temperature at the measured pressure, confirming full vaporization."
    },
    {
      "term": "Subcooling",
      "def": "The number of degrees a liquid's actual temperature is below its saturation temperature at the measured pressure, confirming full condensation."
    },
    {
      "term": "Conduction",
      "def": "Heat transfer through direct physical contact within or between materials, such as through a solid tube wall."
    },
    {
      "term": "Convection",
      "def": "Heat transfer via the bulk motion of a fluid, such as air moved by a fan across a coil or water pumped through piping."
    },
    {
      "term": "Radiation (thermal)",
      "def": "Heat transfer via electromagnetic waves that requires no physical medium or contact between the heat source and receiver."
    },
    {
      "term": "Pressure-Temperature (P-T) Chart",
      "def": "A reference chart listing the fixed saturation temperature corresponding to each pressure for a specific refrigerant."
    },
    {
      "term": "Temperature Glide",
      "def": "The difference between the bubble point and dew point temperatures of a non-azeotropic refrigerant blend at a given pressure."
    },
    {
      "term": "Second Law of Thermodynamics",
      "def": "A physical law stating heat flows spontaneously only from higher to lower temperature; moving it the opposite direction requires external work."
    }
  ],
  "refrigeration-cycle": [
    {
      "term": "Compression",
      "def": "The process in which the compressor raises refrigerant vapor from low pressure/temperature to high pressure/temperature."
    },
    {
      "term": "Condensation",
      "def": "The process in which high-pressure refrigerant vapor rejects heat and changes phase into high-pressure liquid inside the condenser."
    },
    {
      "term": "Metering Device",
      "def": "A component (TXV, capillary tube, or electronic expansion valve) that drops refrigerant pressure and temperature sharply between the condenser and evaporator."
    },
    {
      "term": "Evaporation",
      "def": "The process in which low-pressure liquid refrigerant absorbs heat and boils into vapor inside the evaporator coil."
    },
    {
      "term": "High Side",
      "def": "The portion of a refrigeration system from the compressor discharge through the condenser to the metering device, operating at condensing pressure."
    },
    {
      "term": "Low Side",
      "def": "The portion of a refrigeration system from the metering device outlet through the evaporator to the compressor suction, operating at evaporating pressure."
    },
    {
      "term": "Pressure-Enthalpy (P-H) Diagram",
      "def": "A chart plotting refrigerant pressure against enthalpy, used to visualize the four cycle processes and calculate refrigeration effect and work of compression."
    },
    {
      "term": "Saturation Dome",
      "def": "The curved region on a P-H diagram inside which refrigerant exists as a liquid/vapor mixture, bounded by the subcooled liquid and superheated vapor regions."
    },
    {
      "term": "Reversing Valve",
      "def": "A four-way valve in a heat pump that redirects refrigerant flow to swap the functional roles of the indoor and outdoor coils between heating and cooling mode."
    },
    {
      "term": "Absorption Refrigeration",
      "def": "A refrigeration method that uses a heat source and an absorbent fluid pair to drive the cycle instead of a mechanical vapor compressor."
    },
    {
      "term": "Refrigeration Effect",
      "def": "The amount of heat absorbed by the refrigerant per unit mass as it passes through the evaporator, represented by the horizontal distance traveled on a P-H diagram during evaporation."
    },
    {
      "term": "Discharge Line",
      "def": "The tubing carrying hot, high-pressure refrigerant vapor from the compressor outlet to the condenser inlet."
    }
  ],
  "refrigerants-regulations": [
    {
      "term": "Ozone Depletion Potential (ODP)",
      "def": "A relative measure of a substance's ability to destroy stratospheric ozone, indexed against R-11 (CFC-11), which has an ODP of 1.0."
    },
    {
      "term": "Global Warming Potential (GWP)",
      "def": "A relative measure of a gas's contribution to atmospheric warming over a set time horizon compared to carbon dioxide, which has a GWP of 1."
    },
    {
      "term": "Zeotropic Blend",
      "def": "A mixture of two or more refrigerants that does not behave as a single substance, exhibiting a temperature glide between its bubble point and dew point at a given pressure."
    },
    {
      "term": "Azeotropic Blend",
      "def": "A mixture of refrigerants that behaves essentially as a single substance with one boiling point at a given pressure, showing negligible temperature glide."
    },
    {
      "term": "HCFC (Hydrochlorofluorocarbon)",
      "def": "A transitional refrigerant class, such as R-22, containing chlorine and having lower but nonzero ozone depletion potential; phased out under the Montreal Protocol."
    },
    {
      "term": "HFC (Hydrofluorocarbon)",
      "def": "A refrigerant class, such as R-410A and R-134a, containing no chlorine (zero ODP) but often carrying high global warming potential."
    },
    {
      "term": "HFO (Hydrofluoroolefin)",
      "def": "An unsaturated fluorine-containing refrigerant compound, such as R-1234yf, with zero ODP and very low GWP, often mildly flammable (A2L)."
    },
    {
      "term": "AIM Act",
      "def": "The American Innovation and Manufacturing Act of 2020, which authorizes EPA to phase down HFC production and consumption in the U.S. against a 2012 baseline."
    },
    {
      "term": "EPA Technology Transitions Rule",
      "def": "An EPA rule under the AIM Act requiring newly manufactured residential/light commercial AC and heat pump equipment to use refrigerant with GWP of 700 or lower as of January 1, 2025."
    },
    {
      "term": "Kigali Amendment",
      "def": "An international amendment to the Montreal Protocol requiring signatory countries to phase down HFC production and consumption globally."
    },
    {
      "term": "Montreal Protocol",
      "def": "An international treaty (1987) that phased out ozone-depleting substances including CFCs and later HCFCs."
    },
    {
      "term": "Near-Azeotropic Blend",
      "def": "A blend of refrigerants that behaves nearly like a pure substance with minimal temperature glide, such as R-410A."
    }
  ],
  "compressors": [
    {
      "term": "Compression ratio",
      "def": "The ratio of absolute discharge pressure to absolute suction pressure, indicating the mechanical workload placed on the compressor."
    },
    {
      "term": "Hermetic compressor",
      "def": "A compressor whose motor and pumping mechanism are sealed inside a welded steel shell and are not field-repairable internally."
    },
    {
      "term": "Semi-hermetic compressor",
      "def": "A compressor with a bolted, removable housing that allows field service of valves and internal components while the motor still operates in the refrigerant atmosphere."
    },
    {
      "term": "Open-drive compressor",
      "def": "A compressor with an external motor connected to the compressor shaft via a coupling or belt and a shaft seal, common on industrial systems."
    },
    {
      "term": "Flooded start",
      "def": "A startup condition where liquid refrigerant has migrated into the crankcase during the off-cycle, diluting the oil and risking mechanical damage when the compressor starts."
    },
    {
      "term": "Slugging",
      "def": "The entry of liquid refrigerant or oil into a compressor cylinder during operation, producing a hydraulic hammering effect that can break internal parts."
    },
    {
      "term": "Short cycling",
      "def": "Rapid, repeated on/off cycling of a compressor that stresses the motor windings and electrical contacts and shortens equipment life."
    },
    {
      "term": "Crankcase heater",
      "def": "A resistance heater on the compressor shell that keeps oil warm during the off-cycle to prevent refrigerant migration and flooded starts."
    },
    {
      "term": "Megohm test",
      "def": "An insulation resistance test using a megohmmeter to check for winding-to-ground breakdown or moisture contamination in a compressor motor."
    },
    {
      "term": "Volumetric efficiency",
      "def": "The ratio of the refrigerant vapor a compressor actually pumps compared to its theoretical displacement; it decreases as compression ratio increases."
    },
    {
      "term": "Two-stage (booster) compression",
      "def": "Compressing refrigerant vapor in two steps using two compressors to reach very low evaporator temperatures without requiring an excessive single-stage compression ratio."
    },
    {
      "term": "Scroll compressor",
      "def": "A compressor using two interleaving spiral-shaped scrolls, one fixed and one orbiting, that trap and compress refrigerant vapor as it moves toward the center."
    }
  ],
  "condensers": [
    {
      "term": "Desuperheating zone",
      "def": "The portion of the condenser coil where hot discharge vapor is cooled down to its saturation temperature before condensing begins."
    },
    {
      "term": "Condensing zone",
      "def": "The portion of the condenser coil where refrigerant changes phase from vapor to liquid at roughly constant temperature and pressure, releasing latent heat."
    },
    {
      "term": "Subcooling",
      "def": "The number of degrees a liquid refrigerant has been cooled below its saturation temperature at a given pressure, ensuring solid liquid feed to the metering device."
    },
    {
      "term": "Non-condensables",
      "def": "Gases such as air or nitrogen trapped in a refrigeration system that do not condense at operating pressures, raising head pressure abnormally."
    },
    {
      "term": "Head pressure",
      "def": "The discharge-side (high-side) pressure of a refrigeration system, largely determined by condensing temperature."
    },
    {
      "term": "Cooling tower",
      "def": "A structure that rejects heat from a water loop to the atmosphere, typically through evaporative cooling of a portion of the circulated water."
    },
    {
      "term": "Evaporative condenser",
      "def": "A condenser that sprays water over refrigerant coils while air passes across them, using evaporative cooling to achieve lower condensing temperatures than air alone."
    },
    {
      "term": "Flooded condenser head pressure control",
      "def": "A control strategy that backs liquid refrigerant up into part of the condenser coil to reduce effective condensing surface and maintain adequate head pressure in cold weather."
    },
    {
      "term": "Shell-and-tube condenser",
      "def": "A water-cooled condenser design in which refrigerant vapor condenses around a bundle of tubes carrying circulated cooling water."
    },
    {
      "term": "Fan cycling control",
      "def": "A head pressure control method that turns condenser fans on and off based on pressure or temperature to regulate airflow and head pressure."
    },
    {
      "term": "Saturation temperature",
      "def": "The temperature at which a refrigerant changes phase (boils or condenses) at a given pressure, found using a pressure-temperature (P-T) chart."
    },
    {
      "term": "Condensing temperature",
      "def": "The saturation temperature corresponding to the high-side (discharge) pressure, at which refrigerant vapor is condensing to liquid in the condenser."
    }
  ],
  "metering-devices": [
    {
      "term": "Metering device",
      "def": "The component between the condenser and evaporator that creates the system's pressure drop and controls refrigerant flow rate into the evaporator."
    },
    {
      "term": "Capillary tube",
      "def": "A fixed-length, fixed-diameter tube that passively restricts refrigerant flow with no moving parts, requiring a precise critical refrigerant charge."
    },
    {
      "term": "Piston/orifice (fixed orifice) valve",
      "def": "A metering device using a fixed-diameter orifice in a removable piston that restricts flow without actively adjusting to load."
    },
    {
      "term": "Thermostatic expansion valve (TXV)",
      "def": "A metering device that actively modulates refrigerant flow using a bulb, diaphragm, and spring to maintain a target evaporator superheat across varying loads."
    },
    {
      "term": "Superheat",
      "def": "The number of degrees refrigerant vapor has been heated above its saturation temperature at a given pressure."
    },
    {
      "term": "Bulb charge",
      "def": "The refrigerant-based fill inside a TXV's remote sensing bulb that generates the opening (pressure) force in response to suction line temperature."
    },
    {
      "term": "Internally equalized TXV",
      "def": "A TXV that senses evaporator pressure at its own outlet port, suitable for evaporators with low internal pressure drop."
    },
    {
      "term": "Externally equalized TXV",
      "def": "A TXV that senses evaporator pressure via a separate tube connected at the evaporator outlet, compensating for coil pressure drop in longer or multi-circuit coils."
    },
    {
      "term": "Electronic expansion valve (EEV)",
      "def": "A metering device that uses a stepper motor controlled by an electronic superheat controller and sensors, rather than a mechanical bulb-diaphragm-spring assembly."
    },
    {
      "term": "Overfeeding",
      "def": "A metering device condition that supplies too much refrigerant to the evaporator, producing low superheat and risk of liquid floodback to the compressor."
    },
    {
      "term": "Underfeeding",
      "def": "A metering device condition that supplies too little refrigerant to the evaporator, producing high superheat, reduced capacity, and a starved coil."
    },
    {
      "term": "Flash gas",
      "def": "Refrigerant vapor that forms prematurely in the liquid line, upstream of the metering device, reducing usable liquid refrigerant and metering device capacity."
    }
  ],
  "evaporators": [
    {
      "term": "Direct expansion (DX) evaporator",
      "def": "An evaporator design where refrigerant fully vaporizes and leaves the coil with measurable superheat, with flow controlled directly by the metering device."
    },
    {
      "term": "Flooded evaporator",
      "def": "An evaporator design that stays full of liquid refrigerant, using a surge drum to separate liquid from vapor rather than relying on outlet superheat."
    },
    {
      "term": "TD (temperature difference)",
      "def": "The difference between entering air temperature and evaporator saturation temperature, used as a field rule of thumb for coil sizing and dehumidification behavior."
    },
    {
      "term": "Saturation temperature",
      "def": "The temperature at which refrigerant boils or condenses at a given pressure, read from a pressure-temperature (P-T) chart."
    },
    {
      "term": "Sensible heat",
      "def": "Heat that changes a substance's measurable (dry-bulb) temperature without changing its moisture content or phase."
    },
    {
      "term": "Latent heat",
      "def": "Heat absorbed or released during a phase change (such as boiling, condensing, or freezing) without a change in temperature."
    },
    {
      "term": "Dew point",
      "def": "The temperature at which air becomes saturated with moisture and further cooling causes condensation."
    },
    {
      "term": "Defrost cycle",
      "def": "A scheduled or controlled process that periodically melts frost/ice accumulated on a sub-freezing evaporator coil to restore airflow and capacity."
    },
    {
      "term": "Hot gas defrost",
      "def": "A defrost method that routes hot compressor discharge gas through the evaporator coil to melt frost, common on low-temperature freezer applications."
    },
    {
      "term": "Infiltration load",
      "def": "The sensible and latent heat load introduced when outside or warmer air enters a refrigerated space, typically through door openings or gaps."
    },
    {
      "term": "Product load",
      "def": "The heat that must be removed from product entering a refrigerated space above the space's storage temperature."
    },
    {
      "term": "Respiration load",
      "def": "Heat generated by living produce continuing biological respiration even while in cold storage."
    }
  ],
  "system-components": [
    {
      "term": "Filter-Drier",
      "def": "A liquid line device containing desiccant and a filter screen that removes moisture, acid, and particulate contamination from refrigerant."
    },
    {
      "term": "Suction Accumulator",
      "def": "A vessel in the suction line that traps liquid refrigerant and oil, metering it back slowly to protect the compressor from liquid slugging."
    },
    {
      "term": "Receiver",
      "def": "A storage vessel for liquid refrigerant downstream of the condenser that provides a reserve charge for the metering device."
    },
    {
      "term": "King Valve",
      "def": "The manual shutoff valve at a receiver's outlet, used to isolate the receiver during a pump-down or service procedure."
    },
    {
      "term": "Oil Separator",
      "def": "A discharge line device that removes entrained oil from hot refrigerant vapor and returns it to the compressor crankcase."
    },
    {
      "term": "Solenoid Valve",
      "def": "An electrically actuated valve used to start or stop refrigerant flow, commonly for liquid line pump-down control or hot gas defrost."
    },
    {
      "term": "Check Valve",
      "def": "A one-way valve that permits flow in only one direction, used in heat pump circuits to bypass metering devices depending on flow direction."
    },
    {
      "term": "Sight Glass",
      "def": "A viewing window in the liquid line used to check for flash gas (bubbles) and, if equipped, a moisture indicator color change."
    },
    {
      "term": "Flash Gas",
      "def": "Vapor bubbles appearing in the liquid line, typically indicating low charge, a restriction, or non-condensables in the system."
    },
    {
      "term": "Pump-Down Cycle",
      "def": "A control strategy that closes a liquid line solenoid to draw refrigerant out of the low side and store it in the receiver/condenser before the compressor stops."
    },
    {
      "term": "Liquid Slugging",
      "def": "The condition where liquid refrigerant or oil enters the compressor cylinder, causing mechanical damage since liquid cannot compress like a vapor."
    },
    {
      "term": "Service Valve",
      "def": "A manual or gauge-port valve, such as at the compressor suction/discharge or receiver outlet, used to access the system for gauges, recovery, or evacuation."
    }
  ],
  "electrical-fundamentals": [
    {
      "term": "Voltage",
      "def": "The electrical potential difference that pushes current through a circuit, measured in volts."
    },
    {
      "term": "Current",
      "def": "The rate of electron flow through a circuit, measured in amperes (amps)."
    },
    {
      "term": "Resistance",
      "def": "Opposition to current flow within a circuit, measured in ohms, described by Ohm's law (E = I x R)."
    },
    {
      "term": "Contactor",
      "def": "An electromechanical switch using a low-voltage coil to control high-current line voltage loads such as compressors and condenser fans."
    },
    {
      "term": "Run Capacitor",
      "def": "A capacitor that remains in circuit while a PSC motor runs, shifting current phase to improve running torque and efficiency."
    },
    {
      "term": "Start Capacitor",
      "def": "A high-capacitance component that provides a temporary boost of starting torque and is switched out of the circuit once the motor reaches running speed."
    },
    {
      "term": "PSC Motor",
      "def": "Permanent split capacitor motor; a fixed-speed single-phase induction motor design using a run capacitor, common in older condenser fans and blowers."
    },
    {
      "term": "ECM Motor",
      "def": "Electronically commutated motor; a variable-speed brushless DC motor with an integrated electronic control module, offering higher efficiency than PSC motors."
    },
    {
      "term": "Transformer",
      "def": "A device that steps voltage up or down via magnetic induction between windings, commonly used to step line voltage down to 24V control voltage."
    },
    {
      "term": "Single-Phasing",
      "def": "A failure condition on three-phase equipment where one incoming phase is lost, causing the motor to overheat while running on the remaining phases."
    },
    {
      "term": "Ladder Diagram",
      "def": "A wiring diagram format showing control circuit rungs between two power rails, used to trace how switches and loads are wired in series and parallel."
    },
    {
      "term": "Continuity",
      "def": "A complete, unbroken electrical path through a component or wire, typically confirmed with a multimeter's continuity or low-resistance function."
    }
  ],
  "controls-safety-devices": [
    {
      "term": "Thermostat",
      "def": "A control device that senses temperature and signals equipment to run or stop in order to maintain a setpoint."
    },
    {
      "term": "Low-Pressure Control (LPC)",
      "def": "A control that monitors suction pressure and stops the compressor below a set point, used for evaporator freeze protection or as a pump-down operating control."
    },
    {
      "term": "High-Pressure Control (HPC)",
      "def": "A control that monitors discharge pressure and stops the compressor above a set point to protect the compressor and system from excessive pressure."
    },
    {
      "term": "Demand Defrost",
      "def": "A defrost strategy that initiates defrost cycles based on actual detected frost accumulation rather than a fixed time schedule."
    },
    {
      "term": "Hot Gas Defrost",
      "def": "A defrost method that redirects hot compressor discharge gas through the evaporator coil to melt frost using the refrigerant's own heat."
    },
    {
      "term": "Reverse Cycle Defrost",
      "def": "A heat pump defrost method that temporarily reverses the refrigerant cycle so hot discharge gas melts frost on the outdoor coil."
    },
    {
      "term": "Oil Pressure Safety Switch",
      "def": "A safety device that shuts down a compressor if adequate oil pump differential pressure is not established within a time delay after start."
    },
    {
      "term": "Motor Overload",
      "def": "A safety device (internal or external to the motor) that opens the circuit to protect windings from overcurrent or overtemperature conditions."
    },
    {
      "term": "Freeze Stat",
      "def": "A safety control that senses low coil or air temperature and shuts down equipment to prevent a coil from freezing and rupturing."
    },
    {
      "term": "Fusible Plug",
      "def": "A safety device with a metal alloy that melts at a set temperature to vent refrigerant and relieve pressure during a fire or extreme overpressure event."
    },
    {
      "term": "Relief Valve",
      "def": "A spring-loaded valve that opens at a set pressure to relieve overpressure and recloses once pressure drops, protecting a vessel or component."
    },
    {
      "term": "Pump-Down Cycle",
      "def": "A control sequence where the liquid line solenoid closes and the compressor continues running to draw down low-side refrigerant before shutting off."
    }
  ],
  "psychrometrics-dehumidification": [
    {
      "term": "Dry-bulb temperature",
      "def": "The temperature of air as measured by a standard thermometer, unaffected by the air's moisture content."
    },
    {
      "term": "Wet-bulb temperature",
      "def": "The temperature read by a thermometer with a water-saturated wick exposed to moving air; it equals dry-bulb only at 100% RH and is lower otherwise due to evaporative cooling."
    },
    {
      "term": "Dew point",
      "def": "The temperature at which air, cooled at constant moisture content, becomes fully saturated (100% RH) and begins to condense water on any surface at or below that temperature."
    },
    {
      "term": "Relative humidity (RH)",
      "def": "The ratio of the actual water vapor in air to the maximum it could hold at the same dry-bulb temperature, expressed as a percentage; it changes with temperature even if actual moisture content stays constant."
    },
    {
      "term": "Humidity ratio (absolute humidity)",
      "def": "The actual mass of water vapor per unit mass of dry air (e.g., grains per pound), a measure of true moisture content that does not change with temperature alone."
    },
    {
      "term": "Enthalpy",
      "def": "The total heat content of moist air, combining sensible and latent heat, expressed in Btu per pound of dry air; used to calculate total cooling or heating loads."
    },
    {
      "term": "Saturation curve",
      "def": "The boundary line on a psychrometric chart representing 100% relative humidity; air states cannot exist beyond this curve without condensation occurring."
    },
    {
      "term": "Sensible Heat Ratio (SHR)",
      "def": "The fraction of total cooling capacity that removes sensible heat (temperature) rather than latent heat (moisture); dedicated dehumidifiers are designed for a low SHR to maximize moisture removal."
    },
    {
      "term": "Latent heat",
      "def": "Heat absorbed or released during a change of state (such as water vapor condensing to liquid) without a change in temperature during the phase change."
    },
    {
      "term": "DX coil (direct expansion coil)",
      "def": "An evaporator coil in a vapor-compression refrigeration circuit where refrigerant expands directly inside the coil tubing to absorb heat from air passing over it."
    },
    {
      "term": "Desiccant",
      "def": "A hygroscopic material, such as silica gel or lithium chloride, that attracts and holds water vapor from air through adsorption or absorption rather than by cooling the air."
    },
    {
      "term": "Reactivation (regeneration)",
      "def": "The process of heating a saturated desiccant to drive off absorbed moisture so it can be reused to dehumidify additional air."
    }
  ],
  "system-types-applications": [
    {
      "term": "Domestic refrigeration",
      "def": "Household refrigerators and freezers, typically sealed, factory-charged systems with a capillary tube metering device and no field service ports on most models."
    },
    {
      "term": "Multiplex (rack) system",
      "def": "A centralized commercial refrigeration configuration where multiple compressors piped in parallel serve many display cases and walk-ins throughout a store, typically split into medium-temperature and low-temperature racks."
    },
    {
      "term": "Reversing valve",
      "def": "A four-way solenoid valve in a heat pump that redirects refrigerant flow to switch the system between cooling mode and heating mode."
    },
    {
      "term": "Balance point",
      "def": "The outdoor temperature at which a heat pump's heating capacity exactly matches a building's heat loss; below this temperature, supplemental heat is required."
    },
    {
      "term": "Supplemental (auxiliary) heat",
      "def": "Backup heat source, such as electric resistance strips or a fossil-fuel furnace, used by a heat pump system when outdoor temperatures fall below the balance point."
    },
    {
      "term": "Chiller",
      "def": "A refrigeration system that cools a liquid (typically water or water/glycol) which is then circulated to air handlers or process equipment to provide cooling."
    },
    {
      "term": "Cooling tower",
      "def": "A structure used with water-cooled chillers that rejects heat from condenser water to the atmosphere primarily through evaporative cooling."
    },
    {
      "term": "Ammonia (R-717)",
      "def": "A highly efficient, zero-GWP natural refrigerant widely used in industrial refrigeration; toxic and mildly flammable, requiring specialized safety controls and trained technicians."
    },
    {
      "term": "Carbon dioxide (R-744)",
      "def": "A non-toxic, non-flammable natural refrigerant used in industrial and supermarket systems, often in cascade or transcritical booster configurations, notable for operating at much higher pressures than traditional refrigerants."
    },
    {
      "term": "Cascade system",
      "def": "A multi-refrigerant refrigeration system in which a low-temperature circuit (often CO2) rejects its heat to a higher-temperature circuit (often ammonia), allowing efficient operation across a large overall temperature lift."
    },
    {
      "term": "Blast freezing",
      "def": "An industrial process refrigeration application that rapidly freezes food product using very cold evaporator temperatures, often -20°F to -40°F or colder, to preserve product quality."
    },
    {
      "term": "Transport refrigeration",
      "def": "Self-contained DX refrigeration units mounted on trailers, shipping containers, or rail cars to maintain cargo temperature during shipping, powered by diesel or electric sources."
    }
  ],
  "installation-practices": [
    {
      "term": "Nitrogen purge",
      "def": "Flowing dry nitrogen through tubing during brazing to displace oxygen and prevent internal oxide scale from forming inside the pipe."
    },
    {
      "term": "Silver brazing alloy (BCuP/Sil-Fos)",
      "def": "A phosphorus-copper or silver-bearing filler metal that melts around 1190-1400°F, used to join copper refrigerant lines because it withstands system pressures and vibration; soft solder is not acceptable for pressure-bearing refrigerant joints."
    },
    {
      "term": "Standing pressure test",
      "def": "Pressurizing a system with dry nitrogen and monitoring for pressure loss (adjusted for temperature change) over a period of hours to confirm all joints are leak-free before evacuation."
    },
    {
      "term": "Micron gauge",
      "def": "An electronic vacuum gauge that measures deep vacuum in microns of mercury (1000 microns = 1 mm Hg), used to verify a system has been dried and evacuated properly, typically to around 500 microns."
    },
    {
      "term": "Deep vacuum / dehydration",
      "def": "Pulling system pressure far below atmospheric so that residual moisture boils off and is removed by the vacuum pump, preventing acid formation and ice-related restrictions in the operating system."
    },
    {
      "term": "Triple evacuation",
      "def": "A dehydration method that pulls a moderate vacuum, breaks it with dry nitrogen, and repeats the cycle three times to dilute and remove residual moisture and non-condensables."
    },
    {
      "term": "Non-condensable gases",
      "def": "Gases such as air or nitrogen trapped in a refrigerant system that do not condense in the condenser, raising head pressure and reducing heat transfer efficiency."
    },
    {
      "term": "Weighing in charge",
      "def": "Adding refrigerant by measured weight on an electronic charging scale to match the manufacturer's nameplate or line-set-adjusted charge specification."
    },
    {
      "term": "Liquid vs. vapor charging",
      "def": "Liquid charging feeds refrigerant into the high side with the compressor off for fast, full charging; vapor charging feeds refrigerant into the low side with the compressor running for slower, safer top-off without slugging risk."
    },
    {
      "term": "Refrigerant slugging",
      "def": "Liquid refrigerant entering the compressor cylinder or scroll set directly, which can cause mechanical damage since compressors are designed to compress vapor, not liquid."
    },
    {
      "term": "UV dye",
      "def": "A fluorescent additive circulated with system oil that glows under an ultraviolet lamp at a leak site, useful for finding slow or intermittent leaks over time."
    },
    {
      "term": "Oil trap (P-trap) / suction riser",
      "def": "A U-shaped low point installed at the base of a vertical suction line to collect oil during low-velocity conditions and allow refrigerant flow to carry it back to the compressor in manageable slugs."
    }
  ],
  "troubleshooting-diagnostics": [
    {
      "term": "Superheat",
      "def": "The difference between the actual temperature of refrigerant vapor and its saturation (boiling) temperature at the measured suction pressure; used to verify charge on fixed-orifice/piston metering device systems and to protect the compressor from liquid slugging."
    },
    {
      "term": "Subcooling",
      "def": "The difference between the saturation (condensing) temperature at the measured liquid line pressure and the actual measured liquid line temperature; used to verify charge on TXV systems."
    },
    {
      "term": "Pressure-temperature (PT) chart",
      "def": "A reference chart, specific to each refrigerant, listing the saturation temperature that corresponds to a given pressure for that refrigerant."
    },
    {
      "term": "Saturation temperature",
      "def": "The temperature at which a refrigerant boils (evaporates) or condenses at a given pressure; the basis for both superheat and subcooling calculations."
    },
    {
      "term": "Fixed-orifice/piston metering device",
      "def": "A non-adjustable metering device (orifice or piston) that meters refrigerant flow based on the pressure differential across it, requiring superheat as the primary charge check method."
    },
    {
      "term": "Thermostatic expansion valve (TXV)",
      "def": "A metering device that actively adjusts refrigerant flow to maintain a target superheat, meaning subcooling (not superheat) is used to verify system charge on TXV systems."
    },
    {
      "term": "Temperature split",
      "def": "The difference between the return air temperature and supply air temperature across the evaporator coil, used as a quick check of overall system cooling performance."
    },
    {
      "term": "Clamp meter",
      "def": "An electrical test meter that measures current (amperage) by clamping around a conductor without breaking the circuit, often combined with voltage, resistance, and capacitance functions."
    },
    {
      "term": "Non-condensables",
      "def": "Gases such as air trapped in a refrigerant system that do not condense in the condenser, raising head pressure and reducing system efficiency."
    },
    {
      "term": "Recovery machine",
      "def": "A device used to remove refrigerant from a system into a storage cylinder so it can be reused, reclaimed, or disposed of properly, as required by EPA venting prohibitions."
    },
    {
      "term": "Short cycling",
      "def": "Abnormally frequent on/off cycling of a compressor or system, often caused by oversized equipment, a dirty/iced coil, low charge, or a faulty control."
    },
    {
      "term": "Flooding/liquid slugging",
      "def": "Liquid refrigerant or oil returning to or entering the compressor rather than fully vaporized gas, which can cause noise, loss of lubrication, or mechanical damage."
    }
  ],
  "maintenance": [
    {
      "term": "Preventive maintenance (PM)",
      "def": "Scheduled, proactive service performed on a defined interval to maintain equipment efficiency and catch developing problems before they cause failure, as opposed to reactive breakdown service."
    },
    {
      "term": "Baseline readings",
      "def": "A recorded set of system readings (pressures, temperatures, amp draws, superheat/subcooling) taken during a known-good service visit, used for comparison on future visits to detect gradual degradation."
    },
    {
      "term": "Condenser coil cleaning",
      "def": "Removing dirt, debris, or grease from the outdoor/condenser coil to restore proper heat rejection and prevent elevated head pressure and reduced efficiency."
    },
    {
      "term": "Anti-sweat/door heater",
      "def": "A resistance heater built into a refrigerated case or walk-in door frame/gasket area to prevent condensation and frost buildup around the door opening."
    },
    {
      "term": "Defrost cycle",
      "def": "A periodic operating cycle on refrigeration and heat pump evaporators that melts accumulated frost/ice from the coil to maintain airflow and heat transfer."
    },
    {
      "term": "Float switch (condensate)",
      "def": "A safety device that detects a rising condensate water level and shuts down the system or triggers an alarm to prevent overflow and water damage."
    },
    {
      "term": "Oil residue leak indicator",
      "def": "Visible oily film at a fitting, joint, or coil, indicating that refrigerant oil (and therefore refrigerant) has been leaking from that point over time."
    },
    {
      "term": "Leak rate",
      "def": "The percentage of a system's full refrigerant charge lost to leakage over a defined period (commonly annualized), used by regulators to determine whether mandatory repair is triggered."
    },
    {
      "term": "Service record/documentation",
      "def": "A written or digital record of a maintenance or repair visit including date, technician, equipment identification, work performed, readings taken, and refrigerant added or recovered."
    },
    {
      "term": "Global warming potential (GWP)",
      "def": "A relative measure of how much a given mass of a gas contributes to warming over a set time period compared to carbon dioxide, used to compare the climate impact of different refrigerants."
    }
  ],
  "codes-certification": [
    {
      "term": "EPA Section 608",
      "def": "The section of the Clean Air Act requiring certification of technicians who service, maintain, repair, or dispose of equipment that could release ozone-depleting or greenhouse gas refrigerants."
    },
    {
      "term": "Type I certification",
      "def": "EPA 608 certification covering small appliances with 5 pounds or less of factory-sealed refrigerant charge, tested with a closed-book exam."
    },
    {
      "term": "Type II certification",
      "def": "EPA 608 certification covering high- and very-high-pressure appliances (e.g., systems using R-410A, R-22, R-404A), requiring a practical exam component, and covering any charge size within that pressure category."
    },
    {
      "term": "Type III certification",
      "def": "EPA 608 certification covering low-pressure appliances, primarily low-pressure chillers using refrigerants such as R-11 and R-113."
    },
    {
      "term": "Universal certification",
      "def": "EPA 608 certification earned by passing Type I, II, and III exams, covering all appliance categories and recommended for technicians working across the full range of equipment."
    },
    {
      "term": "Recovery",
      "def": "Removing refrigerant from a system in any condition and storing it in an external container, without necessarily testing or cleaning it."
    },
    {
      "term": "Recycling",
      "def": "Reducing contaminants in recovered refrigerant (oil separation, moisture/acid/particulate reduction) for reuse in the same system or by the same owner, without meeting resale purity standards."
    },
    {
      "term": "Reclaiming",
      "def": "Processing recovered refrigerant to the AHRI Standard 700 purity level, verified by chemical analysis, typically off-site, so it can be resold as equivalent to virgin refrigerant."
    },
    {
      "term": "AHRI Standard 700/740",
      "def": "Industry standards defining refrigerant purity (700) and recovery/recycling equipment performance (740) that recovery machines must be certified against."
    },
    {
      "term": "A2L refrigerant",
      "def": "A refrigerant with an ASHRAE mild flammability safety classification (A2L), such as R-32 or R-454B, requiring recovery equipment, gauges, and hoses specifically rated for A2L use rather than standard A1 (non-flammable) equipment."
    },
    {
      "term": "AIM Act HFC phasedown",
      "def": "Federal law authorizing EPA to phase down HFC refrigerant production/consumption via a declining allowance system referenced against a 2012 baseline, plus sector-specific GWP limits phasing in 2025-2027."
    },
    {
      "term": "CARB Refrigerant Management Program",
      "def": "California's state-level refrigerant management program, which imposes leak inspection, reporting, and repair requirements on large systems that can be stricter than the federal EPA program."
    }
  ]
}
