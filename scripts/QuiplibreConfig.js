"use strict";

const QuiplibreConfig = {
	enhanced: false,
	defaultRound : {
		nrPrompts: 1, // nr of prompts per round
		maxPrompts: 0, // 0 is disable
		newPrompts: false // if true, will ask for a prompt instead of selecting a random one
	},
	rounds: [
		{ type: "paired", nrPrompts: 1, newPrompts: false, maxAnswers: 0 },
		{ type: "paired", nrPrompts: 1, newPrompts: false, maxAnswers: 0 },
		{ type: "normal", nrPrompts: 1, newPrompts: false, maxAnswers: 0 }
	]
}
