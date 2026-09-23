# Design systems

This project uses two visual systems on purpose:

| Surface | System | Source |
|---------|--------|--------|
| Brand / menus / boot gates | SpaceX-inspired (black, white, full-bleed video, ghost pill CTAs) | [spacex/DESIGN.md](spacex/DESIGN.md) |
| Simulator workspace (`#game-interface`) | Flight Deck (cyan / green / amber / red HUD) | `:root` `--flight-*` tokens in `style.css` |

Do not mix brand accent cyan onto hub screens, and do not restyle the in-sim HUD with SpaceX black-and-white marketing rules.
