/* The CAREL operating system's own menu — reached with Alarm + Enter held for
   three seconds, from anywhere, on any c.pCO regardless of what application is
   loaded. This is the tree a field service tech uses.

   Fully documented, so unlike the IAT application tree there is nothing pending
   capture here: structure from manual Fig. 7.b, screen contents from the
   INFORMATION / SETTINGS / APPLICATION / UPGRADE / LOGGER / DIAGNOSTICS tables
   on pages 46-47, and the navigation screenshots in §6.3, §6.5, §8.5 and §9.2.

   ⚠️ One documentation conflict, resolved deliberately: Fig. 7.b labels the
   second SETTINGS entry "TERMINAL SETTINGS", but the detailed table on p.47
   and three separate procedure screenshots (§6.3, §6.5, §9.2) all show
   "PLAN SETTINGS". Three agreeing sources beat one diagram, so PLAN SETTINGS
   is what this tree uses.

   ⚠️ IP, MASK, GW and DNS are readouts here, not editable fields. They need an
   octet-walking editor the engine does not have yet — tracked as an open item.
   Everything the BACnet lesson needs (DHCP on/off, where the address lives) is
   already teachable. */

import type { Tree, Values } from '../types'

export const SYSTEM_TREE_ID = 'sys'

export const SYSTEM_DEFAULT_VALUES: Values = {
  'sys.bt': 'v1.2.000 2014/02/12',
  'sys.os': 'v1.2.000 2014/02/12',
  'sys.svn': 'SVN REV 2796',
  'sys.mac': '00-D0-2C-40-03-2B',
  'sys.uid': '0000000000000032B',
  'sys.tera': '5E2207C4',

  'sys.ramUsed': '31744K',
  'sys.ramOs': '12288K',
  'sys.ramApp': '8192K',
  'sys.ramVm': '4096K',
  'sys.ramInternal': '2048K',
  'sys.ramFree': '5120K',

  'sys.plan.addr': 1,
  'sys.plan.release': 'No',
  'sys.plan.acquire': 'No',
  'sys.plan.update': 'No',

  'sys.tcp.dhcp': 'On',
  'sys.tcp.ip': '192.168.0.1',
  'sys.tcp.mask': '255.255.255.0',
  'sys.tcp.gw': '0.0.0.0',
  'sys.tcp.dns': '0.0.0.0',
  'sys.tcp.name': '',
  'sys.tcp.update': 'No',

  'sys.usb.pen': 'Enable',
  'sys.usb.pc': 'Enable',
  'sys.usb.disk': 'Disable',
  'sys.usb.status': 'not connected',

  'sys.password': 0,
  'sys.password.update': 'No',

  'sys.term.bklight': 100,
  'sys.term.bklightIdle': 30,
  'sys.term.buzzer': 'on',
  'sys.term.autooff': 'off',
}

const YES_NO = ['No', 'Yes']
const ENABLE_DISABLE = ['Enable', 'Disable']

export const systemTree: Tree = {
  id: SYSTEM_TREE_ID,
  label: 'CAREL system menu',
  root: 'sys.root',

  screens: {
    'sys.root': {
      id: 'sys.root',
      kind: 'menu',
      header: '',
      style: 'caret',
      items: [
        { id: 'info', label: 'INFORMATION', target: 'sys.info' },
        { id: 'settings', label: 'SETTINGS', target: 'sys.settings' },
        { id: 'application', label: 'APPLICATION', target: 'sys.application' },
        { id: 'upgrade', label: 'UPGRADE', target: 'sys.upgrade' },
        { id: 'logger', label: 'LOGGER', target: 'sys.logger' },
        { id: 'diagnostics', label: 'DIAGNOSTICS', target: 'sys.diagnostics' },
      ],
    },

    /* ---------------------------------------------------------------- INFO */

    'sys.info': {
      id: 'sys.info',
      kind: 'menu',
      header: '',
      style: 'caret',
      items: [
        { id: 'pco', label: 'PCO INFORMATION', target: 'sys.info.pco' },
        { id: 'io', label: 'I/O INFO', target: 'sys.info.io' },
        { id: 'memory', label: 'MEMORY INFO', target: 'sys.info.memory' },
        { id: 'plan', label: 'PLAN INFO', target: 'sys.info.plan' },
        { id: 'fs', label: 'FYLESYSTEM INFO', target: 'sys.info.fs' },
        { id: 'task', label: 'TASK INFO' },
        { id: 'app', label: 'APPLICATION INFO' },
        { id: 'builtin', label: 'BUILT IN INFO' },
      ],
    },

    /* The mask tERA registration is read from: MAC, hardware UID and the tERA
       code are all here (manual §10.6). */
    'sys.info.pco': {
      id: 'sys.info.pco',
      kind: 'form',
      header: 'PCO INFORMATION',
      fields: [
        { id: 'bt', kind: 'readout', label: 'BT', path: 'sys.bt' },
        { id: 'os', kind: 'readout', label: 'OS', path: 'sys.os' },
        { id: 'svn', kind: 'readout', label: 'SVN', path: 'sys.svn' },
        { id: 'mac', kind: 'readout', label: 'MAC', path: 'sys.mac' },
        { id: 'uid', kind: 'readout', label: 'UID', path: 'sys.uid' },
        { id: 'tera', kind: 'readout', label: 'tERA', path: 'sys.tera' },
      ],
    },

    'sys.info.io': {
      id: 'sys.info.io',
      kind: 'static',
      rows: [
        { kind: 'text', text: 'I/O INFO', inverse: true },
        { kind: 'blank' },
        { kind: 'text', text: '1 FW 1.05 HW 2.01' },
        { kind: 'text', text: '2 FW 1.05 HW 2.01' },
        { kind: 'text', text: '3 FW 1.05 HW 2.01' },
        { kind: 'text', text: '4 FW 1.05 HW 2.01' },
      ],
    },

    'sys.info.memory': {
      id: 'sys.info.memory',
      kind: 'form',
      header: 'MEMORY INFO',
      fields: [
        { id: 'used', kind: 'readout', label: 'used RAM', path: 'sys.ramUsed' },
        { id: 'os', kind: 'readout', label: 'OS', path: 'sys.ramOs' },
        { id: 'app', kind: 'readout', label: 'Application', path: 'sys.ramApp' },
        { id: 'vm', kind: 'readout', label: 'Virtual Machine', path: 'sys.ramVm' },
        { id: 'internal', kind: 'readout', label: 'Internal mem', path: 'sys.ramInternal' },
        { id: 'free', kind: 'readout', label: 'free RAM', path: 'sys.ramFree' },
      ],
    },

    'sys.info.plan': {
      id: 'sys.info.plan',
      kind: 'form',
      header: 'PLAN INFO',
      fields: [
        { id: 'addr', kind: 'readout', label: 'pLAN Address', path: 'sys.plan.addr' },
      ],
    },

    /* Volume 0 is the 32MB system partition and cannot be reached directly;
       volume 1 is the 96MB public area the FTP server and web pages live in. */
    'sys.info.fs': {
      id: 'sys.info.fs',
      kind: 'static',
      rows: [
        { kind: 'text', text: 'FYLESYSTEM INFO', inverse: true },
        { kind: 'blank' },
        { kind: 'text', text: 'volume  size  free' },
        { kind: 'text', text: 'nand: 0   30    12 MB' },
        { kind: 'text', text: 'nand: 1   91    64 MB' },
        { kind: 'text', text: 'msd: 0     0     0 MB' },
      ],
    },

    /* ------------------------------------------------------------ SETTINGS */

    'sys.settings': {
      id: 'sys.settings',
      kind: 'menu',
      header: '',
      style: 'caret',
      items: [
        { id: 'password', label: 'PASSWORD', target: 'sys.settings.password' },
        { id: 'usb', label: 'USB SETTINGS', target: 'sys.settings.usb' },
        { id: 'plan', label: 'PLAN SETTINGS', target: 'sys.settings.plan' },
        { id: 'clock', label: 'CLOCK SETTINGS', target: 'sys.settings.clock' },
        { id: 'tcpip', label: 'TCP/IP SETTINGS', target: 'sys.settings.tcpip' },
      ],
    },

    /* Locks the whole system menu except PCO INFORMATION. 00000 cancels it. */
    'sys.settings.password': {
      id: 'sys.settings.password',
      kind: 'form',
      header: 'INSERT NEW PASSWORD',
      fields: [
        { id: 'pwd', kind: 'digits', label: 'Password', path: 'sys.password', digits: 5 },
        {
          id: 'update',
          kind: 'enum',
          label: 'Update password',
          path: 'sys.password.update',
          options: YES_NO,
        },
      ],
    },

    /* Host and device ports cannot both be in use — check this mask before
       trying to load an application over USB (manual §6.6). */
    'sys.settings.usb': {
      id: 'sys.settings.usb',
      kind: 'form',
      header: 'USB SETTINGS',
      fields: [
        { id: 'pen', kind: 'enum', label: 'Pen drive', path: 'sys.usb.pen', options: ENABLE_DISABLE },
        { id: 'pc', kind: 'enum', label: 'PC connection', path: 'sys.usb.pc', options: ENABLE_DISABLE },
        { id: 'disk', kind: 'enum', label: 'pCO disk', path: 'sys.usb.disk', options: ENABLE_DISABLE },
        { id: 'status', kind: 'readout', label: 'Status', path: 'sys.usb.status' },
      ],
    },

    /* The second of the two ways to set a controller's pLAN address; the other
       is the recessed button next to the 7-segment display (manual §6.3). */
    'sys.settings.plan': {
      id: 'sys.settings.plan',
      kind: 'form',
      header: 'PLAN SETTINGS',
      fields: [
        { id: 'addr', kind: 'number', label: 'pLan pCO Addr', path: 'sys.plan.addr', min: 1, max: 32 },
        { id: 'release', kind: 'enum', label: 'Release Term', path: 'sys.plan.release', options: YES_NO },
        { id: 'acquire', kind: 'enum', label: 'Acquire Term', path: 'sys.plan.acquire', options: YES_NO },
        { id: 'update', kind: 'enum', label: 'Update config', path: 'sys.plan.update', options: YES_NO },
      ],
    },

    'sys.settings.clock': {
      id: 'sys.settings.clock',
      kind: 'form',
      header: 'CLOCK SETTINGS',
      fields: [
        { id: 'date', kind: 'readout', label: 'Date', path: 'main.date' },
        { id: 'time', kind: 'readout', label: 'Time', path: 'main.time' },
      ],
    },

    /* DHCP is On from the factory. Turn it off here to give the controller a
       static address on the customer's network — the prerequisite for BACnet/IP
       and for reaching the built-in web server. */
    'sys.settings.tcpip': {
      id: 'sys.settings.tcpip',
      kind: 'form',
      header: 'TCP/IP SETTINGS',
      fields: [
        { id: 'dhcp', kind: 'enum', label: 'DHCP', path: 'sys.tcp.dhcp', options: ['Off', 'On'] },
        { id: 'ip', kind: 'readout', label: 'IP', path: 'sys.tcp.ip' },
        { id: 'mask', kind: 'readout', label: 'MASK', path: 'sys.tcp.mask' },
        { id: 'gw', kind: 'readout', label: 'GW', path: 'sys.tcp.gw' },
        { id: 'dns', kind: 'readout', label: 'DNS', path: 'sys.tcp.dns' },
        { id: 'update', kind: 'enum', label: 'Update config', path: 'sys.tcp.update', options: YES_NO },
      ],
    },

    /* --------------------------------------------------------- APPLICATION */

    'sys.application': {
      id: 'sys.application',
      kind: 'menu',
      header: '',
      style: 'caret',
      items: [
        { id: 'stop', label: 'STOP APPLICATION' },
        { id: 'start', label: 'START APPLICATION' },
        { id: 'restart', label: 'RESTART APPLICATION' },
        { id: 'retain', label: 'WIPE RETAIN' },
        { id: 'nvram', label: 'WIPE NVRAM' },
        { id: 'ui', label: 'UI MANAGEMENT' },
        { id: 'builtin', label: 'BUILT IN SETTINGS', target: 'sys.application.builtin' },
      ],
    },

    'sys.application.builtin': {
      id: 'sys.application.builtin',
      kind: 'form',
      header: 'BUILT IN SETTINGS',
      fields: [
        { id: 'bk', kind: 'number', label: 'Bklight val', path: 'sys.term.bklight', min: 0, max: 100, step: 5 },
        { id: 'bkidle', kind: 'number', label: 'Bklight idle', path: 'sys.term.bklightIdle', min: 0, max: 600, step: 10 },
        { id: 'buzzer', kind: 'enum', label: 'Buzzer is', path: 'sys.term.buzzer', options: ['off', 'on'] },
        { id: 'autooff', kind: 'enum', label: 'Auto off time is', path: 'sys.term.autooff', options: ['off', 'on'] },
      ],
    },

    /* --------------------------------------------- UPGRADE / LOGGER / DIAG */

    'sys.upgrade': {
      id: 'sys.upgrade',
      kind: 'static',
      rows: [
        { kind: 'text', text: 'UPGRADE', inverse: true },
        { kind: 'blank' },
        { kind: 'text', text: '> iat_app.ap1' },
        { kind: 'blank' },
        { kind: 'text', text: 'From the USB host' },
        { kind: 'text', text: 'port, or NAND1 if' },
        { kind: 'text', text: 'no drive is fitted' },
      ],
    },

    'sys.logger': {
      id: 'sys.logger',
      kind: 'menu',
      header: '',
      style: 'caret',
      items: [
        { id: 'export', label: 'EXPORT LOGS' },
        { id: 'restart', label: 'RESTART LOGS' },
        { id: 'flush', label: 'FLUSH LOGS' },
        { id: 'wipe', label: 'WIPE LOGS' },
      ],
    },

    'sys.diagnostics': {
      id: 'sys.diagnostics',
      kind: 'menu',
      header: '',
      style: 'caret',
      items: [{ id: 'syslogs', label: 'SYSTEM LOGS' }],
    },
  },
}
