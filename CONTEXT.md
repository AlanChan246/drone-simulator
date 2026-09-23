# Drone Rescue Training

This context describes the learner-facing concepts in the programmable drone simulator and its rescue missions.

## Language

**Flight Program**:
A learner-authored sequence of Blockly instructions that controls the drone.
_Avoid_: Script, code queue

**Flight Command**:
One executable instruction produced by a Flight Program, such as takeoff, move, hover, or land.
_Avoid_: Queue item, Blockly command

**Mission**:
A scored rescue scenario with objectives, progress, completion rules, and a result.
_Avoid_: Level, challenge

**Tunnel Rescue**:
The earthquake-response Mission in which the drone follows the street network, visits optional inspection checkpoints, and lands at the evacuation area.
_Avoid_: Mission 1, tunnel mission

**Wildfire Response**:
The forest-fire Mission in which the drone collects water, extinguishes fires, manages battery capacity, and lands at the disaster zone.
_Avoid_: Mission 2, city mission

**Inspection Checkpoint**:
An optional Tunnel Rescue location where hovering uploads field information for additional score.
_Avoid_: Beacon

**Fire Site**:
A Wildfire Response location where carried water can extinguish a fire for score.
_Avoid_: Fire point

**Charge Station**:
A Wildfire Response location where hovering restores Flight Command capacity.
_Avoid_: Charger, battery pad

**Flight Deck**:
The learner-facing workspace containing the simulator view, Flight Program editor, telemetry, controls, and Mission feedback.
_Avoid_: Game UI, interface screen
