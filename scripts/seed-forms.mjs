/**
 * IAT Forms Portal — Jotform Migration Script
 * Run with: node scripts/seed-forms.mjs
 * Requires .env.local to be populated with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local
const envPath = resolve(__dirname, '../.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ─── Field helpers ────────────────────────────────────────────────────────────
const t = (label, req = false, order = 0) => ({ label, field_type: 'text', is_required: req, sort_order: order, options: null })
const em = (label, req = true, order = 0) => ({ label, field_type: 'email', is_required: req, sort_order: order, options: null })
const ta = (label, req = false, order = 0) => ({ label, field_type: 'textarea', is_required: req, sort_order: order, options: null })
const dt = (label, req = false, order = 0) => ({ label, field_type: 'date', is_required: req, sort_order: order, options: null })
const fi = (label, req = false, order = 0) => ({ label, field_type: 'file', is_required: req, sort_order: order, options: null })
const sig = (label, req = false, order = 0) => ({ label, field_type: 'signature', is_required: req, sort_order: order, options: null })
const sel = (label, opts, req = false, order = 0) => ({ label, field_type: 'select', is_required: req, sort_order: order, options: opts })
const radio = (label, opts, req = false, order = 0) => ({ label, field_type: 'radio', is_required: req, sort_order: order, options: opts })
const chk = (label, opts, req = false, order = 0) => ({ label, field_type: 'checkbox', is_required: req, sort_order: order, options: opts })
const num = (label, req = false, order = 0) => ({ label, field_type: 'number', is_required: req, sort_order: order, options: null })

const YN = ['Yes', 'No']
const YNN = ['Yes', 'No', 'N/A']
const PF = ['Pass', 'Fail']
const PFN = ['Pass', 'Fail', 'N/A']
const RATING5 = ['1 - Poor', '2 - Below Average', '3 - Average', '4 - Good', '5 - Excellent']
const SCALE5 = ['1', '2', '3', '4', '5']
const VOLTAGE = ['115V/60Hz', '208-230V/60Hz', '460V/60Hz', '575V/60Hz', 'Other']

// Standard job application fields
const stdAppFields = (extraFields = []) => [
  t('Full Name', true, 0),
  em('Email', true, 1),
  t('Phone Number', true, 2),
  t('Address', false, 3),
  t('School Name & Level of Education Completed', true, 4),
  t('Most Recent Place of Employment', true, 5),
  ta('List Your Responsibilities at Your Most Recent Job', true, 6),
  radio('Do You Have Any HVAC Experience?', YN, true, 7),
  t('If So, How Many Years of Field Experience?', false, 8),
  radio('Are You Currently Located in the United States?', YN, true, 9),
  radio('Are You Able to Commute to Covington, GA?', YN, true, 10),
  dt('When Can You Begin Work?', true, 11),
  ta('Are You Under Any Contractual Obligations? If So, Explain.', false, 12),
  ta('Please List Any Available References', false, 13),
  fi('Upload Resume', true, 14),
  ...extraFields,
]

const engAppFields = [
  t('Full Name', true, 0),
  em('Email', true, 1),
  t('Phone Number', true, 2),
  t('Address', false, 3),
  t('School Name & Level of Education Completed', true, 4),
  t('Current or Most Recent Place of Employment', true, 5),
  ta('List Your Responsibilities at Your Current/Most Recent Job', true, 6),
  radio('Do You Have Experience Working in the HVAC Industry?', YN, true, 7),
  radio('Do You Have Experience With Load Calculation Software (FEA, CFD, etc.)?', YN, false, 8),
  ta('Level of Experience Working With Thermodynamics & Psychrometrics', false, 9),
  ta('Do You Have Experience With Solidworks? What Software Do You Normally Work In?', false, 10),
  radio('Are You Currently Located in the United States?', YN, true, 11),
  radio('Are You Able to Commute to Covington, GA?', YN, true, 12),
  dt('When Can You Begin Work?', true, 13),
  ta('Are You Under Any Contractual Obligations? If So, Explain.', false, 14),
  ta('Please List Any Available References', false, 15),
  fi('Upload Resume', true, 16),
  t('How Did You Hear About This Job Opening?', false, 17),
  ta('Is There Anything Else You Would Like Us to Know?', false, 18),
]

// Standard RFQ fields
const rfqFields = [
  t('Full Name', true, 0),
  em('Email', true, 1),
  t('Phone Number', false, 2),
  t('Company Name', true, 3),
  t('Project Name', true, 4),
  t('Country (Where Dehumidifier Will Be Located)', true, 5),
  t('City & State (Where Dehumidifier Will Be Located)', true, 6),
  dt('Equipment Needed By', false, 7),
  t('Desired Room Temperature and Humidity (%RH or Dewpoint)', true, 8),
  t('What Is the Temperature and Humidity of the Surrounding Space?', false, 9),
  t('What Is the Size of the Room? (LxWxH, Volume in ft³)', true, 10),
  ta('Briefly Describe What Is Going On in the Room', true, 11),
  radio('Contaminants Present?', YN, false, 12),
  t('If Yes, Please List What Contaminants Are Present', false, 13),
  t('How Many People Will Be in the Space?', false, 14),
  t('Ventilation/Make-Up Air to Space (CFM)', false, 15),
  t('Exhaust Air From Space (CFM)', false, 16),
  t('Product Moisture Load (lbs/Hour/H2O, if known)', false, 17),
  t('Product Heat Load (BTUs/Hour, if known)', false, 18),
  radio('Do You Want IAT to Control the Temperature in the Space?', YN, false, 19),
  sel('Voltage', ['208V/1Ph', '208V/3Ph', '230V/1Ph', '460V/3Ph', '575V/3Ph', 'Other'], false, 20),
  ta('Additional Information', false, 21),
  fi('Please Upload Any Relevant Files', false, 22),
]

// ─── Form definitions ─────────────────────────────────────────────────────────
const FORMS = [

  // ── HR & Time Off ──────────────────────────────────────────────────────────
  {
    category: 'HR & Time Off',
    title: 'Annual Time Request',
    slug: 'annual-time-request',
    description: 'Submit a request for PTO or annual time off.',
    fields: [
      t('Employee Name', true, 0),
      em('Employee Email', true, 1),
      dt('Dates Needed', true, 2),
      t('Total # of PTO Hours to Use', true, 3),
      sel('Manager', ['Crystal', 'James', 'Kacy', 'Devon', 'Chris H.'], true, 4),
      radio('Is This Birthday Time?', YN, false, 5),
      ta('Reason', false, 6),
    ],
  },
  {
    category: 'HR & Time Off',
    title: 'Sick Time Form',
    slug: 'sick-time-form',
    description: 'Report sick time usage.',
    fields: [
      t('Employee Name', true, 0),
      em('Employee Email', true, 1),
      dt('Dates Needed', true, 2),
      t('Total # of PTO Hours to Use', true, 3),
      ta('Reason', true, 4),
    ],
  },
  {
    category: 'HR & Time Off',
    title: 'Employee Incentive Award',
    slug: 'employee-incentive-award',
    description: 'Nominate a team member for an incentive award.',
    fields: [
      t('Name of Team Member Being Awarded', true, 0),
      sel('Department', ['Production', 'Engineering', 'Sales', 'Shipping/Receiving', 'Administration', 'Management'], true, 1),
      dt('Date', true, 2),
      ta('Reason for Award', true, 3),
      t('Nominating Associate Name', true, 4),
      em('Nominating Associate Email', true, 5),
      sel('Level of Award', ['Spot Award', 'Team Award', 'Monthly Award', 'Quarterly Award'], true, 6),
      t('Amount of Cash to Be Awarded (if applicable)', false, 7),
      sig('Approval Signature', true, 8),
    ],
  },
  {
    category: 'HR & Time Off',
    title: 'Accident Report',
    slug: 'accident-report',
    description: 'Report a workplace accident or incident.',
    fields: [
      t('Employee Name', true, 0),
      em('Employee Email', true, 1),
      dt('Date of Accident', true, 2),
      t('Time of Accident', true, 3),
      t('Who Was the Accident Reported To?', true, 4),
      radio('Was Anyone Injured?', YN, true, 5),
      t('Who Was Injured? (if applicable)', false, 6),
      ta('Please Describe the Accident', true, 7),
      ta('What Could Have Been Done to Prevent the Accident?', false, 8),
    ],
  },
  {
    category: 'HR & Time Off',
    title: 'Discipline Form',
    slug: 'discipline-form',
    description: 'Document an employee discipline action.',
    fields: [
      dt('Date', true, 0),
      t('Employee Name', true, 1),
      em('Employee Email', true, 2),
      t('Manager Name', true, 3),
      em('Manager Email', true, 4),
      sel('Offense Type', ['Verbal Warning', 'Written Warning', 'Final Warning', 'Termination'], true, 5),
      sel('Offense Number', ['1st Offense', '2nd Offense', '3rd Offense'], true, 6),
      ta('Correction Plan', true, 7),
      radio('Are You Clear About Our Expectations Regarding Company Policy?', YN, true, 8),
      sig('Employee Signature', true, 9),
    ],
  },
  {
    category: 'HR & Time Off',
    title: 'Company Directory Questionnaire',
    slug: 'company-directory-questionnaire',
    description: 'Help us build our internal company directory.',
    fields: [
      t('Full Name', true, 0),
      em('Email', true, 1),
      ta('What Do You Enjoy Most About Working at IAT?', false, 2),
      ta("What's One Surprising Fact or Talent Most People Don't Know About You?", false, 3),
      fi('Upload a Favorite Photo of Yourself or Your Family', false, 4),
      ta("Anything Else You'd Like Your Coworkers to Know About You?", false, 5),
    ],
  },

  // ── QC & Production ────────────────────────────────────────────────────────
  {
    category: 'QC & Production',
    title: 'DryGuard Inspection Report',
    slug: 'dryguard-inspection-report',
    description: 'Field inspection report for DryGuard units.',
    fields: [
      t('Technician Name', true, 0),
      em('Technician Email', true, 1),
      dt('Date of Inspection', true, 2),
      t('Customer Name', true, 3),
      em('Customer Email', false, 4),
      t('Unit Model #', true, 5),
      t('Unit Serial #', true, 6),
      radio('Gas Unit?', YN, true, 7),
      radio('Pre or Post Cooling Equipped?', YN, false, 8),
      t('Cooling Type (if applicable)', false, 9),
      ta('Initial Observations', false, 10),
      fi('Upload Photos', false, 11),
      ta('Recommendations', false, 12),
      ta('IAT Action Items', false, 13),
      sig('Customer Signature', false, 14),
      sig('IAT Technician Signature', false, 15),
    ],
  },
  {
    category: 'QC & Production',
    title: 'Compact QC Photos Form',
    slug: 'compact-qc-photos-form',
    description: 'Upload QC photos for Compact Series dehumidifiers.',
    fields: [
      t('Employee Name', true, 0),
      dt('Form Upload Date', true, 1),
      t('Serial # of Dehumidifier', true, 2),
      t('Compact Model #', true, 3),
      sel('Voltage', VOLTAGE, true, 4),
      t('Customer Name', false, 5),
      radio('Does the Unit Have a Remote Box?', YN, false, 6),
      radio('Any Additional Loose Gear Items Shipping?', YN, false, 7),
      fi('Upload Unit Photos (Front, Sides, Rear, Interior)', true, 8),
      fi('Upload Packaging Photos (Wrapped & Boxed)', false, 9),
      ta('Additional Notes', false, 10),
    ],
  },
  {
    category: 'QC & Production',
    title: 'Compact QC Checklist',
    slug: 'compact-qc-checklist',
    description: 'QC checklist for Compact Series dehumidifiers before shipment.',
    fields: [
      t('Employee Name', true, 0),
      dt('Form Upload Date', true, 1),
      t('Serial # of Dehumidifier', true, 2),
      t('Compact Model #', true, 3),
      sel('Voltage', VOLTAGE, true, 4),
      t('Customer Name', false, 5),
      radio('Is This a SPROUTS Unit?', YN, true, 6),
      radio('Are There Any Additional Items to Ship With the Unit?', YN, false, 7),
      fi('Upload Supporting Photos', false, 8),
    ],
  },
  {
    category: 'QC & Production',
    title: 'Compact Test Report',
    slug: 'compact-test-report',
    description: 'Final test report for Compact Series dehumidifiers.',
    fields: [
      dt('Date', true, 0),
      t('Testing Performed By', true, 1),
      em('Employee Email', true, 2),
      t('Customer Name', true, 3),
      t('Serial # of Dehumidifier', true, 4),
      t('Model # of Dehumidifier', true, 5),
      sel('Voltage', VOLTAGE, true, 6),
      t('Inlet Temperature', false, 7),
      t('Inlet Grains/lb', false, 8),
      t('Outlet Temperature', false, 9),
      t('Outlet Grains/lb', false, 10),
      t('Heater Amps', false, 11),
      t('React Pressure ("WC)', false, 12),
      t('Process Pressure ("WC)', false, 13),
      ta('Additional Shipped With Unit', false, 14),
      ta('Additional Comments', false, 15),
    ],
  },
  {
    category: 'QC & Production',
    title: 'IOM USB QC Form',
    slug: 'iom-usb-qc-form',
    description: 'QC checklist for IOM packet and USB drive.',
    fields: [
      t('IOM Packet Put Together By', true, 0),
      em('Email', true, 1),
      dt('Date', true, 2),
      t('Job #', true, 3),
      t('Unit Model #', true, 4),
      radio('Did You Update IOM Front Cover (Unit Series, Serial #, Model)?', YN, true, 5),
      radio('Is the Voltage on the IOM, Data Plate, and Electrical All the Same?', YN, true, 6),
      radio('Does the USB Electricals Match the Unit Type?', YN, true, 7),
      radio('Is the Unit Start-up Included on the USB?', YN, true, 8),
      radio('Has the Inside Data Plate Been Updated?', YN, true, 9),
      radio('Does the Address on the Packing Slip Match the Sales Order?', YN, true, 10),
      radio('IOM Word Doc Saved as PDF for USB & Job Folder?', YN, true, 11),
      radio('Warranty Certificate Included?', YN, true, 12),
      radio('If Remote Box — Have Electrical Drawings Been Added to USB?', YNN, false, 13),
      ta('Additional Notes', false, 14),
      fi('File/Image Upload', false, 15),
    ],
  },
  {
    category: 'QC & Production',
    title: 'IDP Pre/Post Test Report & QC',
    slug: 'idp-pre-post-test-report',
    description: 'Pre/post test report and QC checklist for IDP (Industrial Desiccant Products).',
    fields: [
      dt('Date', true, 0),
      t('Testing Performed By', true, 1),
      em('Email', true, 2),
      t('Customer Name', true, 3),
      t('Serial # of Dehumidifier', true, 4),
      t('Model # of Dehumidifier', true, 5),
      sel('Voltage', VOLTAGE, true, 6),
      t('Inlet Temperature', false, 7),
      t('Inlet Grains/lb', false, 8),
      t('Outlet Temperature', false, 9),
      t('Outlet Grains/lb', false, 10),
      t('Process Pressure Drop - WC', false, 11),
      t('React Pressure Drop - WC', false, 12),
      t('Process Volume CFM', false, 13),
      t('React Volume CFM', false, 14),
      ta('Final Comments', false, 15),
      ta('List Additional Items Shipped With Unit', false, 16),
      fi('Additional Photos', false, 17),
    ],
  },
  {
    category: 'QC & Production',
    title: 'QC Photos Form',
    slug: 'qc-photos-form',
    description: 'Upload unit photos and complete final QC checks before shipment.',
    fields: [
      t('Employee Name', true, 0),
      em('Employee Email', true, 1),
      dt('Form Upload Date', true, 2),
      t('Serial # of Dehumidifier', true, 3),
      t('Model # of Dehumidifier', true, 4),
      sel('Voltage', VOLTAGE, true, 5),
      t('Customer Name', false, 6),
      radio('Was the IOM/USB Inside the Unit?', YN, true, 7),
      radio('Was the UL (Intertek) Sticker Applied?', YN, true, 8),
      radio('Are There Any Loose Gear Items?', YN, true, 9),
      t('Where Was the USB Placed?', false, 10),
      fi('Photos Taken', true, 11),
      ta('Notes', false, 12),
    ],
  },
  {
    category: 'QC & Production',
    title: 'Refrigeration Form',
    slug: 'refrigeration-form',
    description: 'Document refrigeration charging and testing data.',
    fields: [
      t('Name', true, 0),
      em('Email', true, 1),
      dt('Date', true, 2),
      t('Project Name/Job', true, 3),
      t('Ambient Temperature', false, 4),
      t('Ambient Dewpoint', false, 5),
      t('Type of Refrigerant', true, 6),
      t('Lbs of Refrigerant Required', true, 7),
      radio('Tested for Leaks?', YN, true, 8),
      t('Liquid Pressure', false, 9),
      t('Suction Pressure', false, 10),
      t('SuperHeat', false, 11),
      t('Subcooling', false, 12),
      t('Condensing Unit Model #', false, 13),
      t('Condensing Unit Serial #', false, 14),
      t('Compressor Model #', false, 15),
      t('Compressor Serial #', false, 16),
      ta('Additional Comments', false, 17),
      fi('File Upload', false, 18),
    ],
  },
  {
    category: 'QC & Production',
    title: 'Pressure Test Form',
    slug: 'pressure-test-form',
    description: 'Record coil pressure testing results.',
    fields: [
      t('Employee Name', true, 0),
      em('Employee Email', true, 1),
      dt('Date', true, 2),
      t('IAT Unit Serial #', true, 3),
      t('Coil Type', true, 4),
      t('Coil Model #', false, 5),
      radio('Coil Damage?', YN, true, 6),
      ta('If Yes — Describe Damage', false, 7),
      fi('Upload Damage Photos', false, 8),
      radio('Coil Coated?', YN, false, 9),
      t('Type of Coating (if applicable)', false, 10),
      t('Total Pressure', true, 11),
      radio('Passed 24hr Pressure Test?', YN, true, 12),
      ta('Notes', false, 13),
    ],
  },
  {
    category: 'QC & Production',
    title: 'Pre-Commissioning Checklist',
    slug: 'pre-commissioning-checklist',
    description: 'Must be completed at least one week before scheduled service. IAT does not schedule service until this form is received.',
    fields: [
      t('Unit Serial Number', true, 0),
      dt('Date Inspected', true, 1),
      t('Inspected By', true, 2),
      em('Inspector Email', true, 3),
      radio('Unit Has No Shipping/Installation Damage — Unit Is Airtight', YN, true, 4),
      radio('All Inlet and Outlet Shipping Covers Have Been Removed', YN, true, 5),
      radio('Unit Is Securely Anchored Per Specifications', YN, true, 6),
      radio('All Foreign Debris Has Been Removed', YN, true, 7),
      radio('All Electrical Connections in Control Box Are Tight', YN, true, 8),
      radio('All Phases of Main Power Are Equal', YN, true, 9),
      radio('All Ductwork Is Completely Installed and Sealed Airtight', YN, true, 10),
      fi('Upload Ductwork Photos', true, 11),
      radio('All Filters Are Installed Correctly', YN, true, 12),
      radio('Piping to React Burner and Post Burner Is Complete', YNN, true, 13),
      fi('Upload Piping Photos', false, 14),
      radio('Gas Pressure at Both Inlets Does Not Exceed 14"WG', YNN, true, 15),
      radio('All Refrigeration Piping Is Complete and Charged Correctly', YNN, true, 16),
      fi('Upload Refrigeration Piping Photos', false, 17),
      radio('Remote Control Box/Humidistat/Thermostat Is Installed and Connected', YNN, true, 18),
      sig('Signature', true, 19),
    ],
  },
  {
    category: 'QC & Production',
    title: 'Sprouts Test Report',
    slug: 'sprouts-test-report',
    description: 'Final test report for Sprouts Compact Series dehumidifiers.',
    fields: [
      dt('Date', true, 0),
      t('Testing Performed By', true, 1),
      em('Employee Email', true, 2),
      t('Customer Name', true, 3),
      t('Serial # of Dehumidifier', true, 4),
      t('Model # of Dehumidifier', true, 5),
      sel('Voltage', VOLTAGE, true, 6),
      t('Inlet Temperature', false, 7),
      t('Inlet Grains/lb', false, 8),
      t('Outlet Temperature', false, 9),
      t('Outlet Grains/lb', false, 10),
      t('React Pressure ("WC)', false, 11),
      t('Process Pressure ("WC)', false, 12),
      radio('Hi-Pot', PF, true, 13),
      radio('Ground Continuity', PF, true, 14),
      fi('Upload Unit Nameplate Photo/Serial Tag', true, 15),
      fi('Hi-Pot and Ground Continuity Photo', true, 16),
      ta('Additional Comments', false, 17),
    ],
  },
  {
    category: 'QC & Production',
    title: 'Sprouts Retrofit Checklist',
    slug: 'sprouts-retrofit-checklist',
    description: 'Cleaning and retrofit checklist for Sprouts units.',
    fields: [
      t('Employee Name', true, 0),
      em('Employee Email', true, 1),
      dt('Form Upload Date', true, 2),
      t('Sprouts Job #', true, 3),
      dt('Date Cleaned', true, 4),
      fi('Photos', false, 5),
      ta('Notes', false, 6),
    ],
  },
  {
    category: 'QC & Production',
    title: 'Retrofit Sprouts Test Form',
    slug: 'retrofit-sprouts-test-form',
    description: 'Hi-Pot and Ground Continuity testing for Retrofit Sprouts units.',
    fields: [
      dt('Date', true, 0),
      t('Performed By', true, 1),
      t('Customer Name', true, 2),
      t('Serial # of Dehumidifier', true, 3),
      radio('Hi-Pot', PF, true, 4),
      fi('Hi-Pot Photo', true, 5),
      radio('Ground Continuity', PF, true, 6),
      fi('Ground Continuity Photo', true, 7),
    ],
  },
  {
    category: 'QC & Production',
    title: 'Electrical Drawing Package Checklist',
    slug: 'electrical-drawing-package-checklist',
    description: 'Engineer review checklist for electrical drawing packages.',
    fields: [
      t("Engineer's Name", true, 0),
      em('Email', true, 1),
      t('Job Number', true, 2),
      radio('General Project Information & Title Block & Revision Control', PFN, true, 3),
      radio('Electrical Ratings & Calculations', PFN, true, 4),
      radio('Motors & Mechanical Verification', PFN, true, 5),
      radio('Components & Electrical Design', PFN, true, 6),
      radio('Controls & Programming', PFN, true, 7),
      radio('Sensors & Instrumentation', PFN, true, 8),
      radio('Safety & Protection', PFN, true, 9),
      radio('Wiring & Terminations', PFN, true, 10),
      radio('Drawing Standards & Layout', PFN, true, 11),
    ],
  },

  // ── Applications ───────────────────────────────────────────────────────────
  {
    category: 'Applications',
    title: 'Job Application',
    slug: 'job-application',
    description: 'General job application for open positions at IAT.',
    fields: [
      t('Full Name', true, 0),
      em('Email', true, 1),
      t('Phone Number', true, 2),
      t('Address', false, 3),
      t('What Role Are You Applying For?', true, 4),
      t('School Name & Level of Education Completed', true, 5),
      t('Current or Most Recent Place of Employment', true, 6),
      ta('List Your Responsibilities at Your Current/Most Recent Job', true, 7),
      radio('Do You Have Any HVAC Experience?', YN, true, 8),
      radio('Do You Have Experience With Load Calculation Software (FEA, CFD, etc.)?', YN, false, 9),
      ta('Level of Experience Working With Thermodynamics & Psychrometrics', false, 10),
      ta('Do You Have Experience With Solidworks? What Software Do You Normally Work In?', false, 11),
      radio('Do You Have Any Sales Experience?', YN, false, 12),
      radio('Are You Currently Located in the United States?', YN, true, 13),
      radio('Are You Able to Commute to Covington, GA?', YN, true, 14),
      dt('When Can You Begin Work?', true, 15),
      ta('Are You Under Any Contractual Obligations? If So, Explain.', false, 16),
      t('How Did You Hear About This Job Opening?', false, 17),
      ta('Please List Any Available References', false, 18),
      fi('Upload Resume', true, 19),
      ta('Is There Anything Else You Would Like Us to Know?', false, 20),
    ],
  },
  {
    category: 'Applications',
    title: 'Production Assistant Application',
    slug: 'production-assistant-application',
    description: 'Application for the Production Assistant position at IAT.',
    fields: stdAppFields([
      radio('Do You Have Any Sales Experience?', YN, false, 15),
    ]),
  },
  {
    category: 'Applications',
    title: 'Testing & QC Technician Application',
    slug: 'testing-qc-technician-application',
    description: 'Application for the Testing & QC Technician position at IAT.',
    fields: stdAppFields([
      radio('Do You Have Any Sales Experience?', YN, false, 15),
    ]),
  },
  {
    category: 'Applications',
    title: 'Press Brake Operator Application',
    slug: 'press-brake-operator-application',
    description: 'Application for the Press Brake Operator position at IAT.',
    fields: stdAppFields([
      radio('Do You Have Any Sales Experience?', YN, false, 15),
    ]),
  },
  {
    category: 'Applications',
    title: 'Electrical Associate Application',
    slug: 'electrical-associate-application',
    description: 'Application for the Electrical Associate position at IAT.',
    fields: stdAppFields([
      radio('Do You Have Any Sales Experience?', YN, false, 15),
    ]),
  },
  {
    category: 'Applications',
    title: 'Field Service Tech Application',
    slug: 'field-service-tech-application',
    description: 'Application for the Field Service Technician position at IAT.',
    fields: stdAppFields([
      radio('Do You Have Any Sales Experience?', YN, false, 15),
    ]),
  },
  {
    category: 'Applications',
    title: 'Junior Electrical Controls Designer Application',
    slug: 'junior-electrical-controls-designer-application',
    description: 'Application for the Junior Electrical Controls Designer position at IAT.',
    fields: stdAppFields([
      radio('Do You Have Any Sales Experience?', YN, false, 15),
    ]),
  },
  {
    category: 'Applications',
    title: 'Senior Electrical & Controls Engineer Application',
    slug: 'senior-electrical-controls-engineer-application',
    description: 'Application for the Senior Electrical & Controls Engineer position at IAT.',
    fields: engAppFields,
  },
  {
    category: 'Applications',
    title: 'Director of Technology Application',
    slug: 'director-of-technology-application',
    description: 'Application for the Director of Technology position at IAT.',
    fields: engAppFields,
  },
  {
    category: 'Applications',
    title: 'Mechanical Engineer Application',
    slug: 'mechanical-engineer-application',
    description: 'Application for the Mechanical Engineer position at IAT.',
    fields: engAppFields,
  },

  // ── Sales & External ───────────────────────────────────────────────────────
  {
    category: 'Sales & External',
    title: 'Request For Quote',
    slug: 'request-for-quote',
    description: 'Request a quote for IAT dehumidification equipment.',
    fields: rfqFields,
  },
  {
    category: 'Sales & External',
    title: 'Request For Quote — Carlson',
    slug: 'request-for-quote-carlson',
    description: 'Request a quote for IAT dehumidification equipment (Carlson rep).',
    fields: rfqFields,
  },
  {
    category: 'Sales & External',
    title: 'Request For Quote — McQuay',
    slug: 'request-for-quote-mcquay',
    description: 'Request a quote for IAT dehumidification equipment (McQuay rep).',
    fields: rfqFields,
  },
  {
    category: 'Sales & External',
    title: 'Request For Quote — KAST',
    slug: 'request-for-quote-kast',
    description: 'Request a quote for IAT dehumidification equipment (KAST rep).',
    fields: rfqFields,
  },
  {
    category: 'Sales & External',
    title: 'Request For Quote — Jerry Orr',
    slug: 'request-for-quote-jerry-orr',
    description: 'Request a quote for IAT dehumidification equipment (Jerry Orr rep).',
    fields: rfqFields,
  },
  {
    category: 'Sales & External',
    title: 'Request For Quote — Kenall',
    slug: 'request-for-quote-kenall',
    description: 'Request a quote for IAT dehumidification equipment (Kenall rep).',
    fields: rfqFields,
  },
  {
    category: 'Sales & External',
    title: 'Request For Quote — Norlake',
    slug: 'request-for-quote-norlake',
    description: 'Request a quote for IAT dehumidification equipment (Norlake rep).',
    fields: rfqFields,
  },
  {
    category: 'Sales & External',
    title: 'Compact Dehumidifier Specification Request',
    slug: 'compact-dehumidifier-specification-request',
    description: 'Request specifications for a Compact Series dehumidifier.',
    fields: [
      t('Full Name', true, 0),
      em('Email Address', true, 1),
      t('Phone Number', false, 2),
      t('Company/Organization', false, 3),
      t('Room Size', true, 4),
      t('Ceiling Height (ft or meters)', true, 5),
      t('Typical Temperature Range (°F/°C)', true, 6),
      t('Typical Humidity Level (%)', true, 7),
      sel('Application Type', ['Commercial', 'Industrial', 'Residential', 'Government/Military', 'Other'], true, 8),
      radio('Is Noise Sensitivity a Concern?', YN, false, 9),
      t('Target Relative Humidity (%)', true, 10),
      t('Required Extraction Rate (liters or pints per day)', false, 11),
      sel('Drainage Preference', ['Continuous Drain', 'Pump to Drain', 'Manual Tank', 'No Preference'], false, 12),
      t('Power Supply/Voltage Required', false, 13),
      sel('Placement Type', ['Floor Standing', 'Wall Mounted', 'Ceiling Mounted', 'Portable', 'Other'], false, 14),
      chk('Which Features Are Important to You?', ['Remote Monitoring', 'Auto Defrost', 'Energy Efficient Mode', 'Smart Controls', 'HEPA Filter', 'UV Light'], false, 15),
      t('Budget Range (USD)', false, 16),
      t('Required Delivery/Installation Timeline', false, 17),
      fi('Upload Layout Photos or Supporting Documents', false, 18),
      ta('Additional Notes or Special Requests', false, 19),
    ],
  },
  {
    category: 'Sales & External',
    title: 'Customer Satisfaction Survey',
    slug: 'customer-satisfaction-survey',
    description: 'Share your experience working with IAT.',
    fields: [
      t('Full Name', true, 0),
      em('Email', true, 1),
      t('Company', false, 2),
      t('Product/Model Received From IAT', true, 3),
      ta('Describe the Specific Application of the IAT Dehumidifier in Your Industry', true, 4),
      radio('How Would You Rate Your Overall Experience Working With IAT?', RATING5, true, 5),
      radio('How Likely Are You to Recommend IAT to Others in Your Industry?', SCALE5, true, 6),
      ta('Please Give a Brief Synopsis of Your Experience With IAT and the Effectiveness of the Product', true, 7),
      radio('May We Share Your Feedback With Others?', YN, true, 8),
      radio('Are You Willing to Create a Short Video Outlining Your Experience With IAT?', YN, false, 9),
    ],
  },
  {
    category: 'Sales & External',
    title: 'IAT Sales Representative Survey',
    slug: 'iat-sales-representative-survey',
    description: 'Feedback survey for IAT sales representatives.',
    fields: [
      t('Rep Name', true, 0),
      em('Rep Email', true, 1),
      radio('On a Scale of 1–5, How Comfortable Do You Feel Selling IAT Desiccant Dehumidifiers?', SCALE5, true, 2),
      radio('How Confident Are You in the Quality and Performance of Our Product Lines?', SCALE5, true, 3),
      radio('Do You Feel Adequately Supported by Our Team in Your Sales Efforts?', ['Yes', 'Somewhat', 'No'], true, 4),
      ta('Why or Why Not?', false, 5),
      ta('What Are the Most Common Hurdles You Encounter When Selling Our Products?', false, 6),
      ta('What Additional Resources, Tools, or Training Could Help You Be More Successful?', false, 7),
      ta('What Applications or Industries Do You Typically Sell Our Products For?', false, 8),
    ],
  },
  {
    category: 'Sales & External',
    title: 'Case Study Intake Form',
    slug: 'case-study-intake-form',
    description: 'Submit project details for a potential IAT case study.',
    fields: [
      t('Client Name', true, 0),
      t('Industry', true, 1),
      t('Facility Location', true, 2),
      t('Sales Order #', true, 3),
      dt('Ship Date', false, 4),
      t('Unit Type', true, 5),
      t('Rep Name', false, 6),
      radio('Is End-User Outreach Permitted?', YN, true, 7),
      ta('What Process Is This Unit Supporting?', true, 8),
      ta('What Environmental Problem Triggered the Inquiry?', true, 9),
      ta('What Would Have Happened If This Was Not Solved?', false, 10),
      radio('Is This a New Install or Retrofit?', ['New Install', 'Retrofit', 'Replacement', 'Upgrade'], false, 11),
      t('Target Environmental Conditions (Dewpoint, RH, Temp)', false, 12),
      ta('Any Unique Site Constraints?', false, 13),
      chk('Why Was IAT Selected?', ['Price', 'Performance', 'Lead Time', 'Relationship', 'Technical Expertise', 'Other'], false, 14),
      radio('Would You Flag This as a Potential Future Case Study?', ['Yes', 'No', 'Maybe'], true, 15),
    ],
  },
  {
    category: 'Sales & External',
    title: 'Sales Forecasting',
    slug: 'sales-forecasting',
    description: 'Submit a sales forecast entry.',
    fields: [
      t('Customer Name', true, 0),
      t('Unit Model', true, 1),
      t('Total Cost', true, 2),
      sel('% Confidence', ['10%', '25%', '50%', '75%', '90%', '100%'], true, 3),
      dt('Projected Close Date', false, 4),
      ta('Notes', false, 5),
    ],
  },

  // ── IT & Facilities ────────────────────────────────────────────────────────
  {
    category: 'IT & Facilities',
    title: 'Expense Report Form',
    slug: 'expense-report-form',
    description: 'Submit a business expense report for reimbursement.',
    fields: [
      t('Employee Name', true, 0),
      em('Employee Email', true, 1),
      dt("Today's Date", true, 2),
      dt('Trip Start Date', true, 3),
      dt('Trip End Date', true, 4),
      t('Credit Card Used', true, 5),
      t('Total Amount Owed', true, 6),
      t('Location(s) Visited', true, 7),
      ta('Purpose of Trip', true, 8),
      t('Unit Serial # (if applicable)', false, 9),
      fi('Upload Receipts', true, 10),
      ta('For Mileage — Provide Address or Notes', false, 11),
      fi('Upload Map Image (for mileage verification)', false, 12),
      radio('Are You a Non-Service Employee?', YN, false, 13),
    ],
  },
  {
    category: 'IT & Facilities',
    title: 'Purchase Approval Form',
    slug: 'purchase-approval-form',
    description: 'Request approval for a business purchase.',
    fields: [
      t('Requestor Name', true, 0),
      em('Requestor Email', true, 1),
      dt('Date of Request', true, 2),
      t('Item Requested', true, 3),
      t('Item to Be Used For', true, 4),
      ta('How Will This Purchase Benefit IAT?', true, 5),
      t('Purchase Cost', true, 6),
      fi('Upload Any Relevant Documents', false, 7),
    ],
  },
  {
    category: 'IT & Facilities',
    title: 'Marketing Materials Request Form',
    slug: 'marketing-materials-request-form',
    description: 'Request marketing materials from the Marketing Department.',
    fields: [
      t('Requestor Name', true, 0),
      em('Requestor Email', true, 1),
      dt('Date of Request', true, 2),
      t('Project Name', true, 3),
      radio('Is This a New Project or Revision?', ['New Project', 'Revision'], true, 4),
      dt('Desired Delivery Date', true, 5),
      radio('Is This Project Urgent or Time-Sensitive?', YN, true, 6),
      ta('If Urgent — Please Explain', false, 7),
      t('Who Will Be Viewing This Material?', true, 8),
      chk('Types of Materials Needed', ['Video', 'Document', 'Graphic/Design', 'Branded Merchandise', 'Form', 'Other'], true, 9),
      ta('Materials Details — Explain Your Needs, Color, Design Elements, Text, etc.', true, 10),
      fi('Upload Any Relevant Files or Reference Materials', false, 11),
    ],
  },
  {
    category: 'IT & Facilities',
    title: '3D Files Request Form',
    slug: '3d-files-request-form',
    description: 'Request 3D model files for IAT products.',
    fields: [
      t('Full Name', true, 0),
      em('Email', true, 1),
      t('Phone Number', false, 2),
      t('Company Name', true, 3),
      ta('For Which Products Are You Requesting 3D Files?', true, 4),
    ],
  },
  {
    category: 'IT & Facilities',
    title: 'Replacement Parts Request',
    slug: 'replacement-parts-request',
    description: 'Request replacement parts for an IAT unit.',
    fields: [
      t('Name', true, 0),
      em('Email', true, 1),
      t('Phone Number', true, 2),
      t('Company Name', true, 3),
      t('Serial # of Dehumidifier', true, 4),
      t('Model # of Dehumidifier', true, 5),
      dt('Date on Unit Label', false, 6),
      ta('Description of Replacement Part Needed', true, 7),
      fi('File/Image Upload', false, 8),
    ],
  },
  {
    category: 'IT & Facilities',
    title: 'Project Intake — Internal Use',
    slug: 'project-intake-internal',
    description: 'Internal project intake form for tracking customer projects.',
    fields: [
      t('Client Name', true, 0),
      t('Industry', true, 1),
      t('Facility Location', true, 2),
      t('Sales Order #', true, 3),
      dt('Ship Date', false, 4),
      t('Unit Type', true, 5),
      t('Rep Name (if Sold Through Rep)', false, 6),
      radio('Is End-User Outreach Permitted?', YN, true, 7),
      ta('What Process Is This Unit Supporting?', true, 8),
      ta('What Environmental Problem Triggered the Inquiry?', true, 9),
      ta('What Would Have Happened If Not Solved?', false, 10),
      sel('Project Type', ['New Install', 'Retrofit', 'Replacement', 'Upgrade'], false, 11),
      t('Target Environmental Conditions', false, 12),
      ta('Any Unique Site Constraints?', false, 13),
      ta('Why Was IAT Selected?', false, 14),
      radio('Would You Flag This as a Potential Future Case Study?', ['Yes', 'No', 'Maybe'], false, 15),
    ],
  },
]

// ─── Runner ───────────────────────────────────────────────────────────────────
async function run() {
  console.log('Fetching categories...')
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, name')

  if (catError) {
    console.error('Failed to fetch categories:', catError.message)
    process.exit(1)
  }

  const catMap = Object.fromEntries(categories.map(c => [c.name, c.id]))
  console.log('Categories found:', Object.keys(catMap).join(', '))

  let created = 0
  let skipped = 0

  for (const formDef of FORMS) {
    const categoryId = catMap[formDef.category]
    if (!categoryId) {
      console.warn(`  ⚠ No category found for "${formDef.category}" — skipping "${formDef.title}"`)
      skipped++
      continue
    }

    // Check if slug already exists
    const { data: existing } = await supabase
      .from('forms')
      .select('id')
      .eq('slug', formDef.slug)
      .single()

    if (existing) {
      console.log(`  → Skipping "${formDef.title}" (slug already exists)`)
      skipped++
      continue
    }

    // Insert form
    const { data: form, error: formError } = await supabase
      .from('forms')
      .insert({
        title: formDef.title,
        description: formDef.description || null,
        category_id: categoryId,
        slug: formDef.slug,
        is_active: true,
        success_message: 'Your submission has been received. The appropriate team will follow up shortly.',
      })
      .select()
      .single()

    if (formError || !form) {
      console.error(`  ✗ Failed to create "${formDef.title}":`, formError?.message)
      continue
    }

    // Insert fields
    const fieldRows = formDef.fields.map((f, i) => ({
      form_id: form.id,
      label: f.label,
      field_type: f.field_type,
      is_required: f.is_required,
      sort_order: i,
      options: f.options ? f.options : null,
      placeholder: null,
    }))

    const { error: fieldsError } = await supabase
      .from('form_fields')
      .insert(fieldRows)

    if (fieldsError) {
      console.error(`  ✗ Failed to insert fields for "${formDef.title}":`, fieldsError.message)
      continue
    }

    console.log(`  ✓ ${formDef.title} (${fieldRows.length} fields)`)
    created++
  }

  console.log(`\nDone! Created ${created} forms, skipped ${skipped}.`)
}

run().catch(console.error)
