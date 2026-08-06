/* The IAT application menu tree.

   Everything here is transcribed from IAT's own "How to setup the BACnet
   instance" procedure, which captures a real session one screenshot per
   keystroke. Where the source shows a screen, this file matches it — including
   the item counts, which the pagers prove ("Main Menu 6/7", "Comm Menu 5/6").

   ⚠️ WHAT IS NOT YET KNOWN. The procedure only ever walks one path, so some
   menu entries appear in a pager count without ever being shown. Those are
   included with a `—` label and no target, because dropping them would put the
   wrong number in the pager and teach the wrong muscle memory. They are marked
   `optional: true` so the UI can badge them. Fill them from the screen-capture
   pass; do not invent labels.

   Also pending capture: the password tiers. The Main Menu subheader reads
   "Manufacturer Password", so there is at least a User level below it. No live
   password is stored in this file and none should be — the login accepts any
   four digits. */

import type { Tree, Values } from '../types'

export const IAT_TREE_ID = 'iat'

/** Starting values. Sensor readings are illustrative; setpoint ranges come
    from the BACnet point list (see `points.ts`), which is authoritative. */
export const IAT_DEFAULT_VALUES: Values = {
  'main.date': '02/04/24',
  'main.day': 'Tue',
  'main.time': '18:31',
  'main.unit': 'IAT',
  'main.temp': 32.0,
  'main.hum': 0.0,
  'main.status': 'OFF BY KEYBOARD',

  'bms2.address': 1,
  'bms2.protocol': 'NONE',
  'bms2.error': 'NotUsed',

  'bacnet.capture': 0,
  'bacnet.udpPort': 47808,
  'bacnet.adpuTimeout': 5000,
  'bacnet.offlineTimeout': 10000,
  'bacnet.deviceInstance': 0,
}

/** Protocols the BMS port can speak. NONE and BACNET are both shown in the
    source procedure; CAREL and MODBUS are the other two the platform manual
    names for a BMS serial port (§3.3, "Carel Slave or Modbus Slave protocol"). */
const BMS_PROTOCOLS = ['NONE', 'CAREL', 'MODBUS', 'BACNET']

/** Not captured yet — see the file header. */
function pending(id: string): { id: string; label: string; optional: true } {
  return { id, label: '—', optional: true }
}

export const iatTree: Tree = {
  id: IAT_TREE_ID,
  label: 'IAT application',
  root: 'iat.main',
  alarmScreen: 'iat.alarms',

  screens: {
    /* The mask the panel sits on. Prg starts the login. */
    'iat.main': {
      id: 'iat.main',
      kind: 'static',
      onPrg: 'iat.login',
      rows: [
        { kind: 'text', text: '{main.date}   {main.day}   {main.time}', inverse: true },
        { kind: 'text', text: '{main.unit}' },
        { kind: 'blank' },
        { kind: 'pair', left: 'pGDX Temp:', path: 'main.temp', format: 'temp1' },
        { kind: 'pair', left: 'pGDX Hum:', path: 'main.hum', format: 'temp1' },
        { kind: 'blank' },
        { kind: 'text', text: 'Unit status:' },
        { kind: 'text', text: '{main.status}' },
      ],
    },

    /* The capture shows the cursor already on the first digit, hence autoFocus.
       Any four digits are accepted — we do not ship real credentials. */
    'iat.login': {
      id: 'iat.login',
      kind: 'form',
      header: 'Login',
      autoFocus: true,
      fields: [
        {
          id: 'password',
          kind: 'digits',
          label: 'Insert password',
          path: 'login.password',
          digits: 4,
          // `replace`, not `goto`: the login must not stay on the stack, or Esc
          // from the Main Menu would drop you back onto the password prompt
          // instead of the main mask.
          onCommit: { kind: 'replace', screen: 'iat.main-menu' },
          // Enter past the last digit always submits, even if the trainee never
          // touched the value.
          commitOn: 'exit',
        },
      ],
    },

    'iat.main-menu': {
      id: 'iat.main-menu',
      kind: 'menu',
      header: 'Main Menu',
      subheader: 'Manufacturer Password',
      items: [
        { id: 'a', label: 'A. Device 1' },
        { id: 'b', label: 'B. Device 2' },
        { id: 'c', label: 'C. Device n' },
        pending('d'),
        { id: 'e', label: 'E. Alarm logs', target: 'iat.alarms' },
        { id: 'f', label: 'F. Settings', target: 'iat.settings' },
        { id: 'g', label: 'G. Logout', target: 'iat.main' },
      ],
    },

    'iat.settings': {
      id: 'iat.settings',
      kind: 'menu',
      header: 'Settings Menu',
      items: [
        { id: 'datetime', label: 'Date/Time' },
        { id: 'language', label: 'Language' },
        { id: 'comms', label: 'Communications', target: 'iat.comm' },
        { id: 'pwd', label: 'Pwd Change' },
        pending('s5'),
        pending('s6'),
        pending('s7'),
      ],
    },

    /* All six entries are known: 1-3 from the "1/6" and "2/6" captures, 4-6
       from the "5/6" capture, whose window lands on items 4, 5 and 6. */
    'iat.comm': {
      id: 'iat.comm',
      kind: 'menu',
      header: 'Comm Menu',
      items: [
        { id: 'bmscard', label: 'BMS Card' },
        { id: 'bms2', label: 'BMS2', target: 'iat.bms2' },
        { id: 'displayport', label: 'DisplayPort' },
        { id: 'ethernet', label: 'Ethernet' },
        { id: 'bacnet', label: 'BACnet', target: 'iat.bacnet' },
        { id: 'uom', label: 'UoM' },
      ],
    },

    /* Setting Protocol to BACNET is what arms the port. The reboot prompt fires
       when the cursor *leaves* Protocol, not when the value changes. */
    'iat.bms2': {
      id: 'iat.bms2',
      kind: 'form',
      header: 'Connectivity - BMS2',
      fields: [
        { id: 'address', kind: 'number', label: 'Address', path: 'bms2.address', min: 1, max: 247 },
        {
          id: 'protocol',
          kind: 'enum',
          label: 'Protocol',
          path: 'bms2.protocol',
          options: BMS_PROTOCOLS,
          onCommit: { kind: 'goto', screen: 'iat.reboot' },
        },
        { id: 'error', kind: 'readout', label: 'Error', path: 'bms2.error' },
      ],
    },

    'iat.reboot': {
      id: 'iat.reboot',
      kind: 'confirm',
      header: 'Communications',
      body: ['Is necessary to reboot', 'to apply the changes'],
      footer: ['Press ENTER to reboot', 'Press ESC to continue'],
      onConfirm: { kind: 'reboot' },
    },

    /* Device Instance is the unit's address on the customer's BAS. It is
       `stacked` because the pGD prints the label on one row and right-aligns
       the seven digits on the next, and the cursor walks them one at a time. */
    'iat.bacnet': {
      id: 'iat.bacnet',
      kind: 'form',
      header: 'Connectivity - BAC',
      fields: [
        { id: 'capture', kind: 'number', label: 'BACnet Capture', path: 'bacnet.capture', min: 0, max: 1 },
        { id: 'udp', kind: 'number', label: 'UDP Port', path: 'bacnet.udpPort', min: 1024, max: 65535 },
        { id: 'adpu', kind: 'number', label: 'ADPU Timeout', path: 'bacnet.adpuTimeout', min: 0, max: 65535 },
        { id: 'offline', kind: 'number', label: 'OffLine Timeout', path: 'bacnet.offlineTimeout', min: 0, max: 65535 },
        {
          id: 'instance',
          kind: 'digits',
          label: 'Device Instance',
          path: 'bacnet.deviceInstance',
          digits: 7,
          layout: 'stacked',
        },
      ],
    },

    'iat.alarms': {
      id: 'iat.alarms',
      kind: 'alarms',
      header: 'Alarms',
      empty: 'No active alarms',
    },
  },
}
