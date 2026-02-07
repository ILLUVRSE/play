# ILLUVRSE Wrestling (Unity 2022.3 LTS)

A 2.5D side-view sumo brawler built for WebGL. This project generates scenes, prefabs, and data via an editor tool so you can open and play immediately.

## Setup
1) Open Unity Hub and add the project folder: `ILLUVRSE Wrestling League`.
2) Open with Unity **2022.3 LTS**.
3) In Unity, run **Tools > ILLUVRSE > Generate All** (one-time generation for scenes/prefabs/data).
4) Open `Assets/Scenes/MainMenu.unity` and press Play.

## Controls
Player 1 (Keyboard + Mouse)
- Move: `A/D` (left/right), `W/S` (depth lane)
- Jump/Step: `Space`
- Push/Strike: `Left Mouse Button`
- Grab (hold): `Right Mouse Button`
- Throw: `E`
- Dodge/Side-step: `Left Shift`
- Special: `Q`
- Pause: `Esc`

Player 2 (Keyboard)
- Move: Arrow keys
- Jump/Step: `Right Shift`
- Push/Strike: `J`
- Grab (hold): `K`
- Throw: `L`
- Dodge/Side-step: `U`
- Special: `I`
- Pause: `Esc`

## Game Modes
- **Quick Match**: Select any two wrestlers. Player 2 is AI.
- **Versus**: Local two-player on one keyboard.
- **Ladder**: Pick a wrestler and face a randomized gauntlet.

## Build (WebGL)
1) Open **File > Build Settings**.
2) Select **WebGL**, click **Switch Platform**.
3) Add scenes in this order:
   - `Assets/Scenes/MainMenu.unity`
   - `Assets/Scenes/CharacterSelect.unity`
   - `Assets/Scenes/Match.unity`
   - `Assets/Scenes/Ladder.unity`
4) Click **Build and Run**.

## Play-Mode Test Checklist
- Main Menu buttons load each mode.
- Character Select shows all 12 wrestlers with stats and specials.
- Match runs best-of-3 with ring-out and knockdown (3-count).
- AI stays in the ring and attempts push/grab/throw/dodge.
- Ladder progresses to next opponent after a win.

## Generated Content
The generator creates:
- Scenes: MainMenu, CharacterSelect, Match, Ladder
- Prefabs: Wrestler, Ring, CameraRig
- ScriptableObjects: WrestlerData (12), RosterDatabase, GameSettings
- Materials: ring/arena

## Notes / Stubs
- Audio is generated procedurally with simple tones.
- UI is functional and minimal; additional polish can be layered later.
