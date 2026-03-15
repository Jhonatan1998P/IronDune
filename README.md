<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Iron Dune: Operations

A browser-based military strategy game where you build a base, manage resources, recruit armies, and compete against AI bots in an evolving world.

## Features

- **Base Building**: Construct resource generators (Oil Rigs, Gold Mines, Munitions Factories) and economic buildings (Banks, Markets)
- **Army Management**: Recruit 8 unit types across 5 categories (Infantry, Tanks, Artillery, Naval, Air)
- **Research Tree**: Unlock advanced technologies and unit blueprints
- **PvP Combat**: Attack other players' bases asynchronously
- **Campaign Mode**: 25 PvE levels with progressive difficulty
- **Dynamic Economy**: Banking system with variable interest rates, procedural market
- **Reputation System**: Build alliances or make enemies with AI bots
- **Enemy Attack System**: Low-reputation bots will attack you periodically
- **Retaliation Mechanics**: Bots you attack may seek revenge
- **Offline Progression**: Your empire continues growing while you're away

## Quick Start

### Prerequisites
- Node.js 18+ installed

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment (optional):**
   Create a `.env.local` file with your Gemini API key for AI features:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

5. **Run tests:**
   ```bash
   npm test
   ```

## Game Systems

### Resource Management
Manage 5 resources: **Money**, **Oil**, **Ammo**, **Gold**, and **Diamonds**. Each has unique uses:
- **Money**: Primary currency for buildings and units
- **Oil**: Required for vehicles and naval units
- **Ammo**: Required for infantry and artillery
- **Gold**: Used for espionage and advanced operations
- **Diamonds**: Premium resource for acceleration and elite units

### Combat System
- **Rock-Paper-Scissors balance**: Each unit type has strengths and weaknesses
- **Round-based simulation**: Battles resolve in up to 6 rounds
- **Rapid Fire**: Some units get bonus attacks against specific targets
- **Critical Hits**: Units can be eliminated instantly if damage exceeds 70% of remaining HP

### Reputation & Diplomacy
- **Reputation Range**: 0-100 with each bot
- **Allies (≥70)**: May defend you, less likely to attack
- **Enemies (≤30)**: Can attack you periodically, more likely to retaliate
- **Decay**: Reputation slowly decays over time (faster below 40)

### Enemy Attack System
- **Check Interval**: Every 30 minutes, enemy bots roll to attack
- **Eligibility**: Only bots with reputation ≤30 can attack
- **Attack Chance**: Increases as reputation decreases (20% base at rep 30)
- **Limits**: Max 3 attacks per bot per 24 hours, 2-hour cooldown between attacks
- **Personality Modifiers**: Warlords attack 50% more often, Turtles 50% less

### Retaliation System
- **Trigger**: When you attack a bot, it may seek revenge
- **Timing**: 15-45 minutes random delay for all personalities
- **Retaliation Chance by Personality**:
  - Warlord: 95% (very vengeful)
  - Turtle: 85% (holds grudges)
  - Rogue: 90% (unpredictable)
  - Tycoon: 70% (busy making money)
- **Army Strength**: Turtles send 50% stronger armies, Warlords 30% stronger

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS (CDN) with glassmorphism design
- **State**: React Context with immutable updates
- **Persistence**: localStorage with hash-based integrity verification
- **i18n**: English and Spanish support

## Project Structure

```
/home/runner/workspace/
├── components/          # React components
│   ├── layout/         # Main shell and routing
│   ├── views/          # Game tab views
│   └── ui/             # Reusable UI primitives
├── context/            # React Context providers
├── data/               # Static game definitions
├── hooks/              # Custom React hooks
├── i18n/               # Translation dictionaries
├── tests/              # Vitest test files
├── types/              # TypeScript type definitions
├── utils/
│   └── engine/         # Core game logic
│       ├── loop.ts     # Game tick system
│       ├── combat.ts   # Battle simulation
│       ├── economy.ts  # Resource production
│       ├── war.ts      # War system
│       ├── nemesis.ts  # Retaliation system
│       └── enemyAttack.ts  # Enemy attack system
└── constants.ts        # Game configuration
```

## Links

- **Play Online**: [AI Studio](https://ai.studio/apps/drive/1JwU7b9AKy6dmL2ZIdwF1tEiLcR2M87jf)
- **Documentation**: See `FEATURES.md` for detailed mechanics
- **Architecture**: See `replit.md` for technical documentation
