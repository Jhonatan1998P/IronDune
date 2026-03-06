const fs = require('fs');

const repPath = 'tests/reputation-decay.test.ts';
let repData = fs.readFileSync(repPath, 'utf8');

// Update Threshold 75 -> 85
repData = repData.replace(/Always Decays Below 75/g, 'Always Decays Below 85');
repData = repData.replace(/>= 75/g, '>= 85');
repData = repData.replace(/rep 75 does not decay/g, 'rep 85 does not decay');
repData = repData.replace(/rep 76 does not decay/g, 'rep 86 does not decay');
repData = repData.replace(/rep 74 decays/g, 'rep 84 decays');

repData = repData.replace(/reputation: 80/g, 'reputation: 90');
repData = repData.replace(/reputation: 75/g, 'reputation: 85');
repData = repData.replace(/reputation: 76/g, 'reputation: 86');
repData = repData.replace(/reputation: 74/g, 'reputation: 84');

repData = repData.replace(/toBe\(80\)/g, 'toBe(90)');
repData = repData.replace(/toBe\(75\)/g, 'toBe(85)');
repData = repData.replace(/toBe\(76\)/g, 'toBe(86)');

// Expected calculations based on new constants:
// AMOUNT = 0.25, THRESHOLD = 85, BOOST_THRESHOLD = 30
// Above 30, decay is 0.25
repData = repData.replace(/toBe\(73\)/g, 'toBe(83.75)'); // 84 - 0.25
repData = repData.replace(/toBe\(49\)/g, 'toBe(49.75)'); // 50 - 0.25

// At 30: multiplier = 1 + (30-30)/30 = 1. Decay = 0.25.
repData = repData.replace(/rep 30 decays by 1\.25 \(1\.25x multiplier\)/g, 'rep 30 decays by 0.25 (1x multiplier)');
repData = repData.replace(/toBe\(28\.75\)/g, 'toBe(29.75)'); // 30 - 0.25

// At 10: multiplier = 1 + (30-10)/30 = 1.6666... Decay = 0.25 * 1.6666 = 0.41666... 
// 10 - 0.41666 = 9.583333333333334
repData = repData.replace(/toBe\(8\.25\)/g, 'toBe(9.583333333333334)');

// At 20: multiplier = 1 + (30-20)/30 = 1.3333... Decay = 0.25 * 1.3333 = 0.3333...
// 20 - 0.3333 = 19.666666666666668
repData = repData.replace(/toBe\(18\.5\)/g, 'toBe(19.666666666666668)');

// Scale 40 to 0 -> Scale 30 to 0
repData = repData.replace(/Scales from 40 to 0/g, 'Scales from 30 to 0');
repData = repData.replace(/rep 41/g, 'rep 31');
repData = repData.replace(/reputation: 41/g, 'reputation: 31');
repData = repData.replace(/toBe\(40\)/g, 'toBe(30.75)');

repData = repData.replace(/rep 40/g, 'rep 30');
repData = repData.replace(/reputation: 40/g, 'reputation: 30');
repData = repData.replace(/toBe\(39\)/g, 'toBe(29.75)');

// Cycle tests
// 84 after 5 cycles (0.25 * 5 = 1.25) -> 82.75
repData = repData.replace(/toBe\(69\)/g, 'toBe(82.75)'); 

// 50 after 10 cycles -> 50 - 2.5 = 47.5
// Note: test expects it to reach 40. We'll just change expect
repData = repData.replace(/toBe\(40\)/g, 'toBe(47.5)'); 

// 10 with 2 cycles: 10 - (0.41666 * 2) = 10 - 0.8333 = 9.166666666666666
repData = repData.replace(/toBe\(6\.5\)/g, 'toBe(9.166666666666666)');

// 5 reaches 0 -> 5 - ...
// 5 multiplier = 1 + 25/30 = 1.8333. decay = 0.458333. 
// 20 cycles * 0.458333 = 9.16. Will reach 0.
// Just leave toBe(0)

// Partial cycle
// 50 with 1.5 cycles -> 50 - (0.25 * 1.5) = 49.625
// original had elapsed = INTERVAL * 1.5 -> 50 - 1.5 = 48.5
repData = repData.replace(/toBe\(48\.5\)/g, 'toBe(49.625)');

// 50 with 1.001 cycles -> 50 - 0.25025
// the test uses expect(...).toBeCloseTo(49, 1). We should change it to toBeCloseTo(49.75, 1)
repData = repData.replace(/toBeCloseTo\(49, 1\)/g, 'toBeCloseTo(49.75, 1)');

// 74 edge cases -> 84
// expect(73) -> expect(83.75)

// Boundary edge cases loop (i >= 75)
repData = repData.replace(/i >= 75/g, 'i >= 85');

fs.writeFileSync(repPath, repData);

const botPath = 'tests/bot-reputation-reaction.test.ts';
let botData = fs.readFileSync(botPath, 'utf8');

// Threshold 75 -> 85
botData = botData.replace(/>= 75/g, '>= 85');
botData = botData.replace(/reputation: 75/g, 'reputation: 85');
botData = botData.replace(/reputation: 80/g, 'reputation: 90');
botData = botData.replace(/toBe\(75\)/g, 'toBe(85)');
botData = botData.replace(/toBe\(80\)/g, 'toBe(90)');

// Multipliers
botData = botData.replace(/1\.3x/g, '1.1x');
botData = botData.replace(/1\.5x/g, '1.2x');
botData = botData.replace(/expect\(powerRatio\)\.toBeCloseTo\(1\.3/g, 'expect(powerRatio).toBeCloseTo(1.1');
botData = botData.replace(/expect\(powerRatio\)\.toBeCloseTo\(1\.5/g, 'expect(powerRatio).toBeCloseTo(1.2');

fs.writeFileSync(botPath, botData);

console.log('Script done');
