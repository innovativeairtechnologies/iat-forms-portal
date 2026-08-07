// ─────────────────────────────────────────────────────────────────────────────
// lib/soo-master.ts — the DEFAULT master Sequence of Operation clause library.
//
// Decomposed from the IAT master SOO (Trane Florida / Ferrara Orangeburg,
// iControl Premium PLC, BACnet MS/TP). Every clause here is engineering content:
// treat an edit the way you'd treat an edit to the Word master.
//
// ── How to read this file ───────────────────────────────────────────────────
// The source document is written for a fleet, so it hedges: "(and the
// return-air damper, where provided)", "Where an Air Flow Monitoring Station
// (Ebtron) is provided". Each of those hedges is a human writing an `if`. Here
// they become `requires` predicates, and because the portal produces ONE SOO PER
// UNIT the generated document states them outright instead of hedging. That is
// an intended improvement, not a transcription error — expect it in the diff.
//
// ── Numbers ─────────────────────────────────────────────────────────────────
// Every figure in the source master turned out to be a CONTROL CONSTANT: 120°F,
// 300°F, 40°F, 35°F, 50%, 100%. All of them bind to CONTROL_CONSTANTS. The
// document commits to no project setpoint values — it says "the Dewpoint
// Setpoint" and "a user-defined time period" throughout — so no clause here
// binds a `project` slot. PROJECT_SETPOINTS exists for the moment IAT wants a
// sequence that commits to values; it is exercised in scripts/verify-soo.mjs.
//
// ── Reactivation coverage ───────────────────────────────────────────────────
// Only STEAM reactivation is authored, because steam is what the source master
// covers and inventing a gas or electric sequence would be exactly the
// fabrication this whole design exists to prevent. The `coverage` rule at the
// bottom turns that gap into a loud, blocking message on a gas unit rather than
// a document that quietly ships with no reactivation section.
// ─────────────────────────────────────────────────────────────────────────────

import type { SooLibrary } from './soo'

export const SOO_MASTER_LIBRARY: SooLibrary = {
  version: 1,
  sections: [
    // ─── 1 ── Sequence of Operation ──────────────────────────────────────────
    {
      key: 'sequence_of_operation',
      number: 1,
      title: 'Sequence of Operation',
      clauses: [
        {
          key: 'enable_selector_bas',
          order: 10,
          body:
            'Move the selector switch on the control panel enclosure door to either the ON or AUTO position to enable the dehumidifier. If the selector switch is in the AUTO position, the unit will not start until the (external) auto run contact is closed, or the run command is issued through the customer’s BAS over {{protocol}}.',
          requires: [{ fact: 'bas_protocol', oneOf: ['bacnet_mstp', 'bacnet_ip', 'modbus'] }],
          slots: { protocol: { from: 'fact', path: 'bas_protocol', format: 'label' } },
        },
        {
          key: 'enable_selector_local',
          order: 10,
          body:
            'Move the selector switch on the control panel enclosure door to either the ON or AUTO position to enable the dehumidifier. If the selector switch is in the AUTO position, the unit will not start until the (external) auto run contact is closed.',
          requires: [{ fact: 'bas_protocol', is: 'none' }],
        },

        {
          key: 'run_active',
          order: 20,
          heading: 'When the run command is active:',
          body: '',
          children: [
            {
              key: 'run_pilot_power',
              order: 10,
              body: 'White Power On pilot light is illuminated whenever 120VAC control power is present.',
            },
            {
              key: 'run_pilot_running',
              order: 20,
              body: 'Green Unit Running pilot light turns on.',
            },
            {
              key: 'run_oa_damper_modulating',
              order: 30,
              body: 'The outside-air damper opens and modulates to its set position.',
              requires: [{ fact: 'oa_damper', is: 'motorized_modulating' }],
            },
            {
              key: 'run_oa_damper_two_position',
              order: 30,
              body: 'The outside-air damper drives to its full-open position.',
              requires: [{ fact: 'oa_damper', is: 'two_position' }],
            },
            {
              key: 'run_ra_damper_modulating',
              order: 35,
              body: 'The return-air damper opens and modulates to its set position.',
              requires: [{ fact: 'ra_damper', is: 'motorized_modulating' }],
            },
            {
              key: 'run_ra_damper_two_position',
              order: 35,
              body: 'The return-air damper drives to its full-open position.',
              requires: [{ fact: 'ra_damper', is: 'two_position' }],
            },
            {
              key: 'run_oa_afms',
              order: 40,
              body:
                'An Air Flow Monitoring Station (Ebtron) is provided on the outside-air damper. The outside-air damper modulates to maintain the outside-air ventilation flow setpoint.',
              requires: [
                { fact: 'has_afms', is: true },
                { fact: 'oa_damper', is: 'motorized_modulating' },
              ],
              device: { tag_prefix: 'FT', signal: 'AI', service: 'Outside-air flow monitoring station' },
            },
            {
              key: 'run_process_fan_vfd',
              order: 50,
              body: 'The process fan (VFD) will start and run at the speed set on the HMI touchscreen.',
              requires: [{ fact: 'process_fan_drive', is: 'vfd' }],
            },
            {
              key: 'run_process_fan_direct',
              order: 50,
              body: 'The process fan will start and run at its fixed design speed.',
              requires: [{ fact: 'process_fan_drive', is: 'across_line' }],
            },
            {
              key: 'run_airflow_proven',
              order: 60,
              body:
                'Once the process fan is running and process airflow is proven via the Process Plenum Pressure Transmitter, and no alarms are present, Humidity Control can enable.',
              requires: [{ fact: 'has_process_plenum_pressure_xmtr', is: true }],
            },
            {
              key: 'run_airflow_alarm',
              order: 70,
              body: 'If airflow cannot be confirmed, a Process Fan Not Running alarm occurs.',
              requires: [{ fact: 'has_process_plenum_pressure_xmtr', is: true }],
            },
          ],
        },

        {
          key: 'humidity_control',
          order: 30,
          heading: 'Humidity Control:',
          body: '',
          children: [
            {
              key: 'humidity_basis_space',
              order: 10,
              body:
                'Humidity Control is enabled based on the Space (room) condition, measured by the wall-mounted space humidity/temperature sensor.',
              requires: [{ fact: 'humidity_sensor_location', is: 'space' }],
            },
            {
              key: 'humidity_basis_leaving',
              order: 10,
              body:
                'Humidity Control is enabled based on the Leaving Dehumidifier (Post-Desiccant) condition, measured downstream of the desiccant wheel.',
              requires: [{ fact: 'humidity_sensor_location', is: 'post_desiccant' }],
            },
            {
              key: 'humidity_setpoint_hmi',
              order: 20,
              body: 'The user adjusts the Dewpoint Setpoint via the HMI.',
            },
            {
              key: 'humidity_setpoint_bas',
              order: 25,
              body: 'The Dewpoint Setpoint may also be adjusted over {{protocol}}.',
              requires: [{ fact: 'bas_protocol', oneOf: ['bacnet_mstp', 'bacnet_ip', 'modbus'] }],
              slots: { protocol: { from: 'fact', path: 'bas_protocol', format: 'label' } },
            },
            {
              key: 'humidity_precondition',
              order: 30,
              body: 'Humidity Control operation is contingent upon the following condition:',
              children: [
                {
                  key: 'humidity_precondition_dewpoint_alarm',
                  order: 10,
                  body: 'Post-Desiccant Dewpoint alarm is not present.',
                },
              ],
            },
            {
              key: 'humidity_call',
              order: 40,
              body:
                'A call for dehumidification is made whenever the Temperature Setpoint calculated by the Humidity Control loop is below the react (reactivation) temperature present value. Once a call for dehumidification is made:',
            },
            {
              key: 'wheel_enable',
              order: 50,
              body: 'Desiccant Wheel – contingent upon:',
              requires: [{ fact: 'has_desiccant_wheel', is: true }],
              children: [
                {
                  key: 'wheel_cond_call',
                  order: 10,
                  body: 'A call for dehumidification was made via the dewpoint setpoint.',
                },
                {
                  key: 'wheel_cond_react_temp',
                  order: 20,
                  body: 'The React Plenum temperature is above {{permissive}}.',
                  slots: { permissive: { from: 'constant', key: 'react_permissive_f' } },
                },
              ],
            },
            // Starting the wheel and PROVING it turns are two different things,
            // and the first version ANDed the proving-switch option into both
            // start clauses. A unit without the Rotor Rotation Alarm Package
            // therefore lost every start clause and the document never said the
            // wheel begins rotating at all — found by Jacob's 2026-08-07 test
            // unit, and nothing flagged it. Keep them separate.
            {
              key: 'wheel_start_vfd',
              order: 60,
              body: 'Once enabled, the desiccant wheel gear motor (VFD) starts rotating at the speed set on the HMI.',
              requires: [
                { fact: 'has_desiccant_wheel', is: true },
                { fact: 'wheel_drive', is: 'vfd' },
              ],
            },
            {
              key: 'wheel_start_fixed',
              order: 60,
              body: 'Once enabled, the desiccant wheel gear motor starts rotating at its fixed design speed.',
              requires: [
                { fact: 'has_desiccant_wheel', is: true },
                { fact: 'wheel_drive', is: 'across_line' },
              ],
            },
            {
              key: 'wheel_rotation_proving',
              order: 65,
              body:
                'Wheel rotation is confirmed by the Wheel Rotation Proving Switch; loss of proof generates a Rotor Not Running alarm.',
              requires: [
                { fact: 'has_desiccant_wheel', is: true },
                { fact: 'has_rotor_rotation_alarm', is: true },
              ],
              device: { tag_prefix: 'ZS', signal: 'DI', service: 'Wheel rotation proving switch' },
            },
            {
              key: 'react_fan_enable',
              order: 70,
              body:
                'React (Reactivation) Fan – contingent upon the same two conditions above. Once enabled, the react fan starts and running is confirmed by the React Plenum Pressure Transmitter.',
              requires: [
                { fact: 'has_react_fan', is: true },
                { fact: 'has_react_plenum_pressure_xmtr', is: true },
              ],
              device: { tag_prefix: 'PT', signal: 'AI', service: 'React plenum pressure transmitter' },
            },
            {
              key: 'react_heat_steam',
              order: 80,
              body: 'Reactivation Heat (Steam) – contingent upon:',
              requires: [{ fact: 'reactivation', is: 'steam' }],
              children: [
                {
                  key: 'react_heat_steam_cond_running',
                  order: 10,
                  body: 'The React Fan and Desiccant Wheel are both confirmed running.',
                },
                {
                  key: 'react_heat_steam_cond_sensor',
                  order: 20,
                  body: 'No React Temperature Sensor failure or React Overtemp alarm is present.',
                },
                {
                  key: 'react_heat_steam_cond_alarms',
                  order: 30,
                  body: 'No Desiccant Wheel (rotor) alarm or React Fan alarm is present.',
                },
                {
                  key: 'react_heat_steam_cond_call',
                  order: 40,
                  body: 'A call for dehumidification has been made via the Humidity Control process.',
                },
              ],
            },
            {
              key: 'react_heat_steam_modulate',
              order: 90,
              body:
                'Once enabled, the reactivation steam valve is modulated by the IAT controller via analog output based on the difference between the react (reactivation) temperature present value and the calculated Temperature Setpoint. The Reactivation Heat Enabled amber pilot light illuminates whenever reactivation heat is enabled.',
              requires: [{ fact: 'reactivation', is: 'steam' }],
              device: { tag_prefix: 'TCV', signal: 'AO', service: 'Reactivation steam valve' },
            },
            {
              key: 'dehum_satisfied',
              order: 100,
              body:
                'When the leaving/space dewpoint is satisfied (at or below setpoint) for a user-adjustable time period, the react section shuts down: reactivation heat is de-energized first, followed by the react fan and desiccant wheel once the react plenum temperature has fallen below {{permissive}} (see Shutdown, below).',
              slots: { permissive: { from: 'constant', key: 'react_permissive_f' } },
            },
            {
              key: 'process_fan_continuous',
              order: 110,
              body:
                'The process fan continues to run whenever the unit is enabled – regardless of whether dehumidification is currently active – to maintain airflow to the conditioned space.',
              requires: [{ fact: 'has_process_fan', is: true }],
            },
          ],
        },

        {
          key: 'react_heat_modes',
          order: 40,
          heading: 'Reactivation Heat Control Modes:',
          body:
            'The steam reactivation heater is controlled by the IAT PLC via a single modulating analog output to the reactivation steam valve. There are two control modes available on the HMI:',
          requires: [{ fact: 'reactivation', is: 'steam' }],
          children: [
            {
              key: 'react_mode_manual',
              order: 10,
              body:
                'On (Manual) Control Mode: The reactivation inlet temperature setpoint is set manually from the HMI and the steam valve modulates to maintain that temperature regardless of leaving dewpoint. This mode is typically used for maximum dehumidification capacity. Upper limit / maximum temperature setpoint is {{maxSetpoint}}.',
              slots: { maxSetpoint: { from: 'constant', key: 'react_max_setpoint_f' } },
            },
            {
              key: 'react_mode_auto',
              order: 20,
              body:
                'Auto Control Mode: The reactivation inlet temperature setpoint is automatically calculated (ranging from ambient up to the maximum setpoint) to maintain the space/leaving dewpoint setpoint. This mode provides the best energy efficiency while maintaining control over the dehumidifier’s performance.',
            },
          ],
        },

        {
          key: 'shutdown',
          order: 50,
          heading: 'Shutdown Sequence:',
          body:
            'To shut down the system, move the selector switch on the control panel to the OFF position, or remove the automatic run signal (both the external run contact and the {{protocol}} run command must be removed if in AUTO).',
          requires: [{ fact: 'bas_protocol', oneOf: ['bacnet_mstp', 'bacnet_ip', 'modbus'] }],
          slots: { protocol: { from: 'fact', path: 'bas_protocol', format: 'label' } },
          children: [
            // The source master lists the fan and all three valves in one
            // sentence, which named a pre-cooling valve on units that have no
            // pre-cooling coil. Split so each names only what is fitted.
            {
              key: 'shutdown_process_fan',
              order: 10,
              body: 'The process fan will immediately shut down.',
              requires: [{ fact: 'has_process_fan', is: true }],
            },
            {
              key: 'shutdown_pre_cool_valve',
              order: 11,
              body: 'The pre-cooling valve will immediately close.',
              requires: [{ fact: 'pre_cool_medium', is: 'chilled_water' }],
            },
            {
              key: 'shutdown_post_cool_valve',
              order: 12,
              body: 'The post-cooling valve will immediately close.',
              requires: [{ fact: 'post_cool_medium', is: 'chilled_water' }],
            },
            {
              key: 'shutdown_post_heat_valve',
              order: 13,
              body: 'The post-heating valve will immediately close.',
              requires: [{ fact: 'post_heat_medium', is: 'hot_water' }],
            },
            {
              key: 'shutdown_react_valve',
              order: 20,
              body: 'The reactivation steam valve will immediately close (reactivation heat de-energizes).',
              requires: [{ fact: 'reactivation', is: 'steam' }],
            },
            {
              key: 'shutdown_react_purge',
              order: 30,
              body:
                'The react fan and desiccant wheel will continue to run until the reactivation temperature falls below {{permissive}}, as a safety and coil longevity measure, after which they will also shut down.',
              slots: { permissive: { from: 'constant', key: 'react_permissive_f' } },
            },
            {
              key: 'shutdown_oa_damper',
              order: 40,
              body: 'The outside-air damper will close.',
              requires: [{ fact: 'oa_damper', oneOf: ['motorized_modulating', 'two_position'] }],
            },
            {
              key: 'shutdown_ra_damper',
              order: 45,
              body: 'The return-air damper will close.',
              requires: [{ fact: 'ra_damper', oneOf: ['motorized_modulating', 'two_position'] }],
            },
          ],
        },
      ],
    },

    // ─── 2 ── Temperature Control Module ─────────────────────────────────────
    {
      key: 'temperature_control_module',
      number: 2,
      title: 'Temperature Control Module Sequence of Operation',
      clauses: [
        {
          key: 'pre_cooling',
          order: 10,
          heading: 'Pre-Cooling:',
          body: 'The Pre-Cooling Chilled Water Coil is enabled as follows:',
          requires: [{ fact: 'pre_cool_medium', is: 'chilled_water' }],
          children: [
            {
              key: 'pre_cooling_modulate',
              order: 10,
              body:
                'If the entering air to the dehumidifier is above the Pre-Cooling Setpoint, the Pre-Cooling CW Valve Actuator opens and modulates to meet the Pre-Cooling Leaving Air Temperature Setpoint.',
              device: { tag_prefix: 'TCV', signal: 'AO', service: 'Pre-cooling chilled water valve' },
            },
            {
              key: 'pre_cooling_alarm',
              order: 20,
              body:
                'If the pre-cooling valve signal reaches {{fullOpen}} and the setpoint is not achieved within a user-defined time period, an HMI alarm is displayed.',
              slots: { fullOpen: { from: 'constant', key: 'valve_full_open_percent' } },
            },
            {
              key: 'pre_cooling_pilot',
              order: 30,
              body: 'The blue Pre-Cooling Enabled pilot light illuminates whenever the pre-cooling valve is active.',
            },
            // ── Freeze protection ──────────────────────────────────────────
            // The source master writes Stage 2 as one long sentence listing
            // every action. That named a pre-cooling valve, a post-cooling
            // valve and a return-air damper whether or not the unit had them —
            // inside the SAFETY sequence, which is the worst place for it.
            //
            // Each action is now its own conditional bullet. That also removes
            // the OA-only / OA+RA variant pair: the dampers simply gate
            // themselves. Reads better as a commissioning checklist too.
            {
              key: 'pre_cooling_freeze_stage1',
              order: 40,
              heading: 'Freeze Protection:',
              body:
                'Stage 1 – Freeze Prevention: If the pre-cooling coil leaving air temperature (downstream sensor) drops below a preset value (default {{stage1}}), the pre-cooling valve opens to {{fullOpen}}, process fan speed is reduced to {{fanSpeed}}, and a freeze prevention alarm is issued.',
              slots: {
                stage1: { from: 'constant', key: 'freeze_stage1_f' },
                fullOpen: { from: 'constant', key: 'valve_full_open_percent' },
                fanSpeed: { from: 'constant', key: 'freeze_stage1_fan_percent' },
              },
            },
            {
              key: 'pre_cooling_freeze_stage2',
              order: 50,
              body:
                'Stage 2 – Freeze Protection: If the hardwired mechanical pre-cooling freezestat (RANCO1, manual reset) trips on falling temperature:',
              device: { tag_prefix: 'TSL', signal: 'DI', service: 'Pre-cooling coil freezestat (manual reset)' },
              children: [
                {
                  key: 'pre_cooling_fs2_pre_valve',
                  order: 10,
                  body: 'The pre-cooling valve opens to {{fullOpen}}.',
                  slots: { fullOpen: { from: 'constant', key: 'valve_full_open_percent' } },
                },
                {
                  key: 'pre_cooling_fs2_post_valve',
                  order: 20,
                  body: 'The post-cooling valve opens to {{fullOpen}}.',
                  requires: [{ fact: 'post_cool_medium', is: 'chilled_water' }],
                  slots: { fullOpen: { from: 'constant', key: 'valve_full_open_percent' } },
                },
                {
                  key: 'pre_cooling_fs2_fan',
                  order: 30,
                  body: 'The process fan shuts off.',
                  requires: [{ fact: 'has_process_fan', is: true }],
                },
                {
                  key: 'pre_cooling_fs2_oa',
                  order: 40,
                  body: 'The outside-air damper closes.',
                  requires: [{ fact: 'oa_damper', oneOf: ['motorized_modulating', 'two_position'] }],
                },
                {
                  key: 'pre_cooling_fs2_ra',
                  order: 50,
                  body: 'The return-air damper closes.',
                  requires: [{ fact: 'ra_damper', oneOf: ['motorized_modulating', 'two_position'] }],
                },
                {
                  key: 'pre_cooling_fs2_alarm',
                  order: 60,
                  body: 'A freeze protection (hard) alarm is issued, requiring manual reset at the freezestat.',
                },
              ],
            },
          ],
        },

        {
          key: 'post_cooling',
          order: 20,
          heading: 'Post-Cooling:',
          body: 'The Post-Cooling Chilled Water Coil is enabled as follows:',
          requires: [{ fact: 'post_cool_medium', is: 'chilled_water' }],
          children: [
            {
              key: 'post_cooling_modulate',
              order: 10,
              body:
                'If the leaving air temperature from the desiccant wheel (process outlet) is above the Post-Cooling Setpoint, the Post-Cooling CW Valve Actuator opens and modulates to meet the Post-Cooling Leaving Air Temperature Setpoint.',
              device: { tag_prefix: 'TCV', signal: 'AO', service: 'Post-cooling chilled water valve' },
            },
            {
              key: 'post_cooling_alarm',
              order: 20,
              body:
                'If the post-cooling valve signal reaches {{fullOpen}} and the setpoint is not achieved within a user-defined time period, an HMI alarm is displayed.',
              slots: { fullOpen: { from: 'constant', key: 'valve_full_open_percent' } },
            },
            {
              key: 'post_cooling_pilot',
              order: 30,
              body: 'The blue Post-Cooling Enabled pilot light illuminates whenever the post-cooling valve is active.',
            },
            {
              key: 'post_cooling_freeze_stage1',
              order: 40,
              heading: 'Freeze Protection:',
              body:
                'Stage 1 – Freeze Prevention: If the post-cooling coil leaving air temperature (downstream sensor) drops below a preset value (default {{stage1}}), the post-cooling valve opens to {{fullOpen}}, process fan speed is reduced to {{fanSpeed}}, and a freeze prevention alarm is issued.',
              slots: {
                stage1: { from: 'constant', key: 'freeze_stage1_f' },
                fullOpen: { from: 'constant', key: 'valve_full_open_percent' },
                fanSpeed: { from: 'constant', key: 'freeze_stage1_fan_percent' },
              },
            },
            {
              key: 'post_cooling_freeze_stage2',
              order: 50,
              body:
                'Stage 2 – Freeze Protection: If the hardwired mechanical post-cooling freezestat (RANCO2, manual reset) trips on falling temperature:',
              device: { tag_prefix: 'TSL', signal: 'DI', service: 'Post-cooling coil freezestat (manual reset)' },
              children: [
                {
                  key: 'post_cooling_fs2_pre_valve',
                  order: 10,
                  body: 'The pre-cooling valve opens to {{fullOpen}}.',
                  requires: [{ fact: 'pre_cool_medium', is: 'chilled_water' }],
                  slots: { fullOpen: { from: 'constant', key: 'valve_full_open_percent' } },
                },
                {
                  key: 'post_cooling_fs2_post_valve',
                  order: 20,
                  body: 'The post-cooling valve opens to {{fullOpen}}.',
                  slots: { fullOpen: { from: 'constant', key: 'valve_full_open_percent' } },
                },
                {
                  key: 'post_cooling_fs2_fan',
                  order: 30,
                  body: 'The process fan shuts off.',
                  requires: [{ fact: 'has_process_fan', is: true }],
                },
                {
                  key: 'post_cooling_fs2_oa',
                  order: 40,
                  body: 'The outside-air damper closes.',
                  requires: [{ fact: 'oa_damper', oneOf: ['motorized_modulating', 'two_position'] }],
                },
                {
                  key: 'post_cooling_fs2_ra',
                  order: 50,
                  body: 'The return-air damper closes.',
                  requires: [{ fact: 'ra_damper', oneOf: ['motorized_modulating', 'two_position'] }],
                },
                {
                  key: 'post_cooling_fs2_alarm',
                  order: 60,
                  body: 'A freeze protection (hard) alarm is issued, requiring manual reset at the freezestat.',
                },
              ],
            },
          ],
        },

        {
          key: 'post_heating',
          order: 30,
          heading: 'Post-Heating:',
          body: 'The Post-Heating Hot Water Coil is enabled as follows:',
          requires: [{ fact: 'post_heat_medium', is: 'hot_water' }],
          children: [
            {
              key: 'post_heating_modulate',
              order: 10,
              body:
                'If the leaving air temperature from the desiccant wheel (process outlet) is below the Post-Heating Setpoint and there is no active call for post-cooling, the Post-Heating Hot Water Valve Actuator opens and modulates to meet the Post-Heating Leaving Air Temperature Setpoint. Post-Heating and Post-Cooling are interlocked and never energize at the same time.',
              device: { tag_prefix: 'TCV', signal: 'AO', service: 'Post-heating hot water valve' },
            },
            {
              key: 'post_heating_alarm',
              order: 20,
              body:
                'If the post-heating valve signal reaches {{fullOpen}} and the setpoint is not achieved within a user-defined time period, an HMI alarm is displayed.',
              slots: { fullOpen: { from: 'constant', key: 'valve_full_open_percent' } },
            },
            {
              key: 'post_heating_pilot',
              order: 30,
              body: 'The amber Post-Heating Enabled pilot light illuminates whenever the post-heating valve is active.',
            },
            {
              key: 'post_heating_freeze_stage1',
              order: 40,
              heading: 'Freeze Protection:',
              body:
                'Stage 1 – Freeze Prevention: If the post-heating hot water coil leaving air temperature drops below a preset value (default {{stage1}}), the post-heating hot water valve opens to {{fullOpen}} (full hot water flow), the process fan speed is reduced to {{fanSpeed}}, and a freeze prevention alarm is issued.',
              slots: {
                stage1: { from: 'constant', key: 'freeze_stage1_f' },
                fullOpen: { from: 'constant', key: 'valve_full_open_percent' },
                fanSpeed: { from: 'constant', key: 'freeze_stage1_fan_percent' },
              },
            },
            {
              key: 'post_heating_freeze_stage2',
              order: 50,
              body:
                'Stage 2 – Freeze Protection: If the post-heating hot water coil leaving air temperature drops below a preset value (default {{stage2}}):',
              slots: { stage2: { from: 'constant', key: 'freeze_stage2_f' } },
              children: [
                {
                  key: 'post_heating_fs2_hw_valve',
                  order: 10,
                  body: 'The post-heating hot water valve opens to {{fullOpen}}.',
                  slots: { fullOpen: { from: 'constant', key: 'valve_full_open_percent' } },
                },
                {
                  key: 'post_heating_fs2_pre_valve',
                  order: 20,
                  body: 'The pre-cooling chilled water valve opens to {{fullOpen}}.',
                  requires: [{ fact: 'pre_cool_medium', is: 'chilled_water' }],
                  slots: { fullOpen: { from: 'constant', key: 'valve_full_open_percent' } },
                },
                {
                  key: 'post_heating_fs2_post_valve',
                  order: 30,
                  body: 'The post-cooling chilled water valve opens to {{fullOpen}}.',
                  requires: [{ fact: 'post_cool_medium', is: 'chilled_water' }],
                  slots: { fullOpen: { from: 'constant', key: 'valve_full_open_percent' } },
                },
                {
                  key: 'post_heating_fs2_fan',
                  order: 40,
                  body: 'The process fan shuts off.',
                  requires: [{ fact: 'has_process_fan', is: true }],
                },
                {
                  key: 'post_heating_fs2_oa',
                  order: 50,
                  body: 'The outside-air damper closes.',
                  requires: [{ fact: 'oa_damper', oneOf: ['motorized_modulating', 'two_position'] }],
                },
                {
                  key: 'post_heating_fs2_ra',
                  order: 60,
                  body: 'The return-air damper closes.',
                  requires: [{ fact: 'ra_damper', oneOf: ['motorized_modulating', 'two_position'] }],
                },
                {
                  key: 'post_heating_fs2_alarm',
                  order: 70,
                  body: 'A freeze protection (hard) alarm is issued, requiring manual reset.',
                },
              ],
            },
          ],
        },
      ],
    },

    // ─── 3 ── Humidity Control Module ────────────────────────────────────────
    {
      key: 'humidity_control_module',
      number: 3,
      title: 'Humidity Control Module Sequence of Operation',
      clauses: [
        {
          key: 'hcm_intro',
          order: 10,
          body:
            'The system controls dewpoint in dehumidification mode only. Settings for dewpoint control are available from the Dewpoint Control Settings screen on the HMI.',
        },
        {
          key: 'hcm_modes_intro',
          order: 20,
          body: 'There are two selectable modes for the humidity control input:',
          children: [
            {
              key: 'hcm_mode_space',
              order: 10,
              body: 'Space Condition (wall-mounted space humidity/temperature sensor, ships loose for field installation)',
              requires: [{ fact: 'space_sensor_ships_loose', is: true }],
            },
            {
              key: 'hcm_mode_space_installed',
              order: 10,
              body: 'Space Condition (wall-mounted space humidity/temperature sensor)',
              requires: [{ fact: 'space_sensor_ships_loose', is: false }],
            },
            {
              key: 'hcm_mode_leaving',
              order: 20,
              body: 'Leaving Air Condition (Post-Desiccant, downstream of the wheel)',
            },
          ],
        },
        {
          key: 'hcm_rule_intro',
          order: 30,
          body:
            'When the unit is switched to run mode, the system determines whether dehumidification is required based on the following rule:',
          children: [
            {
              key: 'hcm_rule_enable',
              order: 10,
              body:
                'If the leaving air dewpoint (or conditioned space dewpoint, if selected) is equal to or greater than the setpoint, dehumidification is enabled per the sequence above.',
            },
            {
              key: 'hcm_rule_disable',
              order: 20,
              body:
                'If the leaving air dewpoint (or conditioned space dewpoint, if selected) is less than the setpoint, dehumidification remains disabled/off.',
            },
          ],
        },
        {
          key: 'hcm_hysteresis',
          order: 40,
          body:
            'Once enabled, the dehumidification system remains active until the leaving air dewpoint (or conditioned space dewpoint, if selected) remains more than the user-defined differential below setpoint for more than a user-defined time period, with the dehumidification control loop output at zero percent.',
        },
      ],
    },

    // ─── 4 ── Sensors, Safeties & Field Devices ──────────────────────────────
    {
      key: 'devices',
      number: 4,
      title: 'Sensors, Safeties & Field Devices',
      clauses: [
        {
          key: 'devices_intro',
          order: 10,
          body:
            'The following sensors and safety devices are furnished on the machine or field-installed, and are monitored by the IAT PLC:',
          children: [
            {
              key: 'device_wheel_proving',
              order: 10,
              body: 'Wheel Rotation Proving Switch',
              requires: [{ fact: 'has_rotor_rotation_alarm', is: true }],
              device: { tag_prefix: 'ZS', signal: 'DI', service: 'Wheel rotation proving switch' },
            },
            {
              key: 'device_react_high_temp',
              order: 20,
              body: 'Reactivation High Temperature Switch (safety, hardwired reactivation heat shutdown)',
              device: { tag_prefix: 'TSH', signal: 'DI', service: 'Reactivation high temperature switch' },
            },
            {
              key: 'device_pre_desiccant_dp',
              order: 30,
              body: 'Pre-Desiccant Dewpoint / Temperature Transmitter (Vaisala HMD82TD Series)',
              requires: [{ fact: 'has_desiccant_wheel', is: true }],
              device: { tag_prefix: 'MT', signal: 'AI', service: 'Pre-desiccant dewpoint/temperature transmitter' },
            },
            {
              key: 'device_post_desiccant_dp',
              order: 40,
              body: 'Post-Desiccant Dewpoint / Temperature Transmitter (Vaisala HMD82TD Series)',
              requires: [{ fact: 'has_desiccant_wheel', is: true }],
              device: { tag_prefix: 'MT', signal: 'AI', service: 'Post-desiccant dewpoint/temperature transmitter' },
            },
            {
              key: 'device_react_temp',
              order: 50,
              body: 'Reactivation Air Temperature (Type J thermocouple)',
              device: { tag_prefix: 'TT', signal: 'AI', service: 'Reactivation air temperature' },
            },
            {
              key: 'device_pre_cool_lat',
              order: 60,
              body: 'Pre-Cooling Leaving Air Temperature (Type J thermocouple)',
              requires: [{ fact: 'pre_cool_medium', oneOf: ['chilled_water', 'dx'] }],
              device: { tag_prefix: 'TT', signal: 'AI', service: 'Pre-cooling leaving air temperature' },
            },
            {
              key: 'device_post_cool_lat',
              order: 70,
              body: 'Post-Cooling Leaving Air Temperature (Type J thermocouple)',
              requires: [{ fact: 'post_cool_medium', oneOf: ['chilled_water', 'dx'] }],
              device: { tag_prefix: 'TT', signal: 'AI', service: 'Post-cooling leaving air temperature' },
            },
            {
              key: 'device_post_heat_lat',
              order: 80,
              body: 'Post-Heating Leaving Air Temperature (Type J thermocouple)',
              requires: [{ fact: 'post_heat_medium', oneOf: ['hot_water', 'steam', 'electric'] }],
              device: { tag_prefix: 'TT', signal: 'AI', service: 'Post-heating leaving air temperature' },
            },
            {
              key: 'device_space_sensor_loose',
              order: 90,
              body: 'Space Humidity / Temperature Transmitter (Vaisala HMD88TD/HMW88TD Series, ships loose)',
              requires: [{ fact: 'space_sensor_ships_loose', is: true }],
              device: { tag_prefix: 'MT', signal: 'AI', service: 'Space humidity/temperature transmitter' },
            },
            {
              key: 'device_space_sensor_fitted',
              order: 90,
              body: 'Space Humidity / Temperature Transmitter (Vaisala HMD88TD/HMW88TD Series)',
              requires: [{ fact: 'space_sensor_ships_loose', is: false }],
              device: { tag_prefix: 'MT', signal: 'AI', service: 'Space humidity/temperature transmitter' },
            },
            {
              key: 'device_process_plenum_pt',
              order: 100,
              body: 'Process Plenum Pressure Transmitter',
              requires: [{ fact: 'has_process_plenum_pressure_xmtr', is: true }],
              device: { tag_prefix: 'PT', signal: 'AI', service: 'Process plenum pressure transmitter' },
            },
            {
              key: 'device_react_plenum_pt',
              order: 110,
              body: 'React Plenum Pressure Transmitter',
              requires: [{ fact: 'has_react_plenum_pressure_xmtr', is: true }],
              device: { tag_prefix: 'PT', signal: 'AI', service: 'React plenum pressure transmitter' },
            },
            {
              key: 'device_process_filter_pt',
              order: 120,
              body: 'Process Filter Pressure Transmitter (Dirty Filter Alarm w/ transmitter & indicator light)',
              requires: [
                { fact: 'has_process_filter', is: true },
                { fact: 'dirty_filter_alarms', is: true },
              ],
              device: { tag_prefix: 'PDT', signal: 'AI', service: 'Process filter differential pressure' },
            },
            {
              key: 'device_final_filter_pt',
              order: 130,
              body: 'Final Filter Pressure Transmitter (Dirty Filter Alarm w/ transmitter & indicator light)',
              requires: [
                { fact: 'has_final_filter', is: true },
                { fact: 'dirty_filter_alarms', is: true },
              ],
              device: { tag_prefix: 'PDT', signal: 'AI', service: 'Final filter differential pressure' },
            },
            {
              key: 'device_react_filter_pt',
              order: 140,
              body: 'React Filter Pressure Transmitter (Dirty Filter Alarm w/ transmitter & indicator light)',
              requires: [
                { fact: 'has_react_filter', is: true },
                { fact: 'dirty_filter_alarms', is: true },
              ],
              device: { tag_prefix: 'PDT', signal: 'AI', service: 'React filter differential pressure' },
            },
            {
              key: 'device_afms',
              order: 150,
              body: 'Outside-Air Flow Monitoring Station (Ebtron GTC, on OA damper)',
              requires: [{ fact: 'has_afms', is: true }],
              device: { tag_prefix: 'FT', signal: 'AI', service: 'Outside-air flow monitoring station' },
            },
            {
              key: 'device_pre_cool_freezestat',
              order: 160,
              body: 'Pre-Cooling Coil Freezestat (mechanical, manual reset)',
              requires: [{ fact: 'pre_cool_medium', is: 'chilled_water' }],
              device: { tag_prefix: 'TSL', signal: 'DI', service: 'Pre-cooling coil freezestat' },
            },
            {
              key: 'device_post_cool_freezestat',
              order: 170,
              body: 'Post-Cooling Coil Freezestat (mechanical, manual reset)',
              requires: [{ fact: 'post_cool_medium', is: 'chilled_water' }],
              device: { tag_prefix: 'TSL', signal: 'DI', service: 'Post-cooling coil freezestat' },
            },
          ],
        },

        {
          key: 'pilot_lights',
          order: 20,
          heading: 'Pilot Lights on Door:',
          body: '',
          children: [
            { key: 'pilot_light_power', order: 10, body: 'Power On pilot light (WHITE)' },
            { key: 'pilot_light_running', order: 20, body: 'Unit Running pilot light (GREEN)' },
            {
              key: 'pilot_light_react',
              order: 30,
              body: 'Reactivation Heat Enabled pilot light (AMBER)',
            },
            { key: 'pilot_light_alarm', order: 40, body: 'Alarm pilot light (RED)' },
            {
              key: 'pilot_light_pre_cool',
              order: 50,
              body: 'Pre-Cooling Enabled pilot light (BLUE)',
              requires: [{ fact: 'pre_cool_medium', oneOf: ['chilled_water', 'dx'] }],
            },
            {
              key: 'pilot_light_post_cool',
              order: 60,
              body: 'Post-Cooling Enabled pilot light (BLUE)',
              requires: [{ fact: 'post_cool_medium', oneOf: ['chilled_water', 'dx'] }],
            },
            {
              key: 'pilot_light_post_heat',
              order: 70,
              body: 'Post-Heating Enabled pilot light (AMBER)',
              requires: [{ fact: 'post_heat_medium', oneOf: ['hot_water', 'steam', 'electric'] }],
            },
          ],
        },

        {
          key: 'control_devices',
          order: 30,
          heading: 'Control Devices on Door:',
          body: '',
          children: [
            { key: 'control_device_selector', order: 10, body: 'ON – OFF – AUTO Selector Switch' },
            {
              key: 'control_device_hmi_premium',
              order: 20,
              body: '10" Color Touchscreen HMI (iControl Premium PLC package)',
              requires: [{ fact: 'controls_package', is: 'icontrol_premium' }],
            },
            {
              key: 'control_device_hmi_standard',
              order: 20,
              body: 'Color Touchscreen HMI (iControl PLC package)',
              requires: [{ fact: 'controls_package', is: 'icontrol_standard' }],
            },
          ],
        },

        {
          key: 'bas_interface',
          order: 40,
          heading: 'Remote / BAS Interface:',
          body: '',
          requires: [{ fact: 'bas_protocol', oneOf: ['bacnet_mstp', 'bacnet_ip', 'modbus'] }],
          children: [
            {
              key: 'bas_protocol_line',
              order: 10,
              body: 'Communication Protocol: {{protocol}}',
              slots: { protocol: { from: 'fact', path: 'bas_protocol', format: 'label' } },
            },
            {
              key: 'bas_run_contact',
              order: 20,
              body: 'Customer-Provided “Unit Run” contact input (External Run Command)',
              device: { tag_prefix: 'XS', signal: 'DI', service: 'External run command' },
            },
            {
              key: 'bas_high_humidity_out',
              order: 30,
              body: 'High Humidity Alarm – dry contact output',
              device: { tag_prefix: 'XA', signal: 'DO', service: 'High humidity alarm output' },
            },
            {
              key: 'bas_summary_alarm_out',
              order: 40,
              body: 'Summary Alarm – dry contact output',
              device: { tag_prefix: 'XA', signal: 'DO', service: 'Summary alarm output' },
            },
            {
              key: 'bas_space_sensor_inputs',
              order: 50,
              body: 'Space Humidity / Space Temperature – hardwired field sensor inputs (ships loose)',
              requires: [{ fact: 'space_sensor_ships_loose', is: true }],
            },
          ],
        },

        {
          key: 'notes',
          order: 50,
          heading: 'Notes:',
          body: '',
          children: [
            {
              key: 'note_hmi_help',
              order: 10,
              body:
                'All optional feature operations are discussed in detail in the respective help menus of the HMI. It is advised to review their operation before starting the equipment.',
            },
            {
              key: 'note_defaults',
              order: 20,
              body:
                'Setpoints, timers, and alarm differentials listed above are default values and are field-adjustable from the HMI unless otherwise noted.',
            },
          ],
        },
      ],
    },
  ],

  // ── Coverage ──────────────────────────────────────────────────────────────
  // See the file header. These turn "not written yet" into a loud blocker
  // instead of an exclusion indistinguishable from "not applicable".
  //
  // Each map lists every value that REQUIRES a sequence, pointing at the clause
  // that provides it. Keys naming a clause that does not exist yet are the
  // point — they are the declared gaps, and they read as a to-do list of what
  // the master document still owes us. A value left OUT of a map needs no
  // clauses at all (`none` = the unit has no such component).
  //
  // A rule must name the clause that IS the sequence, not merely a clause that
  // mentions the component. Jacob's 2026-08-07 test unit had DX pre-cooling and
  // the one-line pre-cooling temperature-sensor entry made the whole missing
  // pre-cooling sequence read as covered.
  coverage: [
    {
      fact: 'reactivation',
      covered: {
        steam: 'react_heat_steam',
        gas: 'react_heat_gas', // ← not written
        electric: 'react_heat_electric', // ← not written
        hot_water: 'react_heat_hot_water', // ← not written
      },
      requirement: 'The master library has no reactivation heat sequence for this reactivation type',
    },
    {
      fact: 'pre_cool_medium',
      covered: {
        chilled_water: 'pre_cooling',
        dx: 'pre_cooling_dx', // ← not written
      },
      requirement: 'The master library has no pre-cooling sequence for this cooling medium',
    },
    {
      fact: 'post_cool_medium',
      covered: {
        chilled_water: 'post_cooling',
        dx: 'post_cooling_dx', // ← not written
      },
      requirement: 'The master library has no post-cooling sequence for this cooling medium',
    },
    {
      fact: 'post_heat_medium',
      covered: {
        hot_water: 'post_heating',
        steam: 'post_heating_steam', // ← not written
        electric: 'post_heating_electric', // ← not written
      },
      requirement: 'The master library has no post-heating sequence for this heating medium',
    },
    {
      fact: 'wheel_drive',
      covered: { vfd: 'wheel_start_vfd', across_line: 'wheel_start_fixed' },
      requirement: 'The master library does not say how the desiccant wheel starts on this drive type',
    },
    {
      fact: 'humidity_sensor_location',
      covered: { space: 'humidity_basis_space', post_desiccant: 'humidity_basis_leaving' },
      requirement: 'The master library has no humidity control basis for this sensor location',
    },
    {
      fact: 'controls_package',
      covered: {
        icontrol_premium: 'control_device_hmi_premium',
        icontrol_standard: 'control_device_hmi_standard',
        other: 'control_device_hmi_other', // ← not written
      },
      requirement: 'The master library has no HMI description for this controls package',
    },
  ],
}
